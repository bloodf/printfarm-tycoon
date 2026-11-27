"""Decal images (labels, posters, signs) rendered with PIL → assets_src/textures/decal_*.png"""
from pathlib import Path
import random
from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parents[2] / "assets_src/textures"
FONT_DIRS = ["/usr/share/fonts/truetype/dejavu/"]


def font(size, bold=False):
    name = "DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf"
    for d in FONT_DIRS:
        p = Path(d) / name
        if p.exists():
            return ImageFont.truetype(str(p), size)
    return ImageFont.load_default()


def barcode(d, x, y, w, h, seed):
    r = random.Random(seed)
    cx = x
    while cx < x + w:
        bw = r.choice([2, 2, 3, 4, 6])
        if r.random() > 0.45:
            d.rectangle([cx, y, cx + bw - 1, y + h], fill="black")
        cx += bw


def shipping_label():
    im = Image.new("RGB", (512, 768), "white")
    d = ImageDraw.Draw(im)
    d.rectangle([8, 8, 503, 759], outline="black", width=4)
    d.text((24, 22), "LAYERGOODS", font=font(40, True), fill="black")
    d.text((24, 70), "3D printed with care - from our garage", font=font(18), fill="black")
    d.line([8, 104, 503, 104], fill="black", width=3)
    d.text((24, 118), "SHIP TO:", font=font(22, True), fill="black")
    for i, line in enumerate(["CUSTOMER NAME", "123 MAKER STREET", "SPRINGFIELD 04521", "UNITED STATES"]):
        d.text((24, 150 + i * 34), line, font=font(28), fill="black")
    d.line([8, 300, 503, 300], fill="black", width=3)
    d.text((24, 312), "PRIORITY", font=font(56, True), fill="black")
    d.rectangle([380, 312, 490, 380], fill="black")
    d.text((398, 322), "P1", font=font(44, True), fill="white")
    barcode(d, 30, 410, 450, 200, 3)
    d.text((60, 620), "9400 1118 2954 0012 3456 78", font=font(24), fill="black")
    d.line([8, 670, 503, 670], fill="black", width=3)
    d.text((24, 688), "WT 0.4 KG   FRAGILE - PLASTIC PARTS", font=font(20), fill="black")
    im.save(OUT / "decal_label.png")


def poster():
    im = Image.new("RGB", (600, 840), (24, 27, 33))
    d = ImageDraw.Draw(im)
    d.rectangle([30, 30, 570, 810], outline=(255, 122, 26), width=6)
    d.text((300, 150), "KEEP", font=font(110, True), fill=(255, 122, 26), anchor="mm")
    d.text((300, 270), "CALM", font=font(110, True), fill=(255, 122, 26), anchor="mm")
    d.text((300, 380), "AND", font=font(60, True), fill=(235, 235, 235), anchor="mm")
    d.text((300, 500), "LEVEL", font=font(110, True), fill=(235, 235, 235), anchor="mm")
    d.text((300, 620), "YOUR BED", font=font(90, True), fill=(235, 235, 235), anchor="mm")
    for i in range(8):
        d.rectangle([120 + i * 46, 700, 150 + i * 46, 730], fill=(255, 122, 26) if i % 2 else (80, 86, 96))
    im.save(OUT / "decal_poster.png")


def outbox_sign():
    im = Image.new("RGB", (512, 160), (250, 196, 30))
    d = ImageDraw.Draw(im)
    d.rectangle([6, 6, 505, 153], outline=(20, 20, 20), width=8)
    d.text((256, 82), "OUTBOX", font=font(96, True), fill=(20, 20, 20), anchor="mm")
    im.save(OUT / "decal_outbox.png")


def tape_logo():
    im = Image.new("RGB", (512, 64), (196, 150, 92))
    d = ImageDraw.Draw(im)
    for i in range(4):
        d.text((20 + i * 128, 32), "FRAGILE", font=font(26, True), fill=(170, 30, 24), anchor="lm")
    im.save(OUT / "decal_tape.png")


def supplier_box():
    im = Image.new("RGB", (512, 512), (190, 146, 96))
    d = ImageDraw.Draw(im)
    d.text((256, 200), "FILADEPOT", font=font(64, True), fill=(30, 60, 120), anchor="mm")
    d.text((256, 270), "3D PRINTING SUPPLIES", font=font(26), fill=(30, 60, 120), anchor="mm")
    d.text((256, 380), "THIS SIDE UP  ↑↑", font=font(30, True), fill=(40, 40, 40), anchor="mm")
    im.save(OUT / "decal_supplier.png")


def calendar():
    im = Image.new("RGB", (400, 520), (248, 248, 246))
    d = ImageDraw.Draw(im)
    d.rectangle([0, 0, 400, 90], fill=(200, 40, 40))
    d.text((200, 45), "MARCH", font=font(44, True), fill="white", anchor="mm")
    for r in range(5):
        for c in range(7):
            n = r * 7 + c + 1
            if n <= 31:
                d.text((30 + c * 52, 120 + r * 78), str(n), font=font(26), fill=(40, 40, 40), anchor="mm")
    d.ellipse([176, 190, 236, 250], outline=(200, 40, 40), width=4)
    im.save(OUT / "decal_calendar.png")


for f in (shipping_label, poster, outbox_sign, tape_logo, supplier_box, calendar):
    f()
    print("decal", f.__name__)


def pegboard():
    import numpy as np
    n = 512
    yy, xx = np.mgrid[0:n, 0:n]
    pitch = n / 20  # 25.4 mm holes on a 0.5 m tile → 20 per tile
    dx = (xx % pitch) - pitch / 2
    dy = (yy % pitch) - pitch / 2
    hole = (dx * dx + dy * dy) < (pitch * 0.18) ** 2
    base = np.array([176, 132, 86], np.float32)
    img = np.ones((n, n, 3), np.float32) * base
    rng = np.random.default_rng(3)
    img *= (0.95 + rng.random((n, n, 1)) * 0.08)
    img[hole] = (25, 18, 12)
    Image.fromarray(img.clip(0, 255).astype("uint8")).save(OUT / "decal_pegboard.png")


def outside_view():
    """What you see through the garage window: bright sky, soft clouds, a neighbour's hedge and fence, defocused
    like a real interior photo (windows are out of focus and slightly over-exposed)."""
    import numpy as np
    from scipy import ndimage
    w, h = 1024, 640
    rng = np.random.default_rng(5)

    def noise(beta, seed, lo=1):
        r = np.random.default_rng(seed)
        fx = np.fft.fftfreq(w)[None, :] * w
        fy = np.fft.fftfreq(h)[:, None] * h
        f = np.sqrt(fx ** 2 + fy ** 2)
        f[0, 0] = 1
        amp = f ** (-beta / 2)
        amp[f < lo] = 0
        n = np.real(np.fft.ifft2(amp * np.exp(1j * r.uniform(0, 2 * np.pi, (h, w)))))
        return (n - n.min()) / (n.max() - n.min())

    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    t = yy / h
    sky = (1 - t[..., None]) * np.array([150, 190, 235]) + t[..., None] * np.array([225, 235, 245])
    clouds = np.clip((noise(3.2, 11) - 0.55) * 3.0, 0, 1)[..., None]
    img = sky * (1 - clouds * 0.7) + np.array([250, 250, 252]) * clouds * 0.7
    # distant tree line: noisy silhouette, leafy texture
    ridge = h * 0.42 + (noise(2.6, 12)[0] - 0.5) * 140 + (noise(1.4, 13)[0] - 0.5) * 30
    leaf = noise(1.0, 14, lo=30)
    trees = yy > ridge[None, :]
    tree_col = np.stack([70 + leaf * 60, 105 + leaf * 70, 62 + leaf * 40], -1)
    img = np.where(trees[..., None], tree_col * (0.8 + 0.4 * noise(2.5, 15)[..., None]), img)
    # wooden fence
    top = int(h * 0.6)
    plank = (xx // 46).astype(int)
    tone = rng.uniform(0.8, 1.08, plank.max() + 2)[plank]
    grain = noise(1.2, 16, lo=20)
    fence = np.stack([150 * tone * (0.9 + grain * 0.2), 112 * tone * (0.9 + grain * 0.2), 78 * tone * (0.9 + grain * 0.2)], -1)
    gap = (xx % 46) < 3
    fence[gap] *= 0.45
    fence[(yy > top + 46) & (yy < top + 58)] *= 0.75
    img = np.where((yy > top)[..., None], fence, img)
    # hedge in front
    hedge_line = h * 0.8 + (noise(2.2, 17)[0] - 0.5) * 90
    hedge = yy > hedge_line[None, :]
    hl = noise(0.9, 18, lo=40)
    hedge_col = np.stack([50 + hl * 55, 92 + hl * 70, 45 + hl * 40], -1)
    img = np.where(hedge[..., None], hedge_col, img)
    img = ndimage.gaussian_filter(img, (3.2, 3.2, 0))  # lens defocus
    img = img * 1.08 + 8  # slight over-exposure
    Image.fromarray(img.clip(0, 255).astype("uint8")).save(OUT / "decal_outside.png")


for f in (pegboard, outside_view):
    f()
    print("decal", f.__name__)


def warning_hot():
    im = Image.new("RGBA", (256, 224), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.polygon([(128, 6), (250, 218), (6, 218)], fill=(20, 20, 20))
    d.polygon([(128, 26), (230, 206), (26, 206)], fill=(255, 204, 0))
    d.text((128, 150), "!", font=font(110, True), fill=(20, 20, 20), anchor="mm")
    im.save(OUT / "decal_warning.png")


def serial_label():
    im = Image.new("RGB", (512, 256), (236, 236, 232))
    d = ImageDraw.Draw(im)
    d.rectangle([4, 4, 507, 251], outline=(60, 60, 60), width=3)
    d.text((20, 20), "MODEL: FDM-3D  220-240V~ 50/60Hz", font=font(22, True), fill=(30, 30, 30))
    d.text((20, 56), "S/N: 3D24-118-0072-EU   MFG 2024.03", font=font(20), fill=(30, 30, 30))
    barcode(d, 20, 96, 300, 90, 11)
    d.text((20, 200), "CE  ⚠  RoHS   Made in PRC", font=font(22, True), fill=(30, 30, 30))
    for i in range(6):
        for j in range(6):
            if (i * 7 + j * 3) % 5 < 3:
                d.rectangle([360 + i * 22, 100 + j * 22, 380 + i * 22, 120 + j * 22], fill=(20, 20, 20))
    im.save(OUT / "decal_serial.png")


def benchy_poster():
    im = Image.new("RGB", (600, 840), (22, 56, 104))
    d = ImageDraw.Draw(im)
    for x in range(0, 600, 30):
        d.line([x, 0, x, 840], fill=(40, 80, 132), width=1)
    for y in range(0, 840, 30):
        d.line([0, y, 600, y], fill=(40, 80, 132), width=1)
    w = (230, 238, 250)
    d.text((300, 70), "#3DBENCHY", font=font(64, True), fill=w, anchor="mm")
    d.text((300, 120), "THE JOLLY 3D PRINTING TORTURE-TEST", font=font(20), fill=w, anchor="mm")
    # side elevation of the boat
    d.polygon([(90, 520), (510, 520), (470, 610), (150, 610)], outline=w, width=4)
    d.rectangle([200, 380, 380, 520], outline=w, width=4)
    d.rectangle([220, 410, 270, 470], outline=w, width=3)
    d.rectangle([310, 410, 360, 470], outline=w, width=3)
    d.line([180, 380, 400, 360], fill=w, width=4)
    d.rectangle([260, 300, 300, 370], outline=w, width=4)
    d.line([90, 650, 510, 650], fill=w, width=2)
    d.text((300, 670), "60.00 mm", font=font(22), fill=w, anchor="mm")
    d.line([540, 300, 540, 610], fill=w, width=2)
    d.text((560, 455), "48", font=font(22), fill=w, anchor="mm")
    d.text((300, 780), "SCALE 1:1   ·   SHEET 1 OF 1", font=font(20), fill=w, anchor="mm")
    im.save(OUT / "decal_benchy.png")


def rug():
    import numpy as np
    n = 1024
    im = Image.new("RGB", (n, n), (118, 52, 40))
    d = ImageDraw.Draw(im)
    d.rectangle([40, 40, n - 40, n - 40], outline=(214, 180, 120), width=26)
    d.rectangle([110, 110, n - 110, n - 110], outline=(40, 48, 70), width=40)
    for i in range(8):
        c = 200 + i * 80
        d.polygon([(n / 2, c - 60), (n / 2 + 110, c), (n / 2, c + 60), (n / 2 - 110, c)], outline=(214, 180, 120), width=8) if c < n - 180 else None
    for k in range(0, n, 64):
        d.polygon([(k, 70), (k + 32, 40), (k + 64, 70)], fill=(40, 48, 70))
    a = np.asarray(im, np.float32)
    rng = np.random.default_rng(3)
    a *= 0.88 + rng.random((n, n, 1)) * 0.2
    Image.fromarray(a.clip(0, 255).astype("uint8")).save(OUT / "decal_rug.png")


def can_labels():
    for name, bg, fg, text in (("paint", (238, 238, 232), (190, 40, 40), "PRO-COAT\nSATIN\nWHITE"), ("paint2", (40, 70, 140), (255, 255, 255), "PRIMER\nGREY"),
                               ("spray", (230, 90, 20), (20, 20, 20), "FILLER\nPRIMER"), ("ipa", (245, 245, 245), (30, 80, 170), "IPA 99%\nISOPROPYL")):
        im = Image.new("RGB", (512, 256), bg)
        d = ImageDraw.Draw(im)
        d.rectangle([0, 0, 512, 40], fill=fg)
        d.rectangle([0, 216, 512, 256], fill=fg)
        d.multiline_text((256, 128), text, font=font(40, True), fill=fg if bg[0] > 150 else (255, 255, 255), anchor="mm", align="center")
        im.save(OUT / f"decal_{name}.png")


for f in (warning_hot, serial_label, benchy_poster, rug, can_labels):
    f()
    print("decal", f.__name__)
