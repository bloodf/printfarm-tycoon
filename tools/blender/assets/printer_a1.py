"""Bambu Lab A1 + AMS lite (combo) → in-game "Bamboo Lab A1 + AMS lite".

Real A1: 385 W x 410 D x 458 H mm, build 256^3, open bed-slinger with a single Z tower on the left and a
cantilevered X beam, touchscreen on a stalk at the front right, camera on the tower. The AMS lite stands beside it:
four spools in a cross arrangement around a central hub, each resting on two rollers, feeding one PTFE tube.
Origin: centre of the combined footprint (printer at -X, AMS lite at +X) so it sits in a wide (L) slot.
"""
import math

import lib as L
from parts import M, belt_loop, fan_face, hexc, hotend, knob, leadscrew, nema17, sticker

AO = dict(size=2048, samples=40, distance=0.08)
PREVIEW = dict(angle=24, elev=18, dist_mul=1.0)

PX = -0.2          # printer centre X (AMS lite at +X)
AX = 0.25          # AMS lite centre X
BED_TOP = 0.112
TOWER_X = PX - 0.175
BEAM_DZ = 0.055


def preview_extras(root):
    from parts import spool
    L.sync()
    mounts = sorted([c for c in root.children_recursive if c.name.startswith("SpoolMount_")], key=lambda c: c.name)
    for i, m in enumerate(mounts):
        sp = spool(f"prev_spool{i}", m.matrix_world.translation.copy(), flange_color="#2a2a2a")
        sp.parent = root
    return None


def build():
    root = L.empty("a1", size=0.1)
    root["model"] = "a1"
    root["x_range"] = [-0.12, 0.12]
    root["bed_range"] = [-0.12, 0.12]
    root["z_range"] = [0.0, 0.25]
    root["bed_size"] = [0.256, 0.256]
    root["kind"] = "bedslinger"
    shell = L.mat("A1_Shell", hexc("#dcdedf"), 0, 0.42, tex="plastic", tex_scale=0.08)
    dark = L.mat("A1_Dark", hexc("#2b2d30"), 0.1, 0.45, tex="plastic", tex_scale=0.08)
    alu = M.alu()
    blackp = M.black_plastic()
    decal = L.mat("DecalDark", hexc("#3a3c40"), 0, 0.5)
    static = []

    # ------------------------------------------------------------------ base + Y rail
    static.append(L.box("base", (0.36, 0.40, 0.06), (PX, 0, 0.012), shell, bevel=0.012, segments=3, origin="bottom"))
    static.append(L.box("base_top", (0.30, 0.38, 0.008), (PX + 0.02, 0, 0.07), dark, bevel=0.003, origin="bottom"))
    static.append(L.box("y_rail", (0.02, 0.38, 0.014), (PX + 0.02, 0, 0.078), alu, bevel=0.002, origin="bottom"))
    for sx in (-1, 1):
        for sy in (-1, 1):
            static.append(L.cyl("foot", 0.016, 0.012, (PX + sx * 0.15, sy * 0.17, 0.006), M.rubber(), verts=20, bevel=0.002))
    static.append(L.text("logo", "BAMBOO LAB", 0.012, 0.0004, (PX - 0.06, -0.2005, 0.045), (math.radians(90), 0, 0), decal))
    static.append(nema17("ymotor", (PX + 0.02, 0.175, 0.05), rot=(math.radians(-90), 0, 0)))
    # ------------------------------------------------------------------ Z tower (left)
    tower = L.prism("tower", L.rounded_rect(0.07, 0.17, 0.02), 0.44, (TOWER_X, 0.03, 0.07), shell, bevel=0.004)
    static.append(tower)
    static.append(L.box("tower_slot", (0.004, 0.11, 0.36), (TOWER_X + 0.0352, 0.0, 0.11), dark, bevel=0.001, origin="bottom"))
    static.append(L.box("tower_cap", (0.076, 0.176, 0.02), (TOWER_X, 0.03, 0.505), dark, bevel=0.008, origin="bottom"))
    static.append(leadscrew("zscrew", (TOWER_X + 0.01, 0.07, 0.09), 0.4))
    cam = L.box("camera_pod", (0.03, 0.02, 0.02), (TOWER_X + 0.02, -0.06, 0.49), dark, bevel=0.005)
    static.append(cam)
    static.append(L.cyl("camera_lens", 0.005, 0.004, (TOWER_X + 0.02, -0.071, 0.49), L.mat("Lens", hexc("#0a0a12"), 0.5, 0.1), verts=16, rot=(math.radians(90), 0, 0)))
    # cable arc from the tower top to the toolhead (A1's signature loop)
    static.append(L.tube_path("head_cable", [(TOWER_X, 0.06, 0.52), (TOWER_X + 0.1, 0.05, 0.6), (PX + 0.05, 0.04, 0.58), (PX + 0.12, 0.03, 0.5)], 0.004, M.cable()))
    # ------------------------------------------------------------------ screen on a stalk (front right)
    static.append(L.cyl("stalk", 0.008, 0.05, (PX + 0.16, -0.19, 0.06), dark, verts=12, origin="bottom"))
    scr_h = L.box("scr_housing", (0.1, 0.016, 0.07), (0, 0, 0), dark, bevel=0.006)
    scr = L.offset_mesh(L.box("Screen", (0.088, 0.001, 0.058), (0, 0, 0), M.screen(), bevel=0.0003), (0, -0.0085, 0))
    for o in (scr_h, scr):
        o.rotation_euler = (math.radians(-25), 0, 0)
        o.location = (PX + 0.16, -0.2, 0.13)
    # ------------------------------------------------------------------ AMS lite
    ams_m = L.mat("AMS_Grey", hexc("#cfd1d3"), 0, 0.4, tex="plastic", tex_scale=0.08)
    static.append(L.cyl("ams_base", 0.11, 0.02, (AX, 0, 0.0), dark, verts=40, bevel=0.006, origin="bottom"))
    static.append(L.box("ams_pillar", (0.05, 0.05, 0.36), (AX, 0.01, 0.02), ams_m, bevel=0.01, origin="bottom"))
    hub_z = 0.37
    static.append(L.box("ams_hub", (0.07, 0.05, 0.05), (AX, 0.01, hub_z), ams_m, bevel=0.012))
    spool_pos = []
    for i, (sx, sz) in enumerate(((-1, 1), (1, 1), (-1, -1), (1, -1))):
        cx, cz = AX + sx * 0.118, 0.245 + sz * 0.118
        # arm from the pillar
        arm = L.box("ams_arm", (0.11, 0.02, 0.02), (AX + sx * 0.055, 0.04, cz - 0.06), ams_m, bevel=0.005)
        arm.rotation_euler = (0, sx * sz * math.radians(-25), 0)
        static.append(arm)
        # two rollers under the spool rim + feeder unit
        for rx in (-0.045, 0.045):
            static.append(L.cyl("roller", 0.009, 0.07, (cx + rx, 0.0, cz - 0.098 + abs(rx) * 0.25), dark, verts=14, rot=(math.radians(90), 0, 0)))
        static.append(L.box("feeder", (0.03, 0.03, 0.03), (cx - sx * 0.07, 0.05, cz - 0.05), ams_m, bevel=0.006))
        static.append(L.box("feeder_led", (0.008, 0.002, 0.004), (cx - sx * 0.07, 0.034, cz - 0.04), M.led(), bevel=0.0005))
        static.append(L.tube_path(f"ptfe{i}", [(cx - sx * 0.07, 0.05, cz - 0.035), (AX + sx * 0.04, 0.06, hub_z - 0.04), (AX + sx * 0.015, 0.04, hub_z + 0.02)], 0.002, M.ptfe()))
        spool_pos.append((cx, 0.0, cz))
    # main PTFE: hub → toolhead (bundled with the head cable)
    static.append(L.tube_path("ptfe_main", [(AX, 0.02, hub_z + 0.03), (AX - 0.05, 0.04, 0.56), (PX + 0.1, 0.05, 0.6), (PX + 0.06, 0.03, 0.48)], 0.0025, M.ptfe()))
    L.uv_all(static + [scr_h], 0.2)
    L.join(static, "frame", root)
    scr_h.parent = root
    scr.parent = root
    L.uv_all([scr], 0.05)

    # ------------------------------------------------------------------ bed (Y)
    bed = L.empty("Bed", (0, 0, 0), root)
    bp = [L.box("bed_carrier", (0.23, 0.23, 0.012), (PX + 0.02, 0, 0.088), dark, bevel=0.003),
          L.box("heatbed", (0.27, 0.27, 0.006), (PX + 0.02, 0, 0.1065), L.mat("HeatbedBlack", hexc("#141516"), 0.3, 0.4), bevel=0.0015),
          L.box("bed_block", (0.05, 0.06, 0.012), (PX + 0.02, 0, 0.08), alu, bevel=0.002)]
    plate = L.box("plate", (0.257, 0.257, 0.0008), (PX + 0.02, 0, BED_TOP - 0.0004), M.pei_gold(), bevel=0.0003)
    tab = L.prism("plate_tab", [(-0.02, 0), (0.02, 0), (0.014, -0.01), (-0.014, -0.01)], 0.0008, (PX + 0.02, -0.1285, BED_TOP - 0.0008), M.pei_gold(), bevel=0.0002)
    L.uv_all(bp, 0.3)
    L.uv_all([plate, tab], 0.26)
    L.join(bp, "bed_body", bed)
    L.join([plate, tab], "bed_surface", bed)
    L.empty("PrintOrigin", (PX + 0.02, 0, BED_TOP), bed)

    # ------------------------------------------------------------------ X beam (cantilever, moves up)
    gz = L.empty("GantryZ", (0, 0, 0), root)
    bz = BED_TOP + BEAM_DZ
    gp = [L.box("beam", (0.33, 0.045, 0.04), (PX + 0.0, 0.045, bz), L.mat("BeamGrey", hexc("#45484c"), 0.6, 0.35, tex="brushed", tex_scale=0.2, albedo=False), bevel=0.006),
          L.box("beam_rail", (0.31, 0.012, 0.012), (PX + 0.0, 0.021, bz + 0.006), alu, bevel=0.002),
          L.box("z_carriage", (0.06, 0.07, 0.09), (TOWER_X + 0.04, 0.04, bz), shell, bevel=0.01),
          L.box("beam_end", (0.03, 0.05, 0.045), (PX + 0.165, 0.045, bz), shell, bevel=0.008)]
    gp += belt_loop("xbelt", (PX - 0.14, 0.067, bz), (PX + 0.14, 0.067, bz), gap=0.02)
    L.uv_all(gp, 0.3)
    L.join(gp, "beam_body", gz)
    cx = L.empty("CarriageX", (0, 0, 0), gz)
    t = BED_TOP
    hx = PX + 0.02
    cover = L.mat("A1_HeadCover", hexc("#e7e8e9"), 0, 0.35, tex="plastic", tex_scale=0.05)
    tp = [L.box("th_body", (0.058, 0.05, 0.08), (hx, -0.004, t + 0.055), dark, bevel=0.006),
          L.box("th_cover", (0.062, 0.014, 0.085), (hx, -0.03, t + 0.054), cover, bevel=0.009, segments=3),
          L.box("th_duct", (0.05, 0.038, 0.009), (hx, -0.006, t + 0.014), dark, bevel=0.002),
          L.cyl("th_inlet", 0.005, 0.012, (hx, 0.0, t + 0.1), dark, verts=12)]
    tp.append(fan_face("th_fan", 0.035, (hx - 0.032, -0.004, t + 0.055), rot=(0, 0, math.radians(-90)), depth=0.006, body_mat=dark))
    tp.append(L.text("th_logo", "B", 0.012, 0.0003, (hx, -0.0372, t + 0.03), (math.radians(90), 0, 0), dark))
    tp.append(hotend("th_hotend", (hx, 0, t)))
    L.uv_all(tp, 0.1)
    L.join(tp, "toolhead", cx)
    L.empty("Nozzle", (hx, 0, t), cx)
    L.empty("ToolheadInlet", (hx, 0.0, t + 0.108), cx)
    sticker("warn_head", "decal_warning.png", 0.012, 0.0105, (hx + 0.022, -0.0372, t + 0.075), (math.radians(90), 0, 0)).parent = cx
    sticker("serial", "decal_serial.png", 0.07, 0.035, (PX, 0.2005, 0.04), (math.radians(90), 0, math.radians(180))).parent = root
    for i, pos in enumerate(spool_pos):
        L.empty(f"SpoolMount_{i}", pos, root)
    L.empty("FilamentEntry", (AX, 0.02, hub_z + 0.03), root)
    L.empty("Camera", (TOWER_X + 0.02, -0.07, 0.49), root)
    led = L.box("StatusLED", (0.03, 0.002, 0.004), (PX + 0.12, -0.2006, 0.05), M.led(), bevel=0.0005)
    led.parent = root
    return root
