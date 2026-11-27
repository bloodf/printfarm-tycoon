"""Reusable real-world printer parts (dimensions from the actual components)."""
from __future__ import annotations

import math

from mathutils import Vector

import lib as L


def hexc(h):
    """sRGB hex → linear RGB tuple (Blender colours are linear)."""
    h = h.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


# ----------------------------------------------------------------------------- shared material palette
class M:
    @staticmethod
    def black_plastic():
        return L.mat("BlackPlastic", hexc("#1d1e20"), 0, 0.46, tex="plastic", tex_scale=0.08)

    @staticmethod
    def graphite():
        return L.mat("Graphite", hexc("#2c2e31"), 0.25, 0.5, tex="powder", tex_scale=0.25)

    @staticmethod
    def anod_dark():
        return L.mat("AnodisedDark", hexc("#2a2b2e"), 0.75, 0.38, tex="brushed", tex_scale=0.2, albedo=False)

    @staticmethod
    def alu():
        return L.mat("Aluminium", hexc("#c9ccd0"), 1.0, 0.3, tex="brushed", tex_scale=0.15, albedo=False)

    @staticmethod
    def steel():
        return L.mat("SteelRod", hexc("#d9dbde"), 1.0, 0.12)

    @staticmethod
    def dark_steel():
        return L.mat("DarkSteel", hexc("#3b3d40"), 1.0, 0.35)

    @staticmethod
    def brass():
        return L.mat("Brass", hexc("#c9a04a"), 1.0, 0.28)

    @staticmethod
    def rubber():
        return L.mat("Rubber", hexc("#181818"), 0, 0.85, tex="rubber", tex_scale=0.1, albedo=False)

    @staticmethod
    def belt():
        return L.mat("Belt", hexc("#111111"), 0, 0.7)

    @staticmethod
    def white_print():
        return L.mat("DecalWhite", hexc("#e9eaec"), 0, 0.5)

    @staticmethod
    def screen():
        return L.mat("Screen", hexc("#05070a"), 0, 0.15, emission=hexc("#10161e"), emission_strength=1.0)

    @staticmethod
    def led():
        return L.mat("LED", hexc("#dfffe6"), 0, 0.3, emission=hexc("#3dff7a"), emission_strength=3.0)

    @staticmethod
    def pei_gold():
        return L.mat("PEI_Gold", (1, 1, 1), 0.35, 0.5, tex="pei", tex_scale=0.26, normal_strength=0.6)

    @staticmethod
    def pei_black():
        return L.mat("PEI_Black", (1, 1, 1), 0.2, 0.55, tex="peiblack", tex_scale=0.24, normal_tex=False)

    @staticmethod
    def heater_red():
        return L.mat("HeaterPCB", hexc("#7a1a12"), 0, 0.5)

    @staticmethod
    def filament_strand():
        return L.mat("Filament_Strand", hexc("#e8e8e8"), 0, 0.35)

    @staticmethod
    def ptfe():
        return L.mat("PTFE", hexc("#f1f1ee"), 0, 0.25, alpha=0.85)

    @staticmethod
    def cable():
        return L.mat("Cable", hexc("#141414"), 0, 0.5)

    @staticmethod
    def glass():
        return L.mat("Glass", hexc("#a9b4b8"), 0, 0.04, transmission=1.0, ior=1.5)

    @staticmethod
    def carbon():
        return L.mat("Carbon", (1, 1, 1), 0.2, 0.3, tex="carbon", tex_scale=0.05)


# ----------------------------------------------------------------------------- parts
def nema17(name, loc, length=0.04, rot=(0, 0, 0), shaft_dir=1):
    """Stepper: black stack with silver end-caps, shaft along local +Z."""
    s = 0.0423
    parts = [
        L.box(name + "_body", (s, s, length * 0.6), (0, 0, 0), M.black_plastic(), bevel=0.003),
        L.box(name + "_cap1", (s, s, length * 0.2), (0, 0, length * 0.4), M.alu(), bevel=0.004),
        L.box(name + "_cap2", (s, s, length * 0.2), (0, 0, -length * 0.4), M.alu(), bevel=0.004),
        L.cyl(name + "_boss", 0.011, 0.002, (0, 0, length * 0.5 + 0.001), M.alu(), verts=24),
        L.cyl(name + "_shaft", 0.0025, 0.02, (0, 0, length * 0.5 + 0.01), M.steel(), verts=12),
        L.box(name + "_conn", (0.016, 0.006, 0.008), (0, -s / 2 - 0.002, -length * 0.1), M.white_print(), bevel=0.0005),
    ]
    for sx in (-1, 1):
        for sy in (-1, 1):
            parts.append(L.cyl(name + "_scr", 0.0015, 0.0008, (sx * 0.0155, sy * 0.0155, length * 0.5 + 0.0004),
                               M.dark_steel(), verts=8))
    ob = L.join(parts, name)
    ob.rotation_euler = rot
    ob.location = loc
    return ob


def fan_face(name, size, loc, rot=(0, 0, 0), body_mat=None, blade_mat=None, depth=0.01):
    """Axial fan seen from the front: frame + hub + blades + grille rings. Faces local -Y."""
    body_mat = body_mat or M.black_plastic()
    blade_mat = blade_mat or M.black_plastic()
    r = size * 0.46
    parts = [
        L.prism(name + "_frame", L.rounded_rect(size, size, size * 0.12), depth, material=body_mat, axis="y",
                bevel=0.0008),
    ]
    # hollow look: dark disc recessed
    parts.append(L.cyl(name + "_hole", r, depth * 0.2, (0, -depth * 0.15, 0), L.mat("FanVoid", (0.01, 0.01, 0.01), 0, 0.9),
                       verts=32, rot=(math.radians(90), 0, 0)))
    parts.append(L.cyl(name + "_hub", r * 0.38, depth * 0.9, (0, -depth * 0.55, 0), blade_mat, verts=24,
                       rot=(math.radians(90), 0, 0)))
    for i in range(7):
        a = 2 * math.pi * i / 7
        b = L.box(name + "_blade", (r * 0.62, 0.0008, r * 0.28), (0, 0, 0), blade_mat, bevel=0.0003)
        b.rotation_euler = (0.35, a, 0)
        b.location = (math.cos(a) * r * 0.62, -depth * 0.6, math.sin(a) * r * 0.62)
        b.rotation_euler = (0, -a, 0)
        parts.append(b)
    for k in (0.55, 0.85):
        parts.append(L.torus(name + "_ring", r * k, 0.0007, (0, -depth * 1.02, 0), M.dark_steel(),
                             rot=(math.radians(90), 0, 0), major=32, minor=6))
    ob = L.join(parts, name)
    ob.location = loc
    ob.rotation_euler = rot
    return ob


def hotend(name, loc, block_mat=None, sock=True):
    """Heater block + silicone sock + brass nozzle. Nozzle tip at local (0,0,0)."""
    block_mat = block_mat or M.alu()
    parts = [
        L.box(name + "_block", (0.02, 0.016, 0.011), (0, 0, 0.0115), block_mat, bevel=0.0008),
        L.cyl(name + "_nozzle_hex", 0.0042, 0.0035, (0, 0, 0.0045), M.brass(), verts=6, bevel=0.0003),
        L.cyl(name + "_nozzle_tip", 0.003, 0.0028, (0, 0, 0.0014), M.brass(), verts=16, r2=0.0008),
        L.cyl(name + "_heatbreak", 0.0035, 0.014, (0, 0, 0.024), M.steel(), verts=16),
    ]
    if sock:
        parts.append(L.box(name + "_sock", (0.0225, 0.0185, 0.0125), (0, 0, 0.0115),
                           L.mat("SiliconeSock", hexc("#262626"), 0, 0.75), bevel=0.002, segments=3))
    ob = L.join(parts, name)
    ob.location = loc
    return ob


def knob(name, r, h, loc, rot=(0, 0, 0), mat=None):
    mat = mat or M.black_plastic()
    parts = [L.cyl(name, r, h, (0, 0, h / 2), mat, verts=32, bevel=0.0012)]
    for i in range(18):  # knurl ridges
        a = 2 * math.pi * i / 18
        parts.append(L.box(name + "_k", (0.0012, 0.0012, h * 0.8), (math.cos(a) * r, math.sin(a) * r, h / 2), mat,
                           bevel=0.0003))
    ob = L.join(parts, name)
    ob.location = loc
    ob.rotation_euler = rot
    return ob


def belt_loop(name, p0, p1, width=0.006, th=0.0014, gap=0.009, axis="x"):
    """Two parallel belt runs between p0 and p1 (top/bottom), straight."""
    p0, p1 = Vector(p0), Vector(p1)
    length = (p1 - p0).length
    c = (p0 + p1) / 2
    parts = []
    for dz in (gap / 2, -gap / 2):
        if axis == "x":
            parts.append(L.box(name, (length, th, width), (c.x, c.y, c.z + dz), M.belt(), bevel=0.0002))
        else:
            parts.append(L.box(name, (th, length, width), (c.x, c.y, c.z + dz), M.belt(), bevel=0.0002))
    return parts


def screw_head(name, loc, r=0.0022, rot=(0, 0, 0), mat=None):
    return L.cyl(name, r, 0.0016, loc, mat or M.dark_steel(), verts=12, rot=rot, bevel=0.0004)


def leadscrew(name, loc, length, r=0.004):
    """Trapezoidal lead screw, represented as a rod with a subtle ridged material."""
    return L.cyl(name, r, length, loc, L.mat("LeadScrew", hexc("#b9b7b2"), 1, 0.28), verts=16, origin="bottom")


def spool_stub(name, loc, axis="y"):
    """The bare spool holder shaft (spool GLB is attached at runtime to SpoolMount)."""
    rot = (math.radians(90), 0, 0) if axis == "y" else (0, math.radians(90), 0)
    return L.cyl(name, 0.014, 0.09, loc, M.black_plastic(), verts=24, rot=rot, bevel=0.001)


def spool(name="spool", loc=(0, 0, 0), flange_color="#1a1a1a", label=True):
    """1 kg filament spool, axis along Blender Y (three.js -Z), origin at hub centre.

    Children: `<name>_reel` (static plastic) and `FilamentWinding` (material "Filament", scaled radially
    at runtime to show grams left; full = scale 1).
    """
    root = L.empty(name, (0, 0, 0), size=0.05)  # built at the origin, moved to `loc` at the end
    R, W, HUB = 0.100, 0.066, 0.0265
    flange_m = L.mat("SpoolFlange", hexc(flange_color), 0, 0.35, tex="micro", tex_scale=0.05)
    parts = []
    for sy in (-1, 1):
        # flange: disc with raised outer rim and stiffening rings (lathe profile in r,z → rotate so axis=Y)
        prof = [(HUB, -0.0015), (R - 0.004, -0.0015), (R, -0.001), (R, 0.0015), (R - 0.004, 0.0025),
                (R - 0.006, 0.0015), (0.072, 0.0015), (0.071, 0.0028), (0.066, 0.0028), (0.065, 0.0015),
                (0.042, 0.0015), (0.041, 0.003), (HUB + 0.004, 0.003), (HUB, 0.0015), (HUB, -0.0015)]
        prof = [(r, z * sy) for r, z in prof]
        f = L.lathe(name + "_flange", prof, material=flange_m, verts=64, smooth_angle=40)
        f.rotation_euler = (math.radians(90), 0, 0)
        f.location = (0, sy * (W / 2 + 0.0015), 0)
        parts.append(f)
        # window cut-outs: dark annular-sector inserts, flush with the flange face
        for i in range(5):
            a0 = 2 * math.pi * i / 5 + 0.2
            pts = []
            for k in range(7):
                a = a0 + math.radians(44) * k / 6
                pts.append((math.cos(a) * 0.079, math.sin(a) * 0.079))
            for k in range(7):
                a = a0 + math.radians(44) * (6 - k) / 6
                pts.append((math.cos(a) * 0.046, math.sin(a) * 0.046))
            win = L.prism(name + "_win", pts, 0.0009, (0, sy * (W / 2 + 0.0026) + 0.00045, 0),
                          L.mat("SpoolWindow", hexc("#070707"), 0, 0.25), bevel=0.0003, axis="y")
            parts.append(win)
    core = L.cyl(name + "_core", 0.05, W, (0, 0, 0), L.mat("SpoolCore", hexc("#b98b55"), 0, 0.8, tex="cardboard", tex_scale=0.2),
                 verts=48, rot=(math.radians(90), 0, 0))
    hub = L.cyl(name + "_hub", HUB + 0.002, W + 0.004, (0, 0, 0), flange_m, verts=32, rot=(math.radians(90), 0, 0))
    parts += [core, hub]
    if label:
        lab = L.box(name + "_label", (0.045, 0.0006, 0.028), (0.0, -(W / 2 + 0.0034), 0.078),
                    L.mat("SpoolLabel", hexc("#f4f4f2"), 0, 0.5), bevel=0.0003)
        parts.append(lab)
        parts.append(L.text(name + "_labeltxt", "PLA  1.75", 0.0065, 0.0002, (0, -(W / 2 + 0.0038), 0.081),
                            (math.radians(90), 0, 0), L.mat("Ink", hexc("#222222"), 0, 0.5)))
        parts.append(L.text(name + "_labeltxt2", "1 kg", 0.0055, 0.0002, (0, -(W / 2 + 0.0038), 0.071),
                            (math.radians(90), 0, 0), L.mat("Ink", hexc("#222222"), 0, 0.5)))
    L.uv_all(parts, 0.1)
    reel = L.join(parts, name + "_reel", root)
    # wound filament: ridged lathe (one ridge per ~1.75 mm strand row) between the flanges
    prof = []
    rows = 36
    Rw = 0.088
    for i in range(rows + 1):
        z = -W / 2 + 0.001 + (W - 0.002) * i / rows
        prof.append((Rw - 0.0006, z))
        if i < rows:
            prof.append((Rw, z + (W - 0.002) / rows / 2))
    prof = [(0.05, -W / 2 + 0.001)] + prof + [(0.05, W / 2 - 0.001)]
    wind = L.lathe("FilamentWinding", prof, material=L.mat("Filament", hexc("#e6e6e6"), 0, 0.32), verts=64,
                   smooth_angle=80)
    wind.rotation_euler = (math.radians(90), 0, 0)
    L.uv_all([wind], 0.05)
    wind.parent = root
    root.location = loc
    return root


def sticker(name, image, w, h, loc, rot):
    """Thin adhesive label (decal quad lifted 0.3 mm off the surface)."""
    return L.decal(name, w, h, loc, rot, image, rough=0.45)
