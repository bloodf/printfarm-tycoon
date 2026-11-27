"""Prusa MK4 reference model → in-game "Prusla MK4".

Real: ~500 W x 550 D x 400 H mm, build 250x210x220. Black upright frame, orange printed parts,
aluminium Y-frame, 8 mm smooth rods, MK52 magnetic heatbed + textured PEI sheet, Nextruder,
xLCD (front), xBuddy box (right), spool holder on top of the frame.
"""
import math

import lib as L
from parts import M, belt_loop, fan_face, hexc, hotend, knob, leadscrew, nema17, screw_head

AO = dict(size=2048, samples=40, distance=0.08)
PREVIEW = dict(angle=34, elev=20, dist_mul=1.05)

BED_TOP = 0.095
NY = -0.06            # nozzle Y (world); bed is centred under it at bed_range 0
FRAME_Y = 0.0
FX, FZ0, FZ1 = 0.235, 0.015, 0.415      # frame outer half-width / bottom / top
OX, OZ0, OZ1 = 0.178, 0.066, 0.385      # opening half-width / bottom / top
ZROD_X = 0.196
XR_Y = -0.036


def orange():
    return L.mat("PrusaOrange", hexc("#ff5512"), 0, 0.42, tex="micro", tex_scale=0.05)


def preview_extras(root):
    from parts import spool
    L.sync()
    mount = [c for c in root.children_recursive if c.name == "SpoolMount"][0]
    return spool("preview_spool", mount.matrix_world.translation.copy(), flange_color="#202020")


def build():
    root = L.empty("mk4", size=0.1)
    root["model"] = "mk4"
    root["x_range"] = [-0.125, 0.125]
    root["bed_range"] = [-0.105, 0.105]
    root["z_range"] = [0.0, 0.22]
    root["bed_size"] = [0.25, 0.21]
    root["kind"] = "bedslinger"
    blackp = M.black_plastic()
    frame_m = L.mat("FrameBlack", hexc("#1d1e20"), 0.5, 0.42, tex="micro", tex_scale=0.08)
    anod = L.mat("AluExtrusion", hexc("#b9bcc0"), 1, 0.35, tex="brushed", tex_scale=0.2, albedo=False)
    org = orange()
    decal = M.white_print()
    static = []

    # ------------------------------------------------------------------ Y-frame (base)
    for sx in (-1, 1):
        for dz in (0.0, 0.02):
            static.append(L.vslot_2020("yext", 0.44, (sx * 0.12, -0.04, 0.022 + dz), anod, axis="y"))
    for y, nm in ((-0.258, "front"), (0.178, "back")):
        static.append(L.box(f"yplate_{nm}", (0.30, 0.006, 0.07), (0, y, 0.045), frame_m, bevel=0.002))
        for sx in (-1, 1):
            static.append(L.cyl("foot", 0.014, 0.012, (sx * 0.13, y, 0.006), M.rubber(), verts=24, bevel=0.002))
            static.append(L.box("rodclamp", (0.028, 0.02, 0.02), (sx * 0.085, y + (0.013 if y < 0 else -0.013), 0.062),
                                org, bevel=0.003))
        for sx in (-1, 1):
            static.append(screw_head("ypl_scr", (sx * 0.12, y - 0.0035, 0.03), rot=(math.radians(90), 0, 0)))
    for sx in (-1, 1):
        static.append(L.cyl("yrod", 0.004, 0.42, (sx * 0.085, -0.04, 0.062), M.steel(), verts=16,
                            rot=(math.radians(90), 0, 0), bevel=0.0005))
    static += belt_loop("ybelt", (0, -0.24, 0.05), (0, 0.16, 0.05), axis="y", gap=0.008)
    static.append(nema17("ymotor", (0, 0.2, 0.05), rot=(math.radians(-90), 0, 0)))
    static.append(L.box("yidler", (0.03, 0.02, 0.025), (0, -0.24, 0.05), org, bevel=0.003))

    # ------------------------------------------------------------------ upright frame (black, with opening)
    outer = L.rounded_rect(2 * FX, FZ1 - FZ0, 0.012)
    fr = L.prism("frame", [(x, y + (FZ0 + FZ1) / 2) for x, y in outer], 0.006, (0, FRAME_Y + 0.003, 0), frame_m,
                 bevel=0.0015, axis="y")
    # cut the opening with a boolean
    hole = L.prism("frame_hole", [(x, y + (OZ0 + OZ1) / 2) for x, y in L.rounded_rect(2 * OX, OZ1 - OZ0, 0.02)],
                   0.05, (0, FRAME_Y + 0.025, 0), None, bevel=0, axis="y")
    bo = fr.modifiers.new("cut", "BOOLEAN")
    bo.object = hole
    bo.operation = "DIFFERENCE"
    L.apply_modifiers(fr)
    L.bpy.data.objects.remove(hole)
    # lightening holes in the lower frame corners
    static.append(fr)
    static.append(L.text("frame_logo", "PRUSLA", 0.02, 0.0004, (0, FRAME_Y - 0.0032, (OZ1 + FZ1) / 2 + 0.001),
                         (math.radians(90), 0, 0), org))
    for sx in (-1, 1):
        # Z smooth rod, lead screw, motor, top & bottom orange holders
        static.append(L.cyl("zrod", 0.004, OZ1 - OZ0 + 0.02, (sx * ZROD_X, XR_Y + 0.01, (OZ0 + OZ1) / 2 + 0.01),
                            M.steel(), verts=16))
        static.append(leadscrew("zscrew", (sx * (ZROD_X - 0.026), XR_Y + 0.01, OZ0 + 0.01), OZ1 - OZ0 - 0.005))
        static.append(nema17("zmotor", (sx * (ZROD_X - 0.026), XR_Y + 0.01, OZ0 - 0.012), rot=(0, 0, 0)))
        static.append(L.box("ztop", (0.06, 0.04, 0.03), (sx * (ZROD_X - 0.012), XR_Y + 0.012, OZ1 + 0.01), org,
                            bevel=0.004))
        static.append(L.box("zbot", (0.06, 0.04, 0.012), (sx * (ZROD_X - 0.012), XR_Y + 0.012, OZ0 + 0.012), org,
                            bevel=0.003))
        for dz in (0.12, 0.24):
            static.append(screw_head("fr_scr", (sx * (FX - 0.02), FRAME_Y - 0.0035, FZ0 + dz),
                                     rot=(math.radians(90), 0, 0)))
    # xBuddy electronics box (right side of frame) + cable sleeve
    static.append(L.box("xbuddy", (0.03, 0.12, 0.17), (FX + 0.017, 0.0, 0.21), blackp, bevel=0.006))
    static.append(L.box("xbuddy_lid", (0.003, 0.11, 0.16), (FX + 0.0335, 0.0, 0.21), org, bevel=0.0015))
    static.append(L.text("xb_logo", "xBUDDY", 0.01, 0.0003, (FX + 0.0352, 0.0, 0.24), (math.radians(90), 0, math.radians(90)), decal))
    sleeve = L.mat("TextileSleeve", hexc("#161616"), 0, 0.8, tex="carbon", tex_scale=0.02, albedo=False)
    static.append(L.tube_path("sleeve_bed", [(FX + 0.01, 0.05, 0.13), (0.16, 0.14, 0.08), (0.0, 0.15, 0.07)], 0.006, sleeve))
    # PSU (back left)
    static.append(L.box("psu", (0.07, 0.05, 0.16), (-0.15, FRAME_Y + 0.03, 0.16), L.mat("PSUBlack", hexc("#202124"), 0.3, 0.5), bevel=0.004))
    for k in range(6):
        static.append(L.box("psu_vent", (0.05, 0.002, 0.004), (-0.15, FRAME_Y + 0.0555, 0.1 + k * 0.022),
                            L.mat("VentDark", (0.004,) * 3, 0, 0.9), bevel=0.0008))
    # spool holder on top of frame
    static.append(L.box("spoolholder_base", (0.05, 0.03, 0.03), (0, FRAME_Y, FZ1 + 0.012), blackp, bevel=0.004))
    static.append(L.prism("spoolholder_arm", [(-0.008, 0), (0.008, 0), (0.006, 0.1), (-0.006, 0.1)], 0.02,
                          (0, FRAME_Y + 0.01, FZ1 + 0.02), blackp, axis="y", bevel=0.002))
    static.append(L.cyl("spool_shaft", 0.013, 0.09, (0, FRAME_Y - 0.035, FZ1 + 0.115), blackp, verts=24,
                        rot=(math.radians(90), 0, 0), bevel=0.001))
    spool_c = (0, FRAME_Y - 0.045, FZ1 + 0.115 - 0.012)

    # ------------------------------------------------------------------ xLCD (front, left of centre)
    lcd = [
        L.box("lcd_housing", (0.15, 0.032, 0.062), (0, 0, 0), blackp, bevel=0.006),
        L.box("lcd_bezel", (0.084, 0.002, 0.054), (-0.025, -0.0165, 0.0), L.mat("Bezel", hexc("#0b0b0c"), 0, 0.2), bevel=0.0008),
        knob("lcd_knob", 0.013, 0.014, (0.047, -0.016, 0.004), rot=(math.radians(90), 0, 0), mat=org),
        L.cyl("lcd_reset", 0.004, 0.004, (0.047, -0.017, -0.022), blackp, verts=16, rot=(math.radians(90), 0, 0)),
    ]
    lcdj = L.join(lcd, "lcd")
    scr = L.offset_mesh(L.box("Screen", (0.076, 0.001, 0.048), (0, 0, 0), M.screen(), bevel=0.0002), (-0.025, -0.0178, 0.0))
    for o in (lcdj, scr):
        o.rotation_euler = (math.radians(-20), 0, 0)
        o.location = (-0.06, -0.285, 0.052)
        o.parent = root
    static.append(L.box("lcd_mount", (0.05, 0.03, 0.02), (-0.06, -0.27, 0.03), blackp, bevel=0.003))
    L.empty("USBPort", (0.05, -0.265, 0.045), root)
    L.uv_all(static + [lcdj], 0.3)
    L.uv_all([scr], 0.05)
    L.join(static, "frame_static", root)

    # ------------------------------------------------------------------ bed
    bed = L.empty("Bed", (0, 0, 0), root)
    bp = [
        L.box("bed_carriage", (0.22, 0.2, 0.004), (0, NY, 0.073), M.alu(), bevel=0.0015),
        L.box("heatbed", (0.254, 0.241, 0.0035), (0, NY, 0.0885), L.mat("HeatbedBlack", hexc("#121314"), 0.2, 0.45), bevel=0.001),
    ]
    for sx in (-1, 1):
        bp.append(L.box("bearing", (0.02, 0.05, 0.016), (sx * 0.085, NY, 0.066), blackp, bevel=0.002))
        for sy in (-1, 1):
            bp.append(L.cyl("bed_standoff", 0.005, 0.01, (sx * 0.1, NY + sy * 0.09, 0.081), M.alu(), verts=12))
    bp.append(L.text("hb_text", "MK52  24V", 0.008, 0.0002, (0.09, NY - 0.116, 0.0905), (0, 0, 0), decal))
    sheet = L.box("sheet", (0.254, 0.235, 0.0008), (0, NY, BED_TOP - 0.0004), M.pei_gold(), bevel=0.0003)
    tabs = [L.prism("sheet_tab", [(-0.018, 0), (0.018, 0), (0.012, -0.01), (-0.012, -0.01)], 0.0008,
                    (sx * 0.1, NY - 0.1175, BED_TOP - 0.0008), M.pei_gold(), bevel=0.0002) for sx in (-1, 1)]
    L.uv_all(bp, 0.3)
    L.uv_all([sheet] + tabs, 0.25)
    L.join(bp, "bed_body", bed)
    L.join([sheet] + tabs, "bed_surface", bed)
    L.empty("PrintOrigin", (0, NY, BED_TOP), bed)

    # ------------------------------------------------------------------ X axis (moves up)
    gz = L.empty("GantryZ", (0, 0, 0), root)
    bar_z = BED_TOP + 0.055
    gp = []
    for sx in (-1, 1):
        gp.append(L.box("xend", (0.05, 0.045, 0.075), (sx * (ZROD_X - 0.012), XR_Y + 0.004, bar_z), org, bevel=0.005))
        gp.append(L.cyl("xend_nut", 0.009, 0.014, (sx * (ZROD_X - 0.026), XR_Y + 0.01, bar_z - 0.03), M.brass(), verts=16))
    for dz in (-0.0225, 0.0225):
        gp.append(L.cyl("xrod", 0.004, 2 * ZROD_X - 0.02, (0, XR_Y - 0.012, bar_z + dz), M.steel(), verts=16,
                        rot=(0, math.radians(90), 0)))
    gp.append(nema17("xmotor", (-(ZROD_X + 0.03), XR_Y - 0.005, bar_z), rot=(0, math.radians(-90), 0)))
    gp += belt_loop("xbelt", (-(ZROD_X - 0.03), XR_Y - 0.002, bar_z), ((ZROD_X - 0.03), XR_Y - 0.002, bar_z), gap=0.014)
    L.uv_all(gp, 0.3)
    L.join(gp, "xaxis", gz)

    # ------------------------------------------------------------------ Nextruder
    cx = L.empty("CarriageX", (0, 0, 0), gz)
    t = BED_TOP
    ny = NY
    tp = [
        L.box("nx_carriage", (0.06, 0.02, 0.075), (0, XR_Y - 0.03, bar_z), blackp, bevel=0.004),
        L.box("nx_body", (0.05, 0.04, 0.085), (0, ny, t + 0.07), blackp, bevel=0.006, segments=3),
        L.box("nx_face", (0.046, 0.006, 0.06), (0.0, ny - 0.022, t + 0.075), org, bevel=0.003),
        L.box("nx_lever", (0.016, 0.03, 0.024), (0.014, ny + 0.002, t + 0.121), org, bevel=0.004),
        L.cyl("nx_gearbox", 0.018, 0.012, (-0.012, ny + 0.002, t + 0.112), blackp, verts=24, rot=(math.radians(90), 0, 0)),
        L.box("nx_loadcell", (0.034, 0.03, 0.01), (0, ny, t + 0.027), L.mat("LoadCell", hexc("#9aa0a6"), 1, 0.35), bevel=0.001),
        L.box("nx_duct", (0.05, 0.036, 0.008), (0, ny, t + 0.018), blackp, bevel=0.002),
    ]
    tp.append(fan_face("nx_fan", 0.04, (-0.026, ny, t + 0.07), rot=(0, 0, math.radians(-90)), depth=0.008))
    tp.append(L.text("nx_logo", "P", 0.016, 0.0004, (0, ny - 0.0254, t + 0.08), (math.radians(90), 0, 0), L.mat("LogoBlack", hexc("#151515"), 0, 0.4)))
    tp.append(hotend("nx_hotend", (0, ny, t), sock=True))
    tp.append(L.tube_path("nx_sleeve", [(0.0, ny + 0.02, t + 0.1), (0.01, ny + 0.05, t + 0.15), (0.03, 0.01, t + 0.2)], 0.006, sleeve))
    L.uv_all(tp, 0.1)
    L.join(tp, "nextruder", cx)
    L.empty("Nozzle", (0, ny, t), cx)
    L.empty("ToolheadInlet", (0.0, ny + 0.002, t + 0.128), cx)
    L.empty("FilamentEntry", (spool_c[0], spool_c[1] - 0.01, spool_c[2] - 0.09), root)
    L.empty("SpoolMount", spool_c, root)
    from parts import sticker
    sticker("warn_xb", "decal_warning.png", 0.03, 0.026, (FX + 0.0353, -0.035, 0.17), (math.radians(90), 0, math.radians(90))).parent = root
    sticker("serial", "decal_serial.png", 0.06, 0.03, (-0.15, FRAME_Y + 0.0554, 0.22), (math.radians(90), 0, math.radians(180))).parent = root
    sticker("warn_head", "decal_warning.png", 0.012, 0.0105, (0.016, ny - 0.0254, t + 0.055), (math.radians(90), 0, 0)).parent = cx
    led = L.box("StatusLED", (0.012, 0.002, 0.004), (0.06, -0.2995, 0.065), M.led(), bevel=0.0005)
    led.rotation_euler = (math.radians(-20), 0, 0)
    led.parent = root
    return root
