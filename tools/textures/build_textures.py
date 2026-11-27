"""Texture set v2: layered, seamless PBR textures (M1.1 "Look & Feel").

Run:   python3 tools/textures/build_textures.py [name ...]
Out:   assets_src/textures/<name>_{albedo,rough,normal}.jpg (sources, embedded into GLBs) + public/assets/textures/grunge.jpg (runtime)

Every texture is built like a texture artist would in Substance: a base material, macro variation, mid detail,
micro detail, then wear / stains / dirt layers that also drive roughness (so reflections break up realistically).
All noise is periodic (FFT synthesis, periodic KD-trees, wrapped strokes), so every map tiles seamlessly.
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage
from scipy.spatial import cKDTree

OUT = Path(__file__).resolve().parents[2] / "assets_src/textures"  # sources (embedded into GLBs by Blender)
RUNTIME = Path(__file__).resolve().parents[2] / "public/assets/textures"  # only what the game loads directly
OUT.mkdir(parents=True, exist_ok=True)


# ============================================================================ noise toolkit
def spectral(n, beta=2.0, lo=1.0, hi=None, seed=0, aniso=(1.0, 1.0)):
    """Periodic fractal noise in 0..1 (power spectrum ~ 1/f^beta)."""
    r = np.random.default_rng(seed)
    f = np.fft.fftfreq(n) * n
    FX, FY = np.meshgrid(f, f)
    rad = np.sqrt((FX * aniso[0]) ** 2 + (FY * aniso[1]) ** 2)
    rad[0, 0] = 1
    amp = rad ** (-beta / 2)
    amp[rad < lo] = 0
    if hi:
        amp[rad > hi] = 0
    img = np.real(np.fft.ifft2(amp * np.exp(1j * r.uniform(0, 2 * np.pi, (n, n)))))
    img -= img.min()
    return img / (img.max() + 1e-9)


def worley(n, count, seed=0, k=1):
    """Periodic Worley noise: distance to the k-th nearest feature point, normalised 0..1. Returns (dist, id)."""
    r = np.random.default_rng(seed)
    pts = r.uniform(0, n, (count, 2))
    tree = cKDTree(pts, boxsize=n)
    yy, xx = np.mgrid[0:n, 0:n]
    q = np.stack([xx.ravel() + 0.5, yy.ravel() + 0.5], 1) % n
    d, i = tree.query(q, k=k)
    if k > 1:
        d, i = d[:, -1], i[:, -1]
    d = d.reshape(n, n)
    return d / d.max(), i.reshape(n, n)


def smooth(x, a, b):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def wrap_blur(x, s):
    return ndimage.gaussian_filter(x, s, mode="wrap")


def height_to_normal(h, strength):
    gx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * strength
    gy = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) * strength
    v = np.stack([-gx, gy, np.ones_like(h)], -1)
    v /= np.linalg.norm(v, axis=-1, keepdims=True)
    return v * 0.5 + 0.5


def srgb(c):
    return np.array([int(c[i:i + 2], 16) / 255 for i in (1, 3, 5)], np.float32)


def lerp3(a, b, t):
    t = np.clip(t, 0, 1)[..., None]
    return a * (1 - t) + b * t


def save(name, albedo=None, rough=None, normal=None, q=90):
    if albedo is not None:
        Image.fromarray((np.clip(albedo, 0, 1) * 255).astype(np.uint8)).save(OUT / f"{name}_albedo.jpg", quality=q)
    if rough is not None:
        Image.fromarray((np.clip(rough, 0, 1) * 255).astype(np.uint8), "L").save(OUT / f"{name}_rough.jpg", quality=q)
    if normal is not None:
        Image.fromarray((np.clip(normal, 0, 1) * 255).astype(np.uint8)).save(OUT / f"{name}_normal.jpg", quality=q + 4)
    print("  built", name, flush=True)


def strokes(n, count, seed, length=(40, 200), width=(1, 3), curvature=0.03, value=1.0):
    """Wrapped random polyline strokes (scratches, cracks, trowel swirls) drawn into a float canvas."""
    r = np.random.default_rng(seed)
    im = Image.new("F", (n * 3, n * 3), 0.0)
    d = ImageDraw.Draw(im)
    for _ in range(count):
        x, y = r.uniform(n, 2 * n), r.uniform(n, 2 * n)
        a = r.uniform(0, 2 * np.pi)
        L = r.uniform(*length)
        w = r.uniform(*width)
        pts = [(x, y)]
        steps = max(2, int(L / 6))
        for _s in range(steps):
            a += r.normal(0, curvature)
            x += np.cos(a) * L / steps
            y += np.sin(a) * L / steps
            pts.append((x, y))
        d.line(pts, fill=float(value * r.uniform(0.4, 1.0)), width=max(1, int(round(w))))
    a = np.asarray(im, np.float32)
    # fold the 3x3 canvas back onto one tile (wrap)
    out = np.zeros((n, n), np.float32)
    for i in range(3):
        for j in range(3):
            out = np.maximum(out, a[i * n:(i + 1) * n, j * n:(j + 1) * n])
    return out


# ============================================================================ materials
def concrete():
    """Polished garage slab, one 2 m tile with a saw-cut joint at the border."""
    n = 2048
    base = spectral(n, 2.4, seed=1)
    mottling = spectral(n, 3.0, lo=2, seed=2)
    sand = spectral(n, 0.6, lo=300, seed=3)
    agg_d, agg_id = worley(n, 9000, seed=4)
    agg = smooth(1 - agg_d, 0.86, 0.97)  # exposed aggregate stones
    agg_tone = np.random.default_rng(5).uniform(-1, 1, 9000)[agg_id]
    pores = smooth(1 - worley(n, 14000, seed=6)[0], 0.965, 0.995)
    swirl = wrap_blur(strokes(n, 700, 7, length=(180, 520), width=(6, 16), curvature=0.06, value=1), 3)
    cracks = strokes(n, 6, 8, length=(300, 900), width=(1, 2), curvature=0.25)
    drip_d, _ = worley(n, 14, seed=9)
    oil = smooth(1 - drip_d, 0.80, 0.97) * smooth(spectral(n, 1.4, lo=4, seed=10), 0.35, 0.75)
    dust = smooth(spectral(n, 2.2, seed=11), 0.55, 0.85)
    yy, xx = np.mgrid[0:n, 0:n]
    joint = ((np.minimum(xx, n - 1 - xx) < 3) | (np.minimum(yy, n - 1 - yy) < 3)).astype(np.float32)
    v = 0.56 + (base - 0.5) * 0.10 + (mottling - 0.5) * 0.14 + (sand - 0.5) * 0.06
    v += agg * agg_tone * 0.10 - pores * 0.18 - cracks * 0.25 - oil * 0.10 + dust * 0.05 - joint * 0.35
    warm = srgb("#8f8b84")
    cool = srgb("#9a9d9f")
    col = lerp3(cool, warm, mottling) * (v / 0.56)[..., None]
    col = lerp3(col, srgb("#4a463f") * (0.8 + base[..., None] * 0.4), oil * 0.35)
    rough = 0.48 + (sand - 0.5) * 0.12 - swirl * 0.16 - oil * 0.28 + dust * 0.22 + pores * 0.25 + joint * 0.4 + (mottling - 0.5) * 0.1
    h = base * 0.8 + sand * 0.6 + agg * 0.9 - pores * 1.5 - cracks * 2.5 - joint * 4
    save("concrete", col, rough, height_to_normal(h, 1.6))


def blockwall():
    """Painted CMU block wall: 400 x 200 mm blocks, tile = 1.2 m (3 blocks x 6 courses)."""
    n = 2048
    yy, xx = np.mgrid[0:n, 0:n].astype(np.float32)
    bh, bw = n / 6, n / 3
    row = np.floor(yy / bh)
    xo = (xx + (row % 2) * bw / 2) % n
    bid = (row * 3 + np.floor(xo / bw)).astype(int)
    mx = np.minimum(xo % bw, bw - xo % bw)
    my = np.minimum(yy % bh, bh - yy % bh)
    edge = np.minimum(mx, my)
    mortar = 1 - smooth(edge, 3, 11)          # concave tooled joint
    bevel = 1 - smooth(edge, 9, 22)           # rounded block edge under the paint
    r = np.random.default_rng(21)
    tone = r.uniform(-1, 1, 18)[bid % 18]
    pores_d, _ = worley(n, 30000, seed=22)
    pores = smooth(1 - pores_d, 0.955, 0.995)  # CMU pores still visible through paint
    grain = spectral(n, 1.1, lo=60, seed=23)
    stipple = spectral(n, 0.5, lo=400, seed=24)  # paint roller stipple
    blotch = spectral(n, 2.6, seed=25)
    scuffs = wrap_blur(strokes(n, 60, 26, length=(20, 90), width=(2, 6), curvature=0.2), 1.5) * smooth(spectral(n, 2.0, seed=27), 0.5, 0.8)
    chips = smooth(1 - worley(n, 400, seed=28)[0], 0.985, 0.996) * smooth(spectral(n, 2.0, seed=29), 0.6, 0.9)
    paint = srgb("#cdc8bd")
    grime = smooth(spectral(n, 2.0, seed=30), 0.45, 0.9)
    speck = spectral(n, 0.4, lo=350, seed=31)
    v = 1 + tone * 0.04 + (blotch - 0.5) * 0.09 + (grain - 0.5) * 0.08 + (speck - 0.5) * 0.06 - pores * 0.30 - mortar * 0.16 - scuffs * 0.18 - grime * 0.07
    col = paint * v[..., None]
    col = lerp3(col, srgb("#8b8984"), chips * 0.9)
    rough = 0.78 + (stipple - 0.5) * 0.18 + pores * 0.1 - scuffs * 0.1 + chips * 0.1
    h = grain * 0.5 + stipple * 0.35 - pores * 1.6 - mortar * 2.5 - bevel * 1.0 - chips * 0.8
    save("blockwall", col, rough, height_to_normal(h, 2.2))


def osb():
    """Oriented strand board, tile = 1.2 m: layered wood strands (large + small), muted tones, fibre grain, resin gaps."""
    n = 2048
    r = np.random.default_rng(31)
    base = Image.new("RGB", (n, n), (165, 128, 82))
    hmap = Image.new("F", (n, n), 0.0)
    dc = ImageDraw.Draw(base)
    dh = ImageDraw.Draw(hmap)
    # muted, close tones (real OSB is fairly uniform at a distance)
    tones = [srgb(c) for c in ("#bd9866", "#b48f5e", "#c6a371", "#ad8857", "#cba97a", "#a6814f", "#c09c6a", "#b89460")]
    layers = [(2600, (60, 150), (14, 34)), (2200, (90, 260), (22, 60)), (3000, (25, 70), (8, 18))]
    i = 0
    for count, Lr, Wr in layers:
        for _ in range(count):
            cx, cy = r.uniform(0, n), r.uniform(0, n)
            L = r.uniform(*Lr)
            W = r.uniform(*Wr)
            a = r.normal(0, 0.45) + (np.pi / 2 if r.random() < 0.3 else 0)
            ca, sa = np.cos(a), np.sin(a)
            corners = [(-L / 2, -W / 2), (L / 2, -W / 2 + r.uniform(-3, 3)), (L / 2, W / 2), (-L / 2, W / 2 + r.uniform(-3, 3))]
            t = tones[r.integers(len(tones))] * r.uniform(0.93, 1.05)
            fill = tuple(int(c * 255) for c in np.clip(t, 0, 1))
            for ox in (-n, 0, n):
                for oy in (-n, 0, n):
                    poly = [(cx + ox + x * ca - y * sa, cy + oy + x * sa + y * ca) for x, y in corners]
                    dc.polygon(poly, fill=fill)
                    dh.polygon(poly, fill=float(i % 9) / 9.0)
            i += 1
    col = np.asarray(base, np.float32) / 255
    h = np.asarray(hmap, np.float32)
    # fibre grain inside the strands (direction roughly follows the strands: mostly along X)
    grain = spectral(n, 1.3, lo=30, seed=32, aniso=(1.0, 0.06))
    grain2 = spectral(n, 0.9, lo=120, seed=33, aniso=(1.0, 0.1))
    gaps = smooth(ndimage.gaussian_gradient_magnitude(h, 0.8), 0.04, 0.3)
    resin = smooth(spectral(n, 2.6, seed=34), 0.6, 0.9)
    col = col * (0.88 + (grain[..., None] - 0.5) * 0.34 + (grain2[..., None] - 0.5) * 0.18)
    col = col * (1 - gaps[..., None] * 0.28)
    col = lerp3(col, col * srgb("#8a6a40") / 0.6, resin * 0.18)
    rough = 0.74 + (grain - 0.5) * 0.12 + gaps * 0.15
    hh = h * 0.3 + grain * 0.5 + grain2 * 0.3 - gaps * 1.4
    save("osb", col, rough, height_to_normal(hh, 1.6))


def plywood():
    """Birch plywood face veneer (shelves), tile = 0.6 m, grain along X."""
    n = 1024
    warp = spectral(n, 3.0, seed=41)
    yy, xx = np.mgrid[0:n, 0:n].astype(np.float32)
    rings = 0.5 + 0.5 * np.sin((yy + warp * 90) * 0.09 + spectral(n, 2.0, seed=42, aniso=(1.0, 0.05)) * 14)
    fine = spectral(n, 1.0, lo=60, seed=43, aniso=(1.0, 0.04))
    knots_d, _ = worley(n, 5, seed=44)
    knot = smooth(1 - knots_d, 0.93, 0.99)
    v = 0.72 + (rings - 0.5) * 0.10 + (fine - 0.5) * 0.12 - knot * 0.35
    col = lerp3(srgb("#b9925e"), srgb("#e7cf9f"), v)
    rough = 0.68 + (fine - 0.5) * 0.1
    save("plywood", col, rough, height_to_normal(fine * 0.5 + rings * 0.2 - knot, 1.0))


def butcher():
    """Butcher-block worktop: 40 mm strips with butt joints, varied grain, scratches, a coffee ring. Tile = 0.8 m."""
    n = 2048
    r = np.random.default_rng(51)
    yy, xx = np.mgrid[0:n, 0:n].astype(np.float32)
    strips = 20
    sw = n / strips
    sid = np.floor(yy / sw).astype(int)
    # butt joints at random positions per strip
    off = r.uniform(0, n, strips)[sid]
    seg_len = r.uniform(n * 0.3, n * 0.7, strips)[sid]
    seg = np.floor(((xx + off) % n) / seg_len).astype(int)
    key = (sid * 7 + seg * 13) % 97
    tone = r.uniform(-1, 1, 97)[key]
    hue = r.uniform(-1, 1, 97)[key]
    warp = spectral(n, 3.0, seed=52)
    streak = spectral(n, 1.6, lo=3, seed=53, aniso=(1.0, 0.03))
    rings = 0.5 + 0.5 * np.sin((yy + warp * 120 + key * 37.0) * 0.35 + streak * 10)
    fine = spectral(n, 1.0, lo=80, seed=54, aniso=(1.0, 0.05))
    seam = 1 - smooth(np.minimum(yy % sw, sw - yy % sw), 0.5, 2.5)
    bjoint = 1 - smooth(np.abs(((xx + off) % n) % seg_len - 0), 0.5, 2.0)
    scratches = wrap_blur(strokes(n, 400, 55, length=(30, 260), width=(1, 2), curvature=0.02), 0.6)
    ring_d = np.hypot(((xx - 1300 + n / 2) % n) - n / 2, ((yy - 600 + n / 2) % n) - n / 2)
    coffee = np.exp(-((ring_d - 70) ** 2) / 30) * 0.8 + smooth(70 - ring_d, 0, 8) * 0.15
    wear = smooth(spectral(n, 2.4, seed=56), 0.55, 0.8)
    v = 0.6 + tone * 0.16 + (rings - 0.5) * 0.26 + (streak - 0.5) * 0.30 + (fine - 0.5) * 0.22
    light = srgb("#d8b48a")
    dark = srgb("#6e4a2d")
    col = lerp3(dark, light, v)
    col = lerp3(col, col * srgb("#b98a66") / 0.75, (hue * 0.5 + 0.5) * 0.35)
    col *= (1 - seam * 0.45 - bjoint * 0.4)[..., None]
    col = lerp3(col, srgb("#5b3a22"), coffee * 0.6)
    col = col * (1 + scratches * 0.25)[..., None]
    rough = 0.32 + (fine - 0.5) * 0.1 + wear * 0.25 + scratches * 0.2 + seam * 0.3 + coffee * 0.1
    h = fine * 0.4 + rings * 0.2 - seam * 2 - bjoint * 2 - scratches * 0.8
    save("butcher", col, rough, height_to_normal(h, 1.2))


def metal():
    """Brushed + scratched steel/aluminium (neutral; tinted per material). Tile = 0.3 m, brush along X."""
    n = 1024
    brush = spectral(n, 1.0, lo=4, seed=61, aniso=(1.0, 0.004))
    scratches = strokes(n, 260, 62, length=(20, 180), width=(1, 1), curvature=0.01)
    smudge = smooth(spectral(n, 2.4, seed=63), 0.5, 0.8)
    v = 0.82 + (brush - 0.5) * 0.12 + scratches * 0.1 - smudge * 0.06
    save("brushed", np.repeat(v[..., None], 3, -1) * srgb("#e9eaec"), 0.3 + (brush - 0.5) * 0.12 + scratches * -0.08 + smudge * 0.18,
         height_to_normal(brush * 0.6 - scratches * 0.8, 0.8))


def powder():
    """Powder-coat (orange-peel) for steel frames, neutral, tinted per material. Tile = 0.25 m."""
    n = 1024
    peel = spectral(n, 1.8, lo=30, hi=200, seed=71)
    speck = spectral(n, 0.3, lo=300, seed=72)
    wear = smooth(spectral(n, 2.2, seed=73), 0.62, 0.85)
    save("powder", None, 0.42 + (speck - 0.5) * 0.12 + wear * 0.2, height_to_normal(peel, 1.3))


def plastic():
    """Injection-moulded mould-tech texture (VDI ~24) + handling smudges. Neutral, tinted per material. Tile = 0.1 m."""
    n = 1024
    grain = spectral(n, 0.4, lo=250, seed=81)
    mid = spectral(n, 1.6, lo=20, hi=120, seed=82)
    smudge = smooth(spectral(n, 2.6, seed=83), 0.5, 0.8)
    save("plastic", None, 0.48 + (grain - 0.5) * 0.2 - smudge * 0.14, height_to_normal(grain * 0.8 + mid * 0.15, 1.1))
    # keep the old name for assets that still use "micro"
    save("micro", None, 0.48 + (grain - 0.5) * 0.2 - smudge * 0.14, height_to_normal(grain * 0.8 + mid * 0.15, 1.1))


def rubber():
    n = 512
    g = spectral(n, 0.8, lo=80, seed=91)
    save("rubber", None, 0.85 + (g - 0.5) * 0.1, height_to_normal(g, 1.0))


def cardboard():
    """Corrugated cardboard liner: flutes under the skin, fibres, blotches, scuffed corners. Tile = 0.35 m."""
    n = 1024
    yy, xx = np.mgrid[0:n, 0:n].astype(np.float32)
    flutes = 0.5 + 0.5 * np.cos(xx * 2 * np.pi / (n / 48))
    fib = spectral(n, 1.0, lo=60, seed=101)
    fib2 = spectral(n, 1.2, lo=20, seed=102, aniso=(1.0, 0.25))
    blotch = spectral(n, 2.6, seed=103)
    speck = smooth(1 - worley(n, 3000, seed=104)[0], 0.97, 0.995)
    v = 0.66 + (fib - 0.5) * 0.10 + (fib2 - 0.5) * 0.08 + (blotch - 0.5) * 0.12 + (flutes - 0.5) * 0.035 - speck * 0.25
    col = lerp3(srgb("#8f6a3f"), srgb("#d3a977"), v)
    save("cardboard", col, 0.86 + (fib - 0.5) * 0.08, height_to_normal(fib * 0.5 + flutes * 0.45 + fib2 * 0.3, 1.6))


def drywall():
    """Painted ceiling drywall: orange-peel texture, a taped seam, slight staining. Tile = 1.2 m."""
    n = 1024
    peel = spectral(n, 1.4, lo=60, seed=111)
    blot = spectral(n, 2.8, seed=112)
    yy, xx = np.mgrid[0:n, 0:n]
    seam = np.exp(-(((xx + n // 2) % n - n // 2) ** 2) / 900.0)
    v = 0.93 + (blot - 0.5) * 0.05 - seam * 0.02
    save("drywall", np.repeat(v[..., None], 3, -1) * srgb("#f1efea"), 0.9 + (peel - 0.5) * 0.08, height_to_normal(peel + seam * 0.5, 1.4))


def kraft():
    n = 1024
    f = spectral(n, 1.2, lo=40, seed=121)
    c = spectral(n, 2.8, seed=122)
    crinkle = np.abs(spectral(n, 1.8, lo=6, seed=123) - 0.5) * 2
    col = lerp3(srgb("#8a6134"), srgb("#d1a46e"), 0.55 + (f - 0.5) * 0.2 + (c - 0.5) * 0.2)
    save("kraft", col, 0.88 + (f - 0.5) * 0.08, height_to_normal(f * 0.4 + crinkle * 1.6, 2.0))


def pei():
    """Textured PEI (gold powder-coat) with wear where parts get scraped off. Tile = 0.25 m (one plate)."""
    n = 1024
    speck = spectral(n, 0.3, lo=250, seed=131)
    bumps = smooth(1 - worley(n, 16000, seed=132)[0], 0.88, 0.99)
    yy, xx = np.mgrid[0:n, 0:n].astype(np.float32)
    centre = np.exp(-(((xx - n / 2) ** 2 + (yy - n / 2) ** 2) / (2 * (n * 0.22) ** 2)))
    wear = centre * smooth(spectral(n, 2.0, seed=133), 0.3, 0.8)
    scrapes = wrap_blur(strokes(n, 90, 134, length=(30, 160), width=(2, 5), curvature=0.01), 1.0) * centre
    v = 0.55 + (speck - 0.5) * 0.45 + bumps * 0.15
    col = lerp3(srgb("#5a3a12"), srgb("#e1a94e"), v)
    col = lerp3(col, srgb("#f0c880"), wear * 0.25 + scrapes * 0.35)
    save("pei", col, 0.5 + (speck - 0.5) * 0.25 - bumps * 0.15 - wear * 0.15 - scrapes * 0.2, height_to_normal(bumps + speck * 0.3 - scrapes * 0.4, 2.6))
    colb = lerp3(srgb("#050506"), srgb("#2a2826"), v * 0.8)
    colb = lerp3(colb, srgb("#4a4844"), wear * 0.35 + scrapes * 0.4)
    save("peiblack", colb, 0.55 + (speck - 0.5) * 0.2 - wear * 0.2 - scrapes * 0.2, None)


def carbon():
    n = 512
    yy, xx = np.mgrid[0:n, 0:n].astype(np.float32)
    t = n / 32
    u = ((xx + yy) // t) % 4 < 2
    weave = np.where(u, 0.5 + 0.5 * np.sin(xx * np.pi / t), 0.5 + 0.5 * np.sin(yy * np.pi / t))
    save("carbon", lerp3(srgb("#030304"), srgb("#1c1c1f"), weave * 0.6 + 0.2), 0.25 + weave * 0.15, height_to_normal(weave, 2.0))


def fabric():
    """Woven rug / chair fabric (neutral, tinted). Tile = 0.2 m."""
    n = 512
    yy, xx = np.mgrid[0:n, 0:n].astype(np.float32)
    p = n / 64
    wx = 0.5 + 0.5 * np.sin(xx * 2 * np.pi / p)
    wy = 0.5 + 0.5 * np.sin(yy * 2 * np.pi / p)
    weave = np.where(((xx // p + yy // p) % 2) == 0, wx, wy)
    fuzz = spectral(n, 0.8, lo=100, seed=141)
    save("fabric", np.repeat((0.75 + weave * 0.15 + (fuzz - 0.5) * 0.15)[..., None], 3, -1), 0.92 + (fuzz - 0.5) * 0.06, height_to_normal(weave + fuzz * 0.4, 1.5))


def grunge():
    """Engine weathering mask (tile = 0.8 m world, triplanar): R smudges/fingerprints, G dust speckle, B scratches."""
    n = 1024
    smudge = smooth(spectral(n, 2.2, seed=151), 0.45, 0.85) * 0.7 + smooth(spectral(n, 1.4, lo=8, seed=152), 0.55, 0.9) * 0.3
    prints_d, _ = worley(n, 90, seed=153)
    fingerprints = smooth(1 - prints_d, 0.82, 0.95) * smooth(spectral(n, 1.0, lo=120, seed=154), 0.4, 0.7)
    dust = smooth(spectral(n, 0.5, lo=200, seed=155), 0.55, 0.8)
    scratches = wrap_blur(strokes(n, 160, 156, length=(10, 90), width=(1, 1), curvature=0.03), 0.5)
    img = np.stack([np.clip(smudge + fingerprints * 0.6, 0, 1), dust, np.clip(scratches, 0, 1)], -1)
    Image.fromarray((img * 255).astype(np.uint8)).save(OUT / "grunge.jpg", quality=92)
    RUNTIME.mkdir(parents=True, exist_ok=True)
    Image.fromarray((img * 255).astype(np.uint8)).save(RUNTIME / "grunge.jpg", quality=92)
    print("  built grunge", flush=True)


ALL = [concrete, blockwall, osb, plywood, butcher, metal, powder, plastic, rubber, cardboard, drywall, kraft, pei, carbon,
       fabric, grunge]

if __name__ == "__main__":
    only = set(sys.argv[1:])
    for fn in ALL:
        if not only or fn.__name__ in only:
            fn()
