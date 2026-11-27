"""Prusa XL (5-toolhead) → in-game "Prusla XL 5T".

Reference: CoreXY, 360 x 360 x 360 mm build, segmented heatbed (16 tiles) that moves down in Z, up to five
Nextruder toolheads parked in a rear dock, side spool holders, xLCD at the front. Black frame, orange printed parts.
Size class XL: stands on its own rolling cart.
Rig extras: Tool_0..4, ToolColor_0..4 / ToolColor_Active, SpoolMount_0..4 (axis along X).
"""
import math

import lib as L
from parts import M, fan_face, hexc, hotend, knob, leadscrew, nema17, sticker

AO = dict(size=2048, samples=36, distance=0.1)
PREVIEW = dict(angle=32, elev=20, dist_mul=1.0)

W, D, H = 0.66, 0.6, 0.8
NOZZLE_Z = 0.6
RZ = 0.71


def preview_extras(root):
    from parts import spool
    L.sync()
    for m in sorted([c for c in root.children_recursive if c.name.startswith("SpoolMount_")], key=lambda c: c.name):
        sp = spool("pv_" + m.name, m.matrix_world.translation.copy(), flange_color="#202020")
        sp.rotation_euler = m.matrix_world.to_euler()
        sp.parent = root
    return None


def orange():
    return L.mat("PrusaOrange", hexc("#ff5512"), 0, 0.42, tex="plastic", tex_scale=0.05)


def nextruder(name, x, y, z, ring_mat, active=False):
    blackp = M.black_plastic()
    p = [L.box(name + "_body", (0.05, 0.04, 0.085), (x, y, z + 0.07), blackp, bevel=0.006, segments=3),
         L.box(name + "_face", (0.046, 0.006, 0.06), (x, y - 0.022, z + 0.075), orange(), bevel=0.003),
         L.box(name + "_lever", (0.016, 0.03, 0.024), (x + 0.014, y + 0.002, z + 0.121), orange(), bevel=0.004),
         L.torus(name + "_ring", 0.009, 0.002, (x, y - 0.0255, z + 0.095), ring_mat, rot=(math.radians(90), 0, 0), major=20, minor=8),
         hotend(name + "_hotend", (x, y, z))]
    if active:
        p.append(fan_face(name + "_fan", 0.04, (x - 0.026, y, z + 0.07), rot=(0, 0, math.radians(-90)), depth=0.008))
    return p


def build():
    root = L.empty("xl", size=0.1)
    root["model"] = "xl"
    root["x_range"] = [-0.17, 0.17]
    root["y_range"] = [-0.17, 0.17]
    root["z_range"] = [0.0, 0.36]
    root["bed_size"] = [0.36, 0.36]
    root["kind"] = "corexy"
    root["tools"] = 5
    frame_m = L.mat("XL_Frame", hexc("#1b1c1e"), 0.5, 0.42, tex="powder", tex_scale=0.25)
    blackp = M.black_plastic()
    org = orange()
    decal = M.white_print()
    static = []
    # ------------------------------------------------------------------ frame
    for sx in (-1, 1):
        for sy in (-1, 1):
            static.append(L.box("post", (0.04, 0.04, H - 0.04), (sx * (W / 2 - 0.02), sy * (D / 2 - 0.02), 0.04), frame_m, bevel=0.004, origin="bottom"))
            static.append(L.box("corner", (0.07, 0.07, 0.05), (sx * (W / 2 - 0.03), sy * (D / 2 - 0.03), H - 0.05), org, bevel=0.008, origin="bottom"))
            static.append(L.cyl("foot", 0.025, 0.02, (sx * (W / 2 - 0.03), sy * (D / 2 - 0.03), 0.0), M.rubber(), verts=16, origin="bottom"))
    for z in (0.04, H - 0.04):
        for sy in (-1, 1):
            static.append(L.box("rail_x", (W - 0.06, 0.04, 0.04), (0, sy * (D / 2 - 0.02), z), frame_m, bevel=0.004))
        for sx in (-1, 1):
            static.append(L.box("rail_y", (0.04, D - 0.06, 0.04), (sx * (W / 2 - 0.02), 0, z), frame_m, bevel=0.004))
    static.append(L.box("base_plate", (W - 0.05, D - 0.05, 0.012), (0, 0, 0.04), frame_m, bevel=0.003, origin="bottom"))
    static.append(L.text("logo", "PRUSLA XL", 0.024, 0.0005, (0.12, -D / 2 - 0.0003, H - 0.04), (math.radians(90), 0, 0), org))
    # xLCD on the front-left base
    lcd = [L.box("lcd_housing", (0.15, 0.035, 0.065), (0, 0, 0), blackp, bevel=0.006),
           L.box("lcd_bezel", (0.084, 0.002, 0.055), (-0.025, -0.0182, 0.0), L.mat("Bezel", hexc("#0b0b0c"), 0, 0.2), bevel=0.0008),
           knob("lcd_knob", 0.013, 0.014, (0.047, -0.017, 0.004), rot=(math.radians(90), 0, 0), mat=org)]
    lcdj = L.join(lcd, "lcd")
    scr = L.offset_mesh(L.box("Screen", (0.076, 0.001, 0.048), (0, 0, 0), M.screen(), bevel=0.0002), (-0.025, -0.0195, 0.0))
    for o in (lcdj, scr):
        o.rotation_euler = (math.radians(-18), 0, 0)
        o.location = (-0.2, -D / 2 - 0.02, 0.1)
    # Z: three lead screws, motors
    for x, y in ((-0.24, -0.2), (0.24, -0.2), (0.0, 0.22)):
        static.append(leadscrew("zscrew", (x, y, 0.05), 0.64))
        static.append(nema17("zmotor", (x, y, 0.075), length=0.035))
    # CoreXY top
    for sx in (-1, 1):
        static.append(L.box("ylinear", (0.02, D - 0.1, 0.015), (sx * 0.27, 0, RZ + 0.02), M.alu(), bevel=0.002))
        static.append(nema17("xymotor", (sx * 0.27, D / 2 - 0.06, RZ + 0.05), length=0.04, rot=(math.radians(180), 0, 0)))
    # rear tool dock (5 parking slots) + cable/PTFE bundle
    dock_y = D / 2 - 0.07
    static.append(L.box("dock_beam", (W - 0.1, 0.02, 0.03), (0, dock_y + 0.035, RZ - 0.03), frame_m, bevel=0.004))
    sleeve = L.mat("TextileSleeve", hexc("#161616"), 0, 0.8, tex="carbon", tex_scale=0.02, albedo=False)
    # side spool holders: 2 left, 3 right (axis along X)
    spools = []
    for i, (sx, y) in enumerate(((-1, -0.13), (-1, 0.13), (1, -0.19), (1, 0.0), (1, 0.19))):
        x = sx * (W / 2 + 0.05)
        static.append(L.box("holder", (0.05, 0.03, 0.04), (sx * (W / 2 + 0.015), y, 0.5), blackp, bevel=0.005))
        static.append(L.cyl("holder_shaft", 0.013, 0.085, (x, y, 0.5), blackp, verts=20, rot=(0, math.radians(90), 0), bevel=0.001))
        spools.append((x + sx * 0.01, y, 0.5 - 0.013))
        static.append(L.tube_path(f"ptfe{i}", [(x, y, 0.62), (sx * (W / 2 - 0.02), y * 0.5, H + 0.06), (-0.2 + i * 0.1, dock_y, H + 0.01)], 0.0022, M.ptfe()))
    for i in range(5):
        static.append(L.tube_path(f"sleeve{i}", [(-0.2 + i * 0.1, dock_y + 0.02, RZ + 0.05), (-0.2 + i * 0.1, dock_y + 0.05, H + 0.04)], 0.005, sleeve))
    L.uv_all(static + [lcdj], 0.3)
    L.join(static, "frame", root)
    for o in (lcdj, scr):
        o.parent = root
    L.uv_all([scr], 0.05)
    # parked toolheads
    for i in range(5):
        ring = L.mat(f"ToolColor_{i}", hexc(f"#{0xdd - i:02x}dddd"), 0, 0.3, emission=hexc("#ffffff"), emission_strength=1.2)
        tn = L.empty(f"Tool_{i}", (0, 0, 0), root)
        hp = nextruder(f"tool{i}", -0.2 + i * 0.1, dock_y, RZ - 0.15, ring)
        L.uv_all(hp, 0.1)
        L.join(hp, f"tool{i}_mesh", tn)
    # ------------------------------------------------------------------ segmented bed (moves down)
    bed = L.empty("Bed", (0, 0, 0), root)
    bt = NOZZLE_Z
    bp = [L.box("bed_frame", (0.56, 0.5, 0.02), (0, 0, bt - 0.025), frame_m, bevel=0.004),
          L.box("heatbed", (0.38, 0.38, 0.006), (0, 0, bt - 0.005), L.mat("HeatbedBlack", hexc("#141516"), 0.3, 0.4), bevel=0.002)]
    for x, y in ((-0.24, -0.2), (0.24, -0.2), (0.0, 0.22)):
        bp.append(L.cyl("znut", 0.013, 0.02, (x, y, bt - 0.03), M.brass(), verts=16))
    plate = L.box("plate", (0.365, 0.365, 0.0008), (0, 0, bt - 0.0004), M.pei_gold(), bevel=0.0003)
    grid = []
    for k in range(1, 4):  # faint tile seams of the segmented heatbed showing through the sheet
        off = -0.1825 + k * 0.365 / 4
        grid.append(L.box("seam_x", (0.365, 0.0015, 0.0002), (0, off, bt + 0.0001), L.mat("BedSeam", hexc("#8a6a34"), 0.3, 0.5), bevel=0))
        grid.append(L.box("seam_y", (0.0015, 0.365, 0.0002), (off, 0, bt + 0.0001), L.mat("BedSeam", hexc("#8a6a34"), 0.3, 0.5), bevel=0))
    L.uv_all(bp + grid, 0.3)
    L.uv_all([plate], 0.36)
    L.join(bp, "bed_body", bed)
    L.join([plate] + grid, "bed_surface", bed)
    L.empty("PrintOrigin", (0, 0, bt), bed)
    # ------------------------------------------------------------------ gantry + active Nextruder
    gy = L.empty("GantryY", (0, 0, 0), root)
    gp = [L.box("xbeam", (0.56, 0.03, 0.03), (0, 0.02, RZ), L.mat("BeamGrey", hexc("#45484c"), 0.6, 0.35, tex="brushed", tex_scale=0.2, albedo=False), bevel=0.004)]
    for sx in (-1, 1):
        gp.append(L.box("ycarriage", (0.05, 0.06, 0.045), (sx * 0.27, 0.02, RZ + 0.005), org, bevel=0.006))
    L.uv_all(gp, 0.3)
    L.join(gp, "gantry", gy)
    cx = L.empty("CarriageX", (0, 0, 0), gy)
    t = NOZZLE_Z
    carr = [L.box("carriage_plate", (0.08, 0.02, 0.07), (0, 0.028, RZ - 0.03), M.alu(), bevel=0.003)]
    carr += nextruder("active", 0, 0.0, t, L.mat("ToolColor_Active", hexc("#dddddd"), 0, 0.3, emission=hexc("#ffffff"), emission_strength=1.2), active=True)
    L.uv_all(carr, 0.1)
    L.join(carr, "toolhead", cx)
    L.empty("Nozzle", (0, 0, t), cx)
    L.empty("ToolheadInlet", (0, 0.002, t + 0.13), cx)
    for i, (x, y, z) in enumerate(spools):
        m = L.empty(f"SpoolMount_{i}", (x, y, z), root)
        m.rotation_euler = (0, 0, math.radians(90))
    L.empty("FilamentEntry", (0, dock_y, H + 0.02), root)
    sticker("warn_front", "decal_warning.png", 0.026, 0.023, (0.25, -D / 2 - 0.0003, 0.06), (math.radians(90), 0, 0)).parent = root
    sticker("serial", "decal_serial.png", 0.09, 0.045, (0, D / 2 + 0.0003, 0.06), (math.radians(90), 0, math.radians(180))).parent = root
    led = L.box("StatusLED", (0.014, 0.002, 0.005), (-0.13, -D / 2 - 0.038, 0.085), M.led(), bevel=0.0005)
    led.parent = root
    return root
