"""Bambu Lab P1S reference model → in-game "Bamboo Lab P1S".

Real: 389 W x 389 D x 458 H mm, build 256^3, enclosed CoreXY, glass front door (hinged left),
removable glass top lid, carbon rods, bed moves down in Z on 3 lead screws, spool on the back.
"""
import math

import lib as L
from parts import M, fan_face, hexc, hotend, leadscrew, nema17, screw_head

AO = dict(size=2048, samples=40, distance=0.1)
PREVIEW = dict(angle=36, elev=24, dist_mul=1.05)

W = 0.389
H_SHELL = 0.44
NOZZLE_Z = 0.318        # nozzle tip height; bed top touches it at z=0
INNER = 0.35
FRONT = -W / 2


def preview_extras(root):
    from parts import spool
    L.sync()
    mount = [c for c in root.children_recursive if c.name == "SpoolMount"][0]
    return spool("preview_spool", mount.matrix_world.translation.copy(), flange_color="#2a2a2a")


def build():
    root = L.empty("p1s", size=0.1)
    root["model"] = "p1s"
    root["x_range"] = [-0.125, 0.125]
    root["y_range"] = [-0.125, 0.125]      # GantryY local three-Z (front/back)
    root["z_range"] = [0.0, 0.25]          # Bed moves DOWN (three -Y) by this much
    root["bed_size"] = [0.256, 0.256]
    root["kind"] = "corexy"
    shell_m = L.mat("P1S_Shell", hexc("#2f3133"), 0.05, 0.5, tex="micro", tex_scale=0.06)
    inner_m = L.mat("P1S_Inner", hexc("#1c1d1f"), 0.1, 0.6, tex="micro", tex_scale=0.06)
    trim_m = L.mat("P1S_Trim", hexc("#151617"), 0.1, 0.35)
    blackp = M.black_plastic()
    decal = M.white_print()
    glass = M.glass()
    frit = L.mat("GlassFrit", hexc("#0a0a0a"), 0, 0.15)
    static = []

    # ------------------------------------------------------------------ shell (hollow, with front opening)
    shell = L.prism("shell", L.rounded_rect(W, W, 0.028, 8), H_SHELL - 0.004, (0, 0, 0.004), shell_m, bevel=0.003)
    cut_in = L.box("cut_in", (INNER, INNER, 0.5), (0, 0, 0.055), None, bevel=0, origin="bottom")
    cut_front = L.box("cut_front", (0.34, 0.1, 0.33), (0, FRONT, 0.065), None, bevel=0, origin="bottom")
    for c in (cut_in, cut_front):
        bo = shell.modifiers.new("cut", "BOOLEAN")
        bo.object = c
        bo.operation = "DIFFERENCE"
        L.apply_modifiers(shell)
    for c in (cut_in, cut_front):
        L.bpy.data.objects.remove(c)
    static.append(shell)
    # interior lining, chamber floor
    static.append(L.box("floor", (INNER, INNER, 0.004), (0, 0, 0.055), inner_m, bevel=0.001, origin="bottom"))
    for sx in (-1, 1):
        static.append(L.box("liner", (0.003, INNER - 0.002, 0.37), (sx * (INNER / 2 - 0.0015), 0, 0.06), inner_m, bevel=0.0005, origin="bottom"))
    static.append(L.box("liner_back", (INNER - 0.002, 0.003, 0.37), (0, INNER / 2 - 0.0015, 0.06), inner_m, bevel=0.0005, origin="bottom"))
    # feet
    for sx in (-1, 1):
        for sy in (-1, 1):
            static.append(L.cyl("foot", 0.018, 0.006, (sx * 0.15, sy * 0.15, 0.003), M.rubber(), verts=24, bevel=0.002))
    # front lower band logo + top band with screen/buttons
    static.append(L.text("logo", "BAMBOO LAB", 0.011, 0.0004, (0.12, FRONT - 0.0002, 0.032), (math.radians(90), 0, 0), decal))
    static.append(L.box("scr_bezel", (0.088, 0.004, 0.032), (-0.11, FRONT - 0.0005, 0.415), trim_m, bevel=0.002))
    for i in range(5):
        static.append(L.cyl("btn", 0.0035, 0.003, (-0.05 + i * 0.011, FRONT - 0.002, 0.415), trim_m, verts=16,
                            rot=(math.radians(90), 0, 0), bevel=0.0008))
    scr = L.box("Screen", (0.058, 0.001, 0.024), (-0.118, FRONT - 0.0028, 0.415), M.screen(), bevel=0.0002)
    led = L.box("StatusLED", (0.05, 0.002, 0.003), (0.12, FRONT - 0.0006, 0.415), M.led(), bevel=0.0005)
    # top rim + lid (glass with black frit border)
    lid = [L.box("lid_glass", (W - 0.012, W - 0.012, 0.004), (0, 0, H_SHELL + 0.002), glass, bevel=0.0015)]
    frame_pts = L.rounded_rect(W - 0.012, W - 0.012, 0.02)
    lf = L.prism("lid_frit", frame_pts, 0.0012, (0, 0, H_SHELL + 0.0041), frit, bevel=0.0003)
    lcut = L.box("lid_cut", (W - 0.06, W - 0.06, 0.02), (0, 0, H_SHELL), None, bevel=0)
    bo = lf.modifiers.new("cut", "BOOLEAN"); bo.object = lcut; bo.operation = "DIFFERENCE"
    L.apply_modifiers(lf)
    L.bpy.data.objects.remove(lcut)
    lid.append(lf)
    # back: exhaust grille, power socket, spool holder, PTFE entry
    BACK = W / 2
    for k in range(8):
        static.append(L.box("exhaust", (0.11, 0.003, 0.005), (0.08, BACK + 0.0005, 0.2 + k * 0.012),
                            L.mat("VentDark", (0.004,) * 3, 0, 0.9), bevel=0.001))
    static.append(L.box("power", (0.03, 0.004, 0.04), (-0.13, BACK + 0.001, 0.06), trim_m, bevel=0.002))
    static.append(L.box("spool_bracket", (0.05, 0.03, 0.03), (-0.06, BACK + 0.012, 0.24), trim_m, bevel=0.004))
    static.append(L.cyl("spool_shaft", 0.013, 0.09, (-0.06, BACK + 0.06, 0.245), trim_m, verts=24,
                        rot=(math.radians(90), 0, 0), bevel=0.001))
    spool_c = (-0.06, BACK + 0.075, 0.245 - 0.012)
    static.append(L.box("ptfe_port", (0.02, 0.012, 0.012), (0.12, BACK + 0.004, H_SHELL - 0.03), trim_m, bevel=0.002))
    # inside: chamber LED bar, aux fan on left wall, lead screws, rods
    static.append(L.box("ChamberLight", (0.2, 0.008, 0.004), (0, FRONT + 0.03, 0.428),
                        L.mat("ChamberLight", hexc("#fff7e8"), 0, 0.3, emission=hexc("#fff1dc"), emission_strength=6), bevel=0.001))
    static.append(fan_face("auxfan", 0.11, (-(INNER / 2 - 0.006), 0.02, 0.25), rot=(0, 0, math.radians(-90)), depth=0.01,
                           body_mat=inner_m))
    screws = [(-0.15, -0.125), (0.15, -0.125), (0.0, 0.155)]
    for x, y in screws:
        static.append(leadscrew("zscrew", (x, y, 0.06), 0.34, r=0.004))
        static.append(L.cyl("zrodg", 0.004, 0.34, (x + (0.02 if x <= 0 else -0.02), y, 0.23), M.steel(), verts=12))
    static.append(nema17("zmotor", (0.0, 0.155, 0.035), length=0.03))
    # CoreXY Y rods (carbon) and corner motors/pulleys at the top
    RZ = 0.395
    for sx in (-1, 1):
        static.append(L.cyl("yrod", 0.004, INNER - 0.03, (sx * 0.158, 0, RZ), M.carbon(), verts=16,
                            rot=(math.radians(90), 0, 0)))
        for sy in (-1, 1):
            static.append(L.box("corner", (0.03, 0.03, 0.03), (sx * 0.158, sy * 0.16, RZ), trim_m, bevel=0.003))
        static.append(nema17("xymotor", (sx * 0.155, 0.16, RZ + 0.03), length=0.035, rot=(math.radians(180), 0, 0)))

    L.uv_all(static, 0.3)
    L.uv_all([scr, led], 0.05)
    L.join(static, "body", root)
    for o in (scr, led):
        o.parent = root
    L.uv_all(lid, 0.4)
    L.join(lid, "lid", root)

    # ------------------------------------------------------------------ door (pivot at the left hinge)
    door = L.empty("Door", (-0.177, FRONT - 0.004, 0.23), root)
    dg = L.box("door_glass", (0.355, 0.004, 0.338), (0.0, FRONT - 0.004, 0.23), glass, bevel=0.0015)
    dfr = L.prism("door_frit", L.rounded_rect(0.355, 0.338, 0.008), 0.001, (0, FRONT - 0.0062, 0.23), frit, bevel=0.0002,
                  axis="y")
    dcut = L.prism("door_cut", L.rounded_rect(0.31, 0.29, 0.012), 0.02, (0, FRONT + 0.005, 0.23), None, bevel=0,
                   axis="y")
    bo = dfr.modifiers.new("cut", "BOOLEAN"); bo.object = dcut; bo.operation = "DIFFERENCE"
    L.apply_modifiers(dfr)
    L.bpy.data.objects.remove(dcut)
    # fix prism z-offset (prism extrudes 2D y → world z around 0, shift to door centre)
    handle = L.box("door_handle", (0.012, 0.012, 0.16), (0.165, FRONT - 0.013, 0.23), trim_m, bevel=0.004, segments=3)
    hinge = [L.cyl("hinge", 0.004, 0.03, (-0.177, FRONT - 0.004, z), trim_m, verts=12) for z in (0.09, 0.37)]
    L.uv_all([dg, dfr, handle] + hinge, 0.4)
    L.join([dg], "door_glass", door)
    L.join([dfr, handle] + hinge, "door_frame", door)

    # ------------------------------------------------------------------ bed (moves down)
    bed = L.empty("Bed", (0, 0, 0), root)
    bt = NOZZLE_Z
    bp = [
        L.box("bed_frame", (0.3, 0.3, 0.012), (0, 0, bt - 0.016), trim_m, bevel=0.003),
        L.box("heatbed", (0.27, 0.27, 0.004), (0, 0, bt - 0.0035), L.mat("HeatbedBlack", hexc("#141516"), 0.3, 0.4), bevel=0.001),
    ]
    for x, y in screws:
        bp.append(L.cyl("znut", 0.012, 0.016, (x, y, bt - 0.02), M.brass(), verts=16))
    plate = L.box("plate", (0.257, 0.257, 0.0008), (0, 0, bt - 0.0004), M.pei_gold(), bevel=0.0003)
    tab = L.prism("plate_tab", [(-0.02, 0), (0.02, 0), (0.014, -0.01), (-0.014, -0.01)], 0.0008,
                  (0, -0.1285, bt - 0.0008), M.pei_gold(), bevel=0.0002)
    L.uv_all(bp, 0.3)
    L.uv_all([plate, tab], 0.26)
    L.join(bp, "bed_body", bed)
    L.join([plate, tab], "bed_surface", bed)
    L.empty("PrintOrigin", (0, 0, bt), bed)

    # ------------------------------------------------------------------ gantry Y (X rods) + toolhead
    gy = L.empty("GantryY", (0, 0, 0), root)
    gp = []
    for dz in (-0.0, 0.0):
        pass
    gp.append(L.cyl("xrod", 0.005, 0.3, (0, 0.012, RZ), M.carbon(), verts=16, rot=(0, math.radians(90), 0)))
    gp.append(L.cyl("xrod2", 0.004, 0.3, (0, 0.012, RZ - 0.028), M.steel(), verts=16, rot=(0, math.radians(90), 0)))
    for sx in (-1, 1):
        gp.append(L.box("ycarriage", (0.032, 0.05, 0.045), (sx * 0.158, 0.012, RZ - 0.01), trim_m, bevel=0.004))
    L.uv_all(gp, 0.3)
    L.join(gp, "gantry_y", gy)
    cx = L.empty("CarriageX", (0, 0, 0), gy)
    t = NOZZLE_Z
    cover = L.mat("P1S_HeadCover", hexc("#d9dadc"), 0, 0.35, tex="micro", tex_scale=0.05)
    tp = [
        L.box("th_body", (0.062, 0.05, 0.085), (0, 0.0, t + 0.058), trim_m, bevel=0.006),
        L.box("th_cover", (0.066, 0.014, 0.088), (0, -0.028, t + 0.057), cover, bevel=0.008, segments=3),
        L.box("th_carriage", (0.07, 0.03, 0.05), (0, 0.02, RZ - 0.014), trim_m, bevel=0.004),
        L.box("th_duct", (0.05, 0.04, 0.01), (0, -0.004, t + 0.014), trim_m, bevel=0.002),
        L.cyl("th_inlet", 0.005, 0.012, (0, 0.01, t + 0.105), trim_m, verts=12),
    ]
    for k in range(5):
        tp.append(L.box("th_vent", (0.036, 0.002, 0.003), (0, -0.0352, t + 0.085 - k * 0.007),
                        L.mat("VentDark", (0.004,) * 3, 0, 0.9), bevel=0.0006))
    tp.append(fan_face("th_fan", 0.04, (-0.034, 0.0, t + 0.05), rot=(0, 0, math.radians(-90)), depth=0.006, body_mat=trim_m))
    tp.append(L.text("th_logo", "B", 0.012, 0.0003, (0, -0.0352, t + 0.03), (math.radians(90), 0, 0), trim_m))
    tp.append(hotend("th_hotend", (0, 0, t)))
    L.uv_all(tp, 0.1)
    L.join(tp, "toolhead", cx)
    L.empty("Nozzle", (0, 0, t), cx)
    L.empty("ToolheadInlet", (0, 0.01, t + 0.112), cx)
    L.empty("FilamentEntry", (0.12, BACK - 0.01, H_SHELL - 0.03), root)
    L.empty("SpoolMount", spool_c, root)
    from parts import sticker
    sticker("warn_front", "decal_warning.png", 0.022, 0.019, (-0.15, FRONT - 0.0009, 0.034), (math.radians(90), 0, 0)).parent = root
    sticker("serial", "decal_serial.png", 0.08, 0.04, (0.05, BACK + 0.0009, 0.1), (math.radians(90), 0, math.radians(180))).parent = root
    sticker("warn_head", "decal_warning.png", 0.012, 0.0105, (0.024, -0.0354, t + 0.072), (math.radians(90), 0, 0)).parent = cx
    L.empty("Camera", (-0.15, FRONT + 0.02, 0.41), root)  # built-in chamber camera (Farm app live view)
    return root
