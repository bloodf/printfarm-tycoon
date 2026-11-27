"""Snapmaker U1 (4-toolhead toolchanger) → in-game "Snapmakr U1".

Reference: CoreXY toolchanger, build 270^3, four toolheads parked in a rear dock and swapped in seconds (almost no
purge waste), semi-enclosed frame (solid side/back panels, open front), spools on the side panels.
Rig extras: Tool_0..3 (docked heads), materials ToolColor_0..3 + ToolColor_Active (recoloured with the loaded
filament), SpoolMount_0..3 (axis along X: rotated mounts).
"""
import math

import lib as L
from parts import M, fan_face, hexc, hotend, leadscrew, nema17, sticker

AO = dict(size=2048, samples=40, distance=0.08)
PREVIEW = dict(angle=30, elev=22, dist_mul=1.0)

W, D, H = 0.5, 0.52, 0.62
NOZZLE_Z = 0.42
RZ = 0.54


def preview_extras(root):
    from parts import spool
    L.sync()
    for m in sorted([c for c in root.children_recursive if c.name.startswith("SpoolMount_")], key=lambda c: c.name):
        sp = spool("pv_" + m.name, m.matrix_world.translation.copy(), flange_color="#2a2a2a")
        sp.rotation_euler = m.matrix_world.to_euler()
        sp.parent = root
    return None


def head(name, x, y, z, body, ring_mat, with_hotend=True):
    """Compact toolhead: body, front cover, colour ring (LED light-pipe), dock pins, hotend."""
    parts = [L.box(name + "_body", (0.052, 0.05, 0.085), (x, y, z + 0.045), body, bevel=0.007, segments=3),
             L.box(name + "_cover", (0.056, 0.012, 0.07), (x, y - 0.027, z + 0.05), L.mat("U1_HeadFront", hexc("#f0f0ee"), 0, 0.35, tex="plastic", tex_scale=0.05), bevel=0.008, segments=3),
             L.torus(name + "_ring", 0.012, 0.0025, (x, y - 0.034, z + 0.055), ring_mat, rot=(math.radians(90), 0, 0), major=24, minor=8)]
    for sx in (-1, 1):
        parts.append(L.cyl(name + "_pin", 0.004, 0.012, (x + sx * 0.018, y + 0.03, z + 0.08), M.steel(), verts=10, rot=(math.radians(90), 0, 0)))
    if with_hotend:
        parts.append(hotend(name + "_hotend", (x, y, z)))
    return parts


def build():
    root = L.empty("u1", size=0.1)
    root["model"] = "u1"
    root["x_range"] = [-0.13, 0.13]
    root["y_range"] = [-0.13, 0.13]
    root["z_range"] = [0.0, 0.27]
    root["bed_size"] = [0.27, 0.27]
    root["kind"] = "corexy"
    root["tools"] = 4
    panel = L.mat("U1_Panel", hexc("#2a2d31"), 0.2, 0.5, tex="powder", tex_scale=0.25)
    frame_m = L.mat("U1_Frame", hexc("#b5b8bc"), 1.0, 0.32, tex="brushed", tex_scale=0.2, albedo=False)
    dark = L.mat("U1_Dark", hexc("#141517"), 0.1, 0.4, tex="plastic", tex_scale=0.06)
    decal = M.white_print()
    static = []
    # ------------------------------------------------------------------ frame: 4 corner posts + base + top ring
    for sx in (-1, 1):
        for sy in (-1, 1):
            static.append(L.prism("post", L.rounded_rect(0.03, 0.03, 0.01), H - 0.06, (sx * (W / 2 - 0.015), sy * (D / 2 - 0.015), 0.06), frame_m, bevel=0.002))
    static.append(L.box("base", (W, D, 0.06), (0, 0, 0), dark, bevel=0.01, origin="bottom"))
    static.append(L.box("base_front", (W - 0.04, 0.004, 0.04), (0, -D / 2 - 0.001, 0.01), panel, bevel=0.002, origin="bottom"))
    static.append(L.text("logo", "SNAPMAKR", 0.016, 0.0004, (0, -D / 2 - 0.0035, 0.03), (math.radians(90), 0, 0), decal))
    for sy in (-1, 1):
        static.append(L.box("top_rail_x", (W - 0.03, 0.03, 0.03), (0, sy * (D / 2 - 0.015), H - 0.03), frame_m, bevel=0.004))
    for sx in (-1, 1):
        static.append(L.box("top_rail_y", (0.03, D - 0.03, 0.03), (sx * (W / 2 - 0.015), 0, H - 0.03), frame_m, bevel=0.004))
    # solid side + back panels (semi-enclosed)
    for sx in (-1, 1):
        static.append(L.box("side_panel", (0.006, D - 0.05, H - 0.1), (sx * (W / 2 - 0.004), 0, 0.065), panel, bevel=0.002, origin="bottom"))
    static.append(L.box("back_panel", (W - 0.05, 0.006, H - 0.1), (0, D / 2 - 0.004, 0.065), panel, bevel=0.002, origin="bottom"))
    # screen (front top right)
    static.append(L.box("scr_bezel", (0.12, 0.012, 0.075), (0.15, -D / 2 - 0.006, H - 0.1), dark, bevel=0.006))
    scr = L.box("Screen", (0.105, 0.001, 0.062), (0.15, -D / 2 - 0.0126, H - 0.1), M.screen(), bevel=0.0003)
    led = L.box("StatusLED", (0.3, 0.003, 0.004), (0, -D / 2 - 0.0035, 0.055), M.led(), bevel=0.0005)
    # z lead screws + rods, XY motors
    for x, y in ((-0.17, -0.15), (0.17, -0.15), (0.0, 0.2)):
        static.append(leadscrew("zscrew", (x, y, 0.06), 0.48))
    for sx in (-1, 1):
        static.append(L.cyl("yrod", 0.005, D - 0.06, (sx * 0.2, 0, RZ), M.steel(), verts=14, rot=(math.radians(90), 0, 0)))
        static.append(nema17("xymotor", (sx * 0.2, D / 2 - 0.05, RZ + 0.04), length=0.035, rot=(math.radians(180), 0, 0)))
    # rear tool dock rail
    dock_y = D / 2 - 0.06
    static.append(L.box("dock_rail", (W - 0.08, 0.02, 0.03), (0, dock_y + 0.03, RZ - 0.04), frame_m, bevel=0.004))
    # side spool hangers + PTFE tubes into the top
    spools = []
    for i, (sx, sy) in enumerate(((-1, -1), (-1, 1), (1, -1), (1, 1))):
        x = sx * (W / 2 + 0.04)
        y = sy * 0.12
        static.append(L.box("hanger", (0.04, 0.03, 0.03), (sx * (W / 2 + 0.012), y, 0.36), dark, bevel=0.005))
        static.append(L.cyl("hanger_shaft", 0.012, 0.08, (x, y, 0.36), dark, verts=20, rot=(0, math.radians(90), 0), bevel=0.001))
        spools.append((x + sx * 0.01, y, 0.36 - 0.013, sx))
        static.append(L.tube_path(f"ptfe{i}", [(x, y, 0.47), (sx * (W / 2 - 0.02), y * 0.6, H + 0.03), (sx * 0.05 + (i - 1.5) * 0.04, dock_y, H - 0.01)], 0.0022, M.ptfe()))
    # docked toolheads
    tool_nodes = []
    for i in range(4):
        x = -0.15 + i * 0.1
        ring = L.mat(f"ToolColor_{i}", hexc(f"#{0xdd - i:02x}dddd"), 0, 0.3, emission=hexc("#ffffff"), emission_strength=1.2)
        tn = L.empty(f"Tool_{i}", (0, 0, 0), root)
        hp = head(f"tool{i}", x, dock_y, RZ - 0.12, dark, ring)
        L.uv_all(hp, 0.1)
        L.join(hp, f"tool{i}_mesh", tn)
        tool_nodes.append(tn)
    L.uv_all(static, 0.3)
    L.join(static, "frame", root)
    for o in (scr, led):
        L.uv_all([o], 0.05)
        o.parent = root
    # ------------------------------------------------------------------ bed (moves down)
    bed = L.empty("Bed", (0, 0, 0), root)
    bt = NOZZLE_Z
    bp = [L.box("bed_frame", (0.4, 0.38, 0.014), (0, 0.01, bt - 0.018), dark, bevel=0.004),
          L.box("heatbed", (0.29, 0.29, 0.005), (0, 0, bt - 0.004), L.mat("HeatbedBlack", hexc("#141516"), 0.3, 0.4), bevel=0.0015)]
    for x, y in ((-0.17, -0.15), (0.17, -0.15), (0.0, 0.2)):
        bp.append(L.cyl("znut", 0.012, 0.016, (x, y, bt - 0.022), M.brass(), verts=16))
    plate = L.box("plate", (0.275, 0.275, 0.0008), (0, 0, bt - 0.0004), M.pei_gold(), bevel=0.0003)
    L.uv_all(bp, 0.3)
    L.uv_all([plate], 0.26)
    L.join(bp, "bed_body", bed)
    L.join([plate], "bed_surface", bed)
    L.empty("PrintOrigin", (0, 0, bt), bed)
    # ------------------------------------------------------------------ gantry + active head
    gy = L.empty("GantryY", (0, 0, 0), root)
    gp = [L.box("xbeam", (0.42, 0.03, 0.025), (0, 0.02, RZ), L.mat("BeamGrey", hexc("#45484c"), 0.6, 0.35, tex="brushed", tex_scale=0.2, albedo=False), bevel=0.004)]
    for sx in (-1, 1):
        gp.append(L.box("ycarriage", (0.035, 0.05, 0.04), (sx * 0.2, 0.02, RZ), dark, bevel=0.004))
    L.uv_all(gp, 0.3)
    L.join(gp, "gantry", gy)
    cx = L.empty("CarriageX", (0, 0, 0), gy)
    t = NOZZLE_Z
    carr = [L.box("carriage_plate", (0.07, 0.02, 0.06), (0, 0.025, RZ - 0.02), M.alu(), bevel=0.003)]
    carr += head("active", 0, 0.0, t, dark, L.mat("ToolColor_Active", hexc("#dddddd"), 0, 0.3, emission=hexc("#ffffff"), emission_strength=1.2))
    carr.append(fan_face("th_fan", 0.03, (0.03, 0.0, t + 0.05), rot=(0, 0, math.radians(90)), depth=0.005, body_mat=dark))
    L.uv_all(carr, 0.1)
    L.join(carr, "toolhead", cx)
    L.empty("Nozzle", (0, 0, t), cx)
    L.empty("ToolheadInlet", (0, 0.0, t + 0.1), cx)
    for i, (x, y, z, sx) in enumerate(spools):
        m = L.empty(f"SpoolMount_{i}", (x, y, z), root)
        m.rotation_euler = (0, 0, math.radians(90))
    L.empty("FilamentEntry", (0, D / 2 - 0.03, H), root)
    L.empty("Camera", (-0.2, -D / 2 + 0.03, H - 0.06), root)
    sticker("warn_front", "decal_warning.png", 0.022, 0.019, (-0.2, -D / 2 - 0.0035, 0.03), (math.radians(90), 0, 0)).parent = root
    sticker("serial", "decal_serial.png", 0.08, 0.04, (0, D / 2 + 0.0008, 0.12), (math.radians(90), 0, math.radians(180))).parent = root
    return root
