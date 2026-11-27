"""Creality Ender-3 V3 SE reference model → in-game "Kreality Endr-3 V3 SE".

Real: 349 W x 364 D x 490 H mm, build 220x220x250, bed-slinger (dual 8 mm Y rods),
2040 uprights, dual Z lead screws + motors, "Sprite" direct-drive head, knob screen right-front.
Blender frame: X right, -Y = front, Z up. Origin = bottom centre of footprint.
"""
import math

import lib as L
from parts import M, belt_loop, fan_face, hexc, hotend, knob, leadscrew, nema17, screw_head, spool_stub

AO = dict(size=2048, samples=40, distance=0.08)
PREVIEW = dict(angle=32, elev=20, dist_mul=1.12)


def preview_extras(root):
    from parts import spool
    import lib
    lib.sync()
    mount = [c for c in root.children_recursive if c.name == "SpoolMount"][0]
    return spool("preview_spool", mount.matrix_world.translation.copy())

BED_TOP = 0.1152
UP_X = 0.158          # upright centre X
UP_Y = 0.048          # upright centre Y (2040 → spans 0.028..0.068)
UP_Z0, UP_Z1 = 0.083, 0.478
BAR_Y = 0.036         # X-gantry extrusion centre Y
BAR_DZ = 0.048        # bar centre above nozzle tip


def build():
    root = L.empty("ender3v3", size=0.1)
    root["model"] = "ender3v3"
    root["x_range"] = [-0.11, 0.11]
    root["bed_range"] = [-0.11, 0.11]      # Bed local three-Z (front/back)
    root["z_range"] = [0.0, 0.25]          # GantryZ local three-Y (up)
    root["bed_size"] = [0.22, 0.22]
    root["kind"] = "bedslinger"

    graphite = M.graphite()
    blackp = M.black_plastic()
    anod = M.anod_dark()
    decal = M.white_print()

    static = []
    # ------------------------------------------------------------------ base
    static.append(L.box("base", (0.30, 0.34, 0.066), (0, 0.0, 0.010), graphite, bevel=0.006, origin="bottom"))
    static.append(L.box("base_top", (0.285, 0.33, 0.008), (0, 0.0, 0.076), anod, bevel=0.002, origin="bottom"))
    for sx in (-1, 1):
        for sy in (-1, 1):
            static.append(L.cyl("foot", 0.016, 0.010, (sx * 0.125, sy * 0.145, 0.005), M.rubber(), verts=24, bevel=0.002))
        # side vents
        for k in range(7):
            static.append(L.box("vent", (0.003, 0.03, 0.005), (sx * 0.1505, -0.09 + k * 0.03, 0.045),
                                L.mat("VentDark", (0.004, 0.004, 0.004), 0, 0.9), bevel=0.001))
    # front lip + branding
    static.append(L.box("base_front", (0.29, 0.006, 0.05), (0, -0.171, 0.045), blackp, bevel=0.002))
    static.append(L.text("logo_base", "Endr-3 V3 SE", 0.011, 0.0004, (-0.085, -0.1745, 0.05),
                         (math.radians(90), 0, 0), decal))
    # back: power socket + switch
    static.append(L.box("psu_sock", (0.03, 0.004, 0.022), (0.09, 0.171, 0.04), blackp, bevel=0.001))
    static.append(L.box("psu_sw", (0.012, 0.006, 0.008), (0.06, 0.172, 0.04), L.mat("SwitchRed", hexc("#b3261e"), 0, 0.4), bevel=0.001))

    # Y rods and supports
    for sx in (-1, 1):
        static.append(L.cyl("yrod", 0.004, 0.33, (sx * 0.06, 0, 0.094), M.steel(), verts=16,
                            rot=(math.radians(90), 0, 0), bevel=0.0005))
        for sy in (-1, 1):
            static.append(L.box("yrod_sup", (0.02, 0.012, 0.02), (sx * 0.06, sy * 0.162, 0.093), blackp, bevel=0.002))
    # Y belt + motor (back) + idler (front)
    static += belt_loop("ybelt", (0, -0.155, 0.092), (0, 0.150, 0.092), axis="y", gap=0.006)
    static.append(nema17("ymotor", (0, 0.150, 0.068), rot=(0, math.radians(90), 0)))
    static.append(L.box("yidler", (0.02, 0.016, 0.02), (0, -0.158, 0.092), blackp, bevel=0.002))

    # ------------------------------------------------------------------ frame (uprights + top bar)
    for sx in (-1, 1):
        for dy in (-0.01, 0.01):
            static.append(L.vslot_2020("upright", UP_Z1 - UP_Z0, (sx * UP_X, UP_Y + dy, (UP_Z0 + UP_Z1) / 2), anod))
        # foot brackets
        static.append(L.prism("ubracket", [(-0.045, 0), (0.045, 0), (0.012, 0.07), (-0.012, 0.07)], 0.004,
                              (sx * (UP_X + 0.012) - 0.002, UP_Y, UP_Z0), blackp, axis="x", bevel=0.001))
        # Z lead screw + motor + top bearing
        zx = sx * (UP_X - 0.026)
        static.append(leadscrew("zscrew", (zx, UP_Y + 0.006, UP_Z0 + 0.045), 0.33))
        static.append(nema17("zmotor", (zx, UP_Y + 0.006, UP_Z0 + 0.022), rot=(0, 0, 0)))
        static.append(L.box("zbearing", (0.03, 0.03, 0.012), (zx + sx * 0.004, UP_Y + 0.006, UP_Z1 - 0.016), blackp,
                            bevel=0.002))
    static.append(L.vslot_2020("topbar", 2 * UP_X + 0.02, (0, UP_Y, UP_Z1 + 0.01), anod, axis="x"))
    for sx in (-1, 1):
        static.append(L.box("topcap", (0.024, 0.044, 0.024), (sx * UP_X, UP_Y, UP_Z1 + 0.01), blackp, bevel=0.003))
    static.append(L.text("logo_top", "KREALITY", 0.013, 0.0004, (0, UP_Y - 0.0105, UP_Z1 + 0.01),
                         (math.radians(90), 0, 0), decal))

    # spool holder (on top bar, spool axis along Y)
    sh_x = -0.075
    static.append(L.box("spool_post", (0.02, 0.03, 0.11), (sh_x, UP_Y, UP_Z1 + 0.02), blackp, bevel=0.003,
                        origin="bottom"))
    static.append(spool_stub("spool_shaft", (sh_x, UP_Y - 0.02, UP_Z1 + 0.12)))
    spool_c = (sh_x, UP_Y - 0.03, UP_Z1 + 0.12 - 0.013)
    # runout sensor on top bar
    static.append(L.box("runout", (0.028, 0.02, 0.022), (0.055, UP_Y - 0.004, UP_Z1 + 0.031), blackp, bevel=0.003))

    # ------------------------------------------------------------------ screen housing (right front)
    scr_parts = [
        L.box("scr_housing", (0.092, 0.03, 0.068), (0, 0, 0), blackp, bevel=0.005),
        L.box("scr_bezel", (0.078, 0.002, 0.046), (0, -0.0152, 0.008), L.mat("Bezel", hexc("#0b0b0c"), 0, 0.2), bevel=0.0008),
    ]
    scr_face = L.offset_mesh(L.box("Screen", (0.068, 0.001, 0.040), (0, 0, 0), M.screen(), bevel=0.0002), (0, -0.0165, 0.008))
    scr_parts.append(knob("scr_knob", 0.0085, 0.008, (0.0, -0.015, -0.024), rot=(math.radians(90), 0, 0)))
    scr_parts.append(L.box("sd_slot", (0.004, 0.016, 0.003), (0.0465, 0, -0.02), L.mat("VentDark", (0.004,) * 3, 0, 0.9), bevel=0.0004))
    scr_j = L.join(scr_parts, "screen_housing")
    for o in (scr_j, scr_face):
        o.rotation_euler = (math.radians(-18), 0, 0)
        o.location = (0.098, -0.188, 0.072)
    scr_face.name = "Screen"
    usb = L.empty("USBPort", (0.145, -0.188, 0.052), root)

    # cables (static, routed from base to Z motors)
    for sx in (-1, 1):
        static.append(L.tube_path("zcable", [(sx * 0.12, 0.06, 0.08), (sx * 0.13, 0.07, 0.086),
                                             (sx * (UP_X - 0.026), UP_Y + 0.03, 0.095)], 0.0022, M.cable()))

    L.uv_all(static + [scr_j], 0.3)
    frame = L.join(static, "frame", root)
    scr_j.parent = root
    scr_face.parent = root
    L.uv_all([scr_face], 0.05)

    # ------------------------------------------------------------------ bed (moves along Y)
    bed = L.empty("Bed", (0, 0, 0), root)
    bparts = [
        L.box("bed_carriage", (0.20, 0.20, 0.003), (0, 0, 0.1015), M.alu(), bevel=0.001),
        L.box("bed_plate", (0.235, 0.235, 0.004), (0, 0, 0.112), M.alu(), bevel=0.0012),
        L.box("bed_heater", (0.22, 0.22, 0.0006), (0, 0, 0.1097), M.heater_red(), bevel=0.0002),
    ]
    for sx in (-1, 1):
        for sy in (-1, 1):
            bparts.append(L.cyl("bed_spacer", 0.006, 0.006, (sx * 0.1, sy * 0.1, 0.1065), L.mat("SiliconeCol", hexc("#c94a2a"), 0, 0.6), verts=16))
            bparts.append(L.cyl("bed_knob", 0.012, 0.006, (sx * 0.1, sy * 0.1, 0.095), blackp, verts=24, bevel=0.001))
        bparts.append(L.box("bearing_blk", (0.016, 0.045, 0.014), (sx * 0.06, 0, 0.094), blackp, bevel=0.002))
    bparts.append(L.box("bed_belt_clamp", (0.02, 0.02, 0.01), (0, 0, 0.095), blackp, bevel=0.002))
    sheet = L.box("bed_sheet", (0.235, 0.235, 0.0012), (0, 0, BED_TOP - 0.0006), M.pei_black(), bevel=0.0005)
    tab = L.prism("sheet_tab", [(-0.02, 0), (0.02, 0), (0.014, -0.012), (-0.014, -0.012)], 0.0012,
                  (0, -0.1175, BED_TOP - 0.0012), M.pei_black(), bevel=0.0003)
    bparts.append(L.tube_path("bed_cable", [(0.0, 0.1, 0.1), (0.0, 0.14, 0.098), (0.02, 0.16, 0.085)], 0.003, M.cable()))
    L.uv_all(bparts, 0.3)
    L.uv_all([sheet, tab], 0.235)
    L.join(bparts, "bed_body", bed)
    L.join([sheet, tab], "bed_surface", bed)
    L.empty("PrintOrigin", (0, 0, BED_TOP), bed)

    # ------------------------------------------------------------------ X gantry (moves up in Z)
    gz = L.empty("GantryZ", (0, 0, 0), root)
    gparts = []
    bar_z = BED_TOP + BAR_DZ
    gparts.append(L.vslot_2020("xbar", 2 * UP_X - 0.03, (0, BAR_Y, bar_z), anod, axis="x"))
    for sx in (-1, 1):
        gparts.append(L.box("xend", (0.05, 0.062, 0.058), (sx * (UP_X - 0.006), UP_Y - 0.001, bar_z), blackp, bevel=0.004))
        gparts.append(L.cyl("znut", 0.009, 0.012, (sx * (UP_X - 0.026), UP_Y + 0.006, bar_z - 0.035), M.brass(), verts=16))
        for dz in (-0.02, 0.02):
            gparts.append(screw_head("xend_scr", (sx * (UP_X - 0.006), UP_Y - 0.033, bar_z + dz),
                                     rot=(math.radians(90), 0, 0)))
    gparts.append(nema17("xmotor", (-(UP_X - 0.006), BAR_Y - 0.045, bar_z), rot=(math.radians(90), 0, 0)))
    gparts += belt_loop("xbelt", (-(UP_X - 0.03), BAR_Y - 0.012, bar_z), ((UP_X - 0.03), BAR_Y - 0.012, bar_z), gap=0.012)
    L.uv_all(gparts, 0.3)
    L.join(gparts, "gantry_body", gz)

    # ------------------------------------------------------------------ toolhead (moves along X)
    cx = L.empty("CarriageX", (0, 0, 0), gz)
    t = BED_TOP
    tparts = [
        L.box("th_plate", (0.062, 0.008, 0.066), (0, BAR_Y - 0.014, bar_z + 0.002), M.alu(), bevel=0.0015),
        L.box("th_body", (0.052, 0.036, 0.062), (0, -0.004, t + 0.058), blackp, bevel=0.005),
        L.box("th_cover", (0.058, 0.012, 0.07), (0, -0.025, t + 0.056), L.mat("SpriteGrey", hexc("#3a3d42"), 0.1, 0.4, tex="micro", tex_scale=0.05), bevel=0.006, segments=3),
        L.box("th_top", (0.034, 0.03, 0.018), (0, 0.0, t + 0.098), blackp, bevel=0.003),
        L.cyl("th_inlet", 0.004, 0.012, (0, 0.0, t + 0.112), blackp, verts=12),
        L.box("th_duct", (0.05, 0.028, 0.008), (0, -0.004, t + 0.019), blackp, bevel=0.002),
    ]
    for sx in (-1, 1):
        tparts.append(L.cyl("wheel", 0.0085, 0.006, (sx * 0.02, BAR_Y - 0.018, bar_z + sx * 0.0 + 0.016), L.mat("POM", hexc("#2a2a2a"), 0, 0.4), verts=20,
                            rot=(math.radians(90), 0, 0)))
    tparts.append(L.cyl("wheel", 0.0085, 0.006, (0, BAR_Y - 0.018, bar_z - 0.016), L.mat("POM", hexc("#2a2a2a"), 0, 0.4), verts=20,
                        rot=(math.radians(90), 0, 0)))
    tparts.append(fan_face("th_fan", 0.03, (0, -0.0315, t + 0.06), depth=0.004))
    tparts.append(fan_face("th_sidefan", 0.03, (0.03, -0.004, t + 0.045), rot=(0, 0, math.radians(90)), depth=0.006))
    tparts.append(L.text("th_logo", "K", 0.012, 0.0004, (0, -0.0318, t + 0.085), (math.radians(90), 0, 0), decal))
    tparts.append(hotend("th_hotend", (0, 0, t)))
    tparts.append(L.tube_path("th_cable", [(0.01, 0.01, t + 0.1), (0.02, 0.03, t + 0.14), (0.04, BAR_Y + 0.01, t + 0.12)], 0.0035, M.cable()))
    L.uv_all(tparts, 0.1)
    L.join(tparts, "toolhead", cx)
    L.empty("Nozzle", (0, 0, t), cx)

    # filament strand: drawn live by the game between these two anchors
    L.empty("FilamentEntry", (0.055, UP_Y - 0.004, UP_Z1 + 0.03), root)
    L.empty("ToolheadInlet", (0, 0.0, t + 0.118), cx)
    L.empty("SpoolMount", spool_c, root)  # spool GLB axis is along Blender Y
    # status LED on screen housing
    from parts import sticker
    for st in (sticker("warn_base", "decal_warning.png", 0.026, 0.023, (0.035, -0.1745, 0.045), (math.radians(90), 0, 0)),
               sticker("serial", "decal_serial.png", 0.07, 0.035, (0.0, 0.1714, 0.043), (math.radians(90), 0, math.radians(180))),
               sticker("warn_head", "decal_warning.png", 0.012, 0.0105, (0.0, -0.0322, t + 0.037), (math.radians(90), 0, 0))):
        st.parent = cx if st.name.startswith("warn_head") else root
    led = L.box("StatusLED", (0.01, 0.002, 0.004), (0.135, -0.203, 0.096), M.led(), bevel=0.0005)
    led.parent = root
    return root
