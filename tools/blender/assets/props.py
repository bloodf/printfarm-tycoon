"""Furniture and set-dressing props. One GLB, one named root per prop (origin at floor/wall contact).

Game-facing nodes:
  workbench: Slot_0..3 (printer positions, top surface)
  shelf_boltless: SpoolSlot_0..N (spool centres), SupplySlot_0..2 (bottom shelf)
  desk: LaptopScreen (material Screen), LaptopCam (view target)
  packing_table: PackSlot (box position), ItemSlot (print drop), PackCam
  outbox_shelf: OutSlot_0..5
  wall_clock: HourHand, MinuteHand (rotate about local Y after export = Blender -Y axis)
"""
import math
import random

import bpy

import lib as L
from parts import M, hexc, knob

EXPORT_NAME = "props"
PREVIEW = dict(angle=30, elev=30, dist_mul=0.55, res=(1200, 700))


def powder(name="PowderGrey", c="#3d4045"):
    return L.mat(name, hexc(c), 0.55, 0.5, tex="powder", tex_scale=0.25)


def wood():
    return L.mat("ButcherBlock", (1, 1, 1), 0, 0.4, tex="butcher", tex_scale=0.8)


def chipboard():
    return L.mat("Plywood", (1, 1, 1), 0, 0.7, tex="plywood", tex_scale=0.6)


def tote(name, w, d, h, body_hex, lid_hex, loc, alpha=1.0):
    """Stackable storage tote: tapered body, lip rim, ribbed lid, handle recesses, label card."""
    import bmesh
    from mathutils import Vector
    body_m = L.mat(f"Tote_{body_hex}", hexc(body_hex), 0, 0.38, tex="micro", tex_scale=0.1, alpha=alpha)
    lid_m = L.mat(f"ToteLid_{lid_hex}", hexc(lid_hex), 0, 0.35, tex="micro", tex_scale=0.1)
    dark = L.mat("ToteRecess", hexc("#1a1c1f"), 0, 0.6)
    parts = []
    body = L.box(name + "_body", (w * 0.92, d * 0.92, h * 0.86), (0, 0, 0), body_m, bevel=0.012, segments=3, origin="bottom")
    # taper: widen the top ring of vertices
    for v in body.data.vertices:
        t = v.co.z / (h * 0.86)
        v.co.x *= 0.94 + 0.06 * t / 0.92 * 0.92 + 0.06 * t
        v.co.y *= 0.94 + 0.06 * t
    parts.append(body)
    parts.append(L.box(name + "_lip", (w, d, 0.018), (0, 0, h * 0.86 - 0.004), body_m, bevel=0.006, origin="bottom"))
    parts.append(L.box(name + "_lid", (w * 0.99, d * 0.99, 0.03), (0, 0, h * 0.86 + 0.012), lid_m, bevel=0.01, segments=3, origin="bottom"))
    for k in range(3):
        parts.append(L.box(name + "_rib", (w * 0.8, 0.012, 0.008), (0, -d * 0.25 + k * d * 0.25, h * 0.86 + 0.04), lid_m, bevel=0.003, origin="bottom"))
    for sx in (-1, 1):
        parts.append(L.box(name + "_handle", (0.006, d * 0.35, 0.03), (sx * (w * 0.46 + 0.002), 0, h * 0.7), dark, bevel=0.004))
    parts.append(L.box(name + "_label", (w * 0.35, 0.002, h * 0.25), (0, -d * 0.47 - 0.004, h * 0.45), L.mat("ToteLabel", hexc("#f2f0ea"), 0, 0.6), bevel=0.001))
    for o in parts:
        o.location = Vector(o.location) + Vector(loc)
    return parts


# ----------------------------------------------------------------------------- workbench 2.6 x 0.75 x 0.9
def workbench():
    r = L.empty("workbench", size=0.1)
    W, D, Hh = 2.6, 0.75, 0.9
    p = []
    fr = powder()
    p.append(L.box("top", (W, D, 0.04), (0, 0, Hh - 0.04), wood(), bevel=0.004, origin="bottom"))
    for sx in (-1, 1):
        for sy in (-1, 1):
            p.append(L.box("leg", (0.05, 0.05, Hh - 0.04), (sx * (W / 2 - 0.06), sy * (D / 2 - 0.06), 0), fr, bevel=0.004, origin="bottom"))
            p.append(L.box("foot", (0.07, 0.07, 0.012), (sx * (W / 2 - 0.06), sy * (D / 2 - 0.06), 0), L.mat("Rubber", hexc("#161616"), 0, 0.85), bevel=0.003, origin="bottom"))
        p.append(L.box("side_rail", (0.04, D - 0.12, 0.05), (sx * (W / 2 - 0.06), 0, Hh - 0.1), fr, bevel=0.004))
        p.append(L.box("side_rail_low", (0.04, D - 0.12, 0.04), (sx * (W / 2 - 0.06), 0, 0.16), fr, bevel=0.004))
    for sy in (-1, 1):
        p.append(L.box("apron", (W - 0.12, 0.04, 0.07), (0, sy * (D / 2 - 0.06), Hh - 0.1), fr, bevel=0.004))
        p.append(L.box("low_rail", (W - 0.12, 0.04, 0.04), (0, sy * (D / 2 - 0.06), 0.16), fr, bevel=0.004))
    p.append(L.box("shelf", (W - 0.16, D - 0.1, 0.018), (0, 0, 0.18), chipboard(), bevel=0.002, origin="bottom"))
    # power strip under front edge
    p.append(L.box("strip", (0.5, 0.05, 0.04), (0.6, -D / 2 + 0.1, Hh - 0.075), L.mat("StripWhite", hexc("#ececea"), 0, 0.4), bevel=0.008))
    p.append(L.box("strip_sw", (0.025, 0.012, 0.016), (0.37, -D / 2 + 0.075, Hh - 0.075), L.mat("SwitchRedGlow", hexc("#ff3b2f"), 0, 0.3, emission=hexc("#ff2a1a"), emission_strength=2), bevel=0.003))
    # storage totes on the lower shelf
    rr = random.Random(2)
    for i, x in enumerate((-0.92, -0.5, 0.42, 0.86)):
        body, lid = [("#3a3f46", "#e0a526"), ("#d8dadc", "#2c6fd1"), ("#3a3f46", "#e0a526"), ("#b9c2cb", "#3a3f46")][i]
        p += tote(f"tote{i}", 0.38, 0.52, 0.24 + rr.uniform(-0.02, 0.02), body, lid, (x, 0.03, 0.198))
    L.uv_all(p, 0.6)
    L.join(p, "workbench_mesh", r)
    for i, x in enumerate((-0.96, -0.32, 0.32, 0.96)):
        L.empty(f"Slot_{i}", (x, 0.02, Hh), r)
    return r


# ----------------------------------------------------------------------------- boltless shelving 1.2 x 0.45 x 1.8
def shelf_boltless():
    r = L.empty("shelf_boltless", size=0.1)
    W, D, Hh = 1.2, 0.45, 1.8
    p = []
    st = powder("ShelfSteel", "#4a4d52")
    levels = [0.08, 0.55, 1.0, 1.45, 1.78]
    for sx in (-1, 1):
        for sy in (-1, 1):
            p.append(L.box("post", (0.035, 0.035, Hh), (sx * (W / 2 - 0.018), sy * (D / 2 - 0.018), 0), st, bevel=0.002, origin="bottom"))
            # keyhole slots look
            for k in range(22):
                p.append(L.box("slot", (0.008, 0.001, 0.016), (sx * (W / 2 - 0.018), sy * (D / 2 - 0.0005) , 0.06 + k * 0.08), L.mat("VentDark", (0.004,) * 3, 0, 0.9), bevel=0))
    for z in levels:
        for sy in (-1, 1):
            p.append(L.box("beam", (W, 0.03, 0.04), (0, sy * (D / 2 - 0.015), z - 0.04), st, bevel=0.003, origin="bottom"))
        p.append(L.box("board", (W - 0.02, D - 0.02, 0.016), (0, 0, z - 0.016), chipboard(), bevel=0.002, origin="bottom"))
    # storage bins on top
    for i, x in enumerate((-0.32, 0.3)):
        p.append(L.box("topbin", (0.5, 0.38, 0.25), (x, 0, levels[-1]), L.mat("BinClear", hexc("#dfe3e6"), 0, 0.25, alpha=0.8), bevel=0.015, origin="bottom"))
        p.append(L.box("topbin_lid", (0.52, 0.4, 0.025), (x, 0, levels[-1] + 0.25), L.mat("BinLidBlue", hexc("#2d69b3"), 0, 0.4), bevel=0.008, origin="bottom"))
    L.uv_all(p, 0.5)
    L.join(p, "shelf_mesh", r)
    n = 0
    for z in levels[1:4]:
        for k in range(10):
            L.empty(f"SpoolSlot_{n}", (-0.5 + k * 0.111, 0.0, z + 0.101), r)
            n += 1
    r["spool_slots"] = n
    for k in range(3):
        L.empty(f"SupplySlot_{k}", (-0.38 + k * 0.38, 0.0, levels[0]), r)
    return r


# ----------------------------------------------------------------------------- desk + laptop + chair
def desk():
    r = L.empty("desk", size=0.1)
    p = []
    top_m = L.mat("DeskWhite", hexc("#e6e3dc"), 0, 0.4, tex="plastic", tex_scale=0.3)
    leg = powder("DeskLeg", "#202225")
    W, D, Hh = 1.4, 0.7, 0.75
    p.append(L.box("top", (W, D, 0.025), (0, 0, Hh - 0.025), top_m, bevel=0.004, origin="bottom"))
    for sx in (-1, 1):
        p.append(L.box("leg_v", (0.05, 0.05, Hh - 0.025), (sx * (W / 2 - 0.08), 0, 0), leg, bevel=0.004, origin="bottom"))
        p.append(L.box("leg_foot", (0.06, D - 0.06, 0.03), (sx * (W / 2 - 0.08), 0, 0), leg, bevel=0.006, origin="bottom"))
        p.append(L.box("leg_top", (0.05, D - 0.1, 0.03), (sx * (W / 2 - 0.08), 0, Hh - 0.055), leg, bevel=0.004, origin="bottom"))
    p.append(L.box("crossbar", (W - 0.2, 0.03, 0.05), (0, 0.2, Hh - 0.1), leg, bevel=0.004))
    # laptop base + keyboard
    lap = L.mat("LaptopAlu", hexc("#8e9399"), 1, 0.35, tex="brushed", tex_scale=0.2, albedo=False)
    lx, ly = 0.0, -0.05
    p.append(L.box("lap_base", (0.32, 0.225, 0.014), (lx, ly, Hh), lap, bevel=0.004, origin="bottom"))
    keym = L.mat("Keys", hexc("#1d1e20"), 0, 0.5)
    for row in range(5):
        for col in range(13):
            p.append(L.box("key", (0.0175, 0.0165, 0.0016), (lx - 0.12 + col * 0.02, ly + 0.055 - row * 0.0195, Hh + 0.014), keym, bevel=0.0006, origin="bottom"))
    p.append(L.box("trackpad", (0.1, 0.065, 0.0006), (lx, ly - 0.07, Hh + 0.014), L.mat("Trackpad", hexc("#7f848a"), 0.8, 0.3), bevel=0.002, origin="bottom"))
    # lid (open ~105deg), screen faces the user (-Y)
    hinge = (lx, ly + 0.11, Hh + 0.014)
    lid = L.offset_mesh(L.box("lap_lid", (0.32, 0.008, 0.215), (0, 0, 0), lap, bevel=0.003), (0, 0, 0.1075))
    bez = L.offset_mesh(L.box("lap_bezel", (0.31, 0.001, 0.205), (0, 0, 0), L.mat("Bezel", hexc("#0b0b0c"), 0, 0.2), bevel=0.001), (0, -0.0046, 0.1075))
    for o in (lid, bez):
        o.rotation_euler = (math.radians(-15), 0, 0)
        o.location = hinge
    p += [lid, bez]
    # mouse, mug, notebook, lamp
    p.append(L.box("mousepad", (0.24, 0.2, 0.003), (0.32, -0.05, Hh), L.mat("Mousepad", hexc("#2b2e33"), 0, 0.8), bevel=0.002, origin="bottom"))
    p.append(L.box("mouse", (0.06, 0.1, 0.03), (0.32, -0.05, Hh + 0.003), L.mat("MouseBlack", hexc("#18191b"), 0, 0.35), bevel=0.014, segments=3, origin="bottom"))
    mug_m = L.mat("MugOrange", hexc("#ff7a1a"), 0, 0.2, coat=0.8)
    p.append(L.cyl("mug", 0.042, 0.095, (-0.36, 0.05, Hh), mug_m, verts=32, bevel=0.003, origin="bottom"))
    p.append(L.torus("mug_handle", 0.028, 0.007, (-0.405, 0.05, Hh + 0.05), mug_m, rot=(math.radians(90), 0, 0)))
    p.append(L.cyl("coffee", 0.038, 0.002, (-0.36, 0.05, Hh + 0.085), L.mat("Coffee", hexc("#2a160b"), 0, 0.05), verts=32))
    p.append(L.box("notebook", (0.15, 0.21, 0.012), (-0.45, -0.12, Hh), L.mat("NotebookBlack", hexc("#1a1a1a"), 0, 0.6), bevel=0.002, origin="bottom"))
    lamp = L.mat("LampBlack", hexc("#1c1c1e"), 0.4, 0.35)
    p.append(L.cyl("lamp_base", 0.07, 0.02, (0.55, 0.2, Hh), lamp, verts=32, bevel=0.004, origin="bottom"))
    p.append(L.tube_path("lamp_arm", [(0.55, 0.2, Hh + 0.02), (0.52, 0.23, Hh + 0.3), (0.4, 0.12, Hh + 0.45)], 0.008, lamp))
    p.append(L.cyl("lamp_head", 0.055, 0.1, (0.38, 0.1, Hh + 0.42), lamp, verts=32, r2=0.03, bevel=0.003, rot=(math.radians(30), math.radians(-20), 0)))
    cable = L.mat("Cable", hexc("#141414"), 0, 0.5)
    p.append(L.tube_path("lamp_cable", [(0.55, 0.28, Hh + 0.01), (0.62, 0.34, Hh - 0.02), (0.66, 0.34, 0.3), (0.6, 0.33, 0.01), (0.3, 0.3, 0.006)], 0.003, cable))
    p.append(L.tube_path("charger", [(lx + 0.16, ly + 0.04, Hh + 0.007), (lx + 0.3, ly + 0.25, Hh + 0.006), (0.1, 0.34, Hh - 0.05), (0.0, 0.34, 0.2), (-0.1, 0.3, 0.006)], 0.0025, cable))
    p.append(L.box("charger_brick", (0.07, 0.05, 0.025), (-0.12, 0.28, 0.0), L.mat("BrickBlack", hexc("#1a1a1a"), 0, 0.4), bevel=0.006, origin="bottom"))
    L.uv_all(p, 0.4)
    L.join(p, "desk_mesh", r)
    scr = L.offset_mesh(L.box("LaptopScreen", (0.29, 0.001, 0.185), (0, 0, 0), M.screen(), bevel=0), (0, -0.0053, 0.1085))
    scr.rotation_euler = (math.radians(-15), 0, 0)
    scr.location = hinge
    L.uv_all([scr], 0.3)
    scr.parent = r
    cam = L.empty("LaptopCam", (lx, ly - 0.42, Hh + 0.3), r)
    L.empty("LaptopLook", (lx, ly + 0.1, Hh + 0.12), r)
    return r


def office_chair():
    r = L.empty("office_chair", size=0.1)
    p = []
    blk = L.mat("ChairBlack", hexc("#19191b"), 0, 0.5, tex="micro", tex_scale=0.1)
    fabric = L.mat("ChairFabric", hexc("#3a3d44"), 0, 0.9, tex="fabric", tex_scale=0.12)
    chrome = M.steel()
    for k in range(5):
        a = 2 * math.pi * k / 5
        arm = L.box("star", (0.3, 0.045, 0.03), (math.cos(a) * 0.15, math.sin(a) * 0.15, 0.07), blk, bevel=0.008)
        arm.rotation_euler = (0, 0, a)
        p.append(arm)
        p.append(L.cyl("caster", 0.025, 0.025, (math.cos(a) * 0.3, math.sin(a) * 0.3, 0.027), blk, verts=16, rot=(math.radians(90), 0, a), bevel=0.008))
    p.append(L.cyl("gas", 0.022, 0.3, (0, 0, 0.08), chrome, verts=20, origin="bottom"))
    p.append(L.box("seat", (0.5, 0.48, 0.08), (0, 0, 0.44), fabric, bevel=0.03, segments=3, origin="bottom"))
    p.append(L.box("seat_pan", (0.38, 0.36, 0.04), (0, 0, 0.4), blk, bevel=0.01, origin="bottom"))
    back = L.box("back", (0.46, 0.06, 0.55), (0, 0.27, 0.56), fabric, bevel=0.03, segments=3, origin="bottom")
    back.rotation_euler = (math.radians(-8), 0, 0)
    p.append(back)
    p.append(L.box("spine", (0.06, 0.04, 0.3), (0, 0.25, 0.42), blk, bevel=0.01, origin="bottom"))
    for sx in (-1, 1):
        p.append(L.box("arm_post", (0.03, 0.04, 0.2), (sx * 0.25, 0.03, 0.5), blk, bevel=0.008, origin="bottom"))
        p.append(L.box("arm_pad", (0.07, 0.24, 0.03), (sx * 0.25, 0.03, 0.7), blk, bevel=0.012, origin="bottom"))
    L.uv_all(p, 0.3)
    L.join(p, "chair_mesh", r)
    return r


# ----------------------------------------------------------------------------- packing table
def packing_table():
    r = L.empty("packing_table", size=0.1)
    W, D, Hh = 1.6, 0.8, 0.9
    p = []
    fr = powder()
    top = L.mat("PackTop", (1, 1, 1), 0, 0.4, tex="butcher", tex_scale=0.8)
    p.append(L.box("top", (W, D, 0.035), (0, 0, Hh - 0.035), top, bevel=0.004, origin="bottom"))
    for sx in (-1, 1):
        for sy in (-1, 1):
            p.append(L.box("leg", (0.05, 0.05, Hh - 0.035), (sx * (W / 2 - 0.05), sy * (D / 2 - 0.05), 0), fr, bevel=0.004, origin="bottom"))
    p.append(L.box("lower", (W - 0.1, D - 0.1, 0.018), (0, 0, 0.15), chipboard(), bevel=0.002, origin="bottom"))
    # riser shelf at the back
    for sx in (-1, 1):
        p.append(L.box("riser_post", (0.03, 0.03, 0.45), (sx * (W / 2 - 0.05), D / 2 - 0.05, Hh), fr, bevel=0.003, origin="bottom"))
    p.append(L.box("riser", (W - 0.05, 0.24, 0.02), (0, D / 2 - 0.13, Hh + 0.4), chipboard(), bevel=0.002, origin="bottom"))
    # kraft paper roll on bar (left end, above table)
    p.append(L.cyl("paper_bar", 0.012, W - 0.1, (0, D / 2 - 0.05, Hh + 0.25), M.steel(), verts=16, rot=(0, math.radians(90), 0)))
    p.append(L.cyl("paper_roll", 0.07, 0.6, (-0.4, D / 2 - 0.05, Hh + 0.25), L.mat("KraftPaper", (1, 1, 1), 0, 0.9, tex="kraft", tex_scale=0.2, rough_tex=False), verts=40, rot=(0, math.radians(90), 0), bevel=0.004))
    # label printer on riser
    lp = L.mat("LabelPrinter", hexc("#232528"), 0, 0.4, tex="micro", tex_scale=0.1)
    p.append(L.box("label_printer", (0.2, 0.22, 0.16), (0.45, D / 2 - 0.13, Hh + 0.42), lp, bevel=0.02, origin="bottom"))
    p.append(L.box("label_slot", (0.12, 0.004, 0.004), (0.45, D / 2 - 0.241, Hh + 0.55), L.mat("VentDark", (0.004,) * 3, 0, 0.9), bevel=0))
    p.append(L.box("label_led", (0.012, 0.004, 0.006), (0.52, D / 2 - 0.241, Hh + 0.52), L.mat("LEDGreen", hexc("#3dff7a"), 0, 0.3, emission=hexc("#3dff7a"), emission_strength=3), bevel=0))
    # scale
    p.append(L.box("scale", (0.3, 0.3, 0.04), (0.55, -0.1, Hh), L.mat("ScaleSteel", hexc("#c9ccd0"), 1, 0.3, tex="brushed", tex_scale=0.2, albedo=False), bevel=0.006, origin="bottom"))
    p.append(L.box("scale_disp", (0.08, 0.004, 0.025), (0.55, -0.252, Hh + 0.02), L.mat("ScaleLCD", hexc("#0f2a14"), 0, 0.2, emission=hexc("#3dff7a"), emission_strength=0.8), bevel=0.002))
    # tape gun
    tg = L.mat("TapeGunRed", hexc("#c8281e"), 0, 0.4)
    p.append(L.box("tg_body", (0.04, 0.18, 0.05), (-0.62, -0.2, Hh + 0.03), tg, bevel=0.01))
    p.append(L.box("tg_handle", (0.035, 0.04, 0.12), (-0.62, -0.26, Hh + 0.04), tg, bevel=0.012, origin="bottom"))
    p.append(L.cyl("tg_roll", 0.05, 0.05, (-0.62, -0.16, Hh + 0.06), L.mat("PackTape", hexc("#b8874a"), 0, 0.18, coat=0.5), verts=32, rot=(0, math.radians(90), 0)))
    # box cutter
    p.append(L.box("cutter", (0.14, 0.025, 0.015), (-0.2, -0.3, Hh), L.mat("CutterYellow", hexc("#f0c419"), 0, 0.4), bevel=0.005, origin="bottom"))
    L.uv_all(p, 0.4)
    L.join(p, "packing_mesh", r)
    L.empty("PackSlot", (0.0, -0.02, Hh), r)
    L.empty("ItemSlot", (-0.45, 0.1, Hh), r)
    L.empty("PackCam", (0.0, -0.75, Hh + 0.55), r)
    L.empty("PackLook", (0.0, 0.0, Hh + 0.05), r)
    for k in range(3):
        L.empty(f"StockSlot_{k}", (-0.5 + k * 0.5, 0.0, 0.168), r)
    return r


# ----------------------------------------------------------------------------- outbox wire shelf
def outbox_shelf():
    r = L.empty("outbox_shelf", size=0.1)
    W, D, Hh = 1.0, 0.45, 1.1
    chrome = L.mat("ChromeWire", hexc("#d8dadc"), 1, 0.2)
    p = []
    for sx in (-1, 1):
        for sy in (-1, 1):
            p.append(L.cyl("post", 0.0125, Hh, (sx * (W / 2 - 0.0125), sy * (D / 2 - 0.0125), 0), chrome, verts=16, origin="bottom"))
    levels = [0.12, 0.6, 1.05]
    for z in levels:
        for k in range(18):  # wires along Y
            p.append(L.cyl("wire", 0.0025, D - 0.02, (-W / 2 + 0.03 + k * (W - 0.06) / 17, 0, z), chrome, verts=6, rot=(math.radians(90), 0, 0), bevel=0))
        for sy in (-1, 1):
            p.append(L.cyl("rim", 0.005, W, (0, sy * (D / 2 - 0.012), z), chrome, verts=8, rot=(0, math.radians(90), 0), bevel=0))
    L.uv_all(p, 0.3)
    L.join(p, "outbox_mesh", r)
    sign = L.decal("sign", 0.5, 0.156, (0, -D / 2 - 0.003, Hh + 0.12), (math.radians(90), 0, 0), "decal_outbox.png", rough=0.5)
    sign.parent = r
    post = L.box("sign_post", (0.02, 0.01, 0.2), (0, -D / 2 + 0.004, Hh - 0.05), chrome, bevel=0.002, origin="bottom")
    post.parent = r
    n = 0
    for z in levels[:2]:
        for k in range(3):
            L.empty(f"OutSlot_{n}", (-0.32 + k * 0.32, 0.0, z + 0.005), r)
            n += 1
    return r


# ----------------------------------------------------------------------------- pegboard with tools
def pegboard():
    r = L.empty("pegboard", size=0.1)
    W, Hh = 1.4, 0.7
    board = L.decal("board", W, Hh, (0, -0.006, 0), (math.radians(90), 0, 0), "decal_pegboard.png", rough=0.8)
    bm = board.data
    # tile UVs so holes stay round (texture tile = 0.5 m)
    for loop_uv in bm.uv_layers[0].data:
        loop_uv.uv = (loop_uv.uv[0] * W / 0.5, loop_uv.uv[1] * Hh / 0.5)
    board.parent = r
    p = [L.box("frame", (W + 0.03, 0.012, Hh + 0.03), (0, 0.0, 0), L.mat("PegFrame", hexc("#6b4f33"), 0, 0.7), bevel=0.003)]
    red = L.mat("HandleRed", hexc("#c62a22"), 0, 0.5)
    blue = L.mat("HandleBlue", hexc("#2a5fc6"), 0, 0.5)
    yel = L.mat("HandleYellow", hexc("#f0c419"), 0, 0.5)
    steel = M.steel()
    hook = M.dark_steel()
    def tool(x, z, parts):
        p.append(L.cyl("hook", 0.003, 0.05, (x, -0.03, z + 0.05), hook, verts=8, rot=(math.radians(90), 0, 0), bevel=0))
        for o in parts:
            o.location.x += x
            o.location.z += z
            p.append(o)
    # pliers
    tool(-0.55, 0.05, [L.box("pl_a", (0.018, 0.012, 0.12), (-0.012, -0.04, -0.05), red, bevel=0.005),
                       L.box("pl_b", (0.018, 0.012, 0.12), (0.012, -0.04, -0.05), red, bevel=0.005),
                       L.box("pl_jaw", (0.02, 0.01, 0.06), (0, -0.04, 0.04), steel, bevel=0.003)])
    # flush cutters
    tool(-0.38, 0.05, [L.box("fc_a", (0.014, 0.01, 0.09), (-0.01, -0.04, -0.04), blue, bevel=0.004),
                       L.box("fc_b", (0.014, 0.01, 0.09), (0.01, -0.04, -0.04), blue, bevel=0.004),
                       L.box("fc_jaw", (0.016, 0.008, 0.03), (0, -0.04, 0.025), steel, bevel=0.002)])
    # scraper / spatula
    tool(-0.18, 0.1, [L.box("sc_h", (0.03, 0.02, 0.12), (0, -0.04, -0.02), yel, bevel=0.008),
                      L.box("sc_blade", (0.07, 0.002, 0.08), (0, -0.04, -0.12), steel, bevel=0.001)])
    # hex keys fan
    for i in range(6):
        k = L.box("hex", (0.004, 0.004, 0.08 + i * 0.012), (0.05 + i * 0.012, -0.04, -0.02), hook, bevel=0.001)
        tool(0.0, 0.05, [k])
    # caliper
    tool(0.32, 0.1, [L.box("cal_beam", (0.02, 0.004, 0.22), (0, -0.04, -0.08), steel, bevel=0.001),
                     L.box("cal_head", (0.06, 0.014, 0.05), (0.02, -0.04, -0.02), L.mat("CalBlack", hexc("#1b1b1b"), 0, 0.4), bevel=0.004)])
    # scissors
    tool(0.55, 0.05, [L.torus("sci_a", 0.022, 0.005, (-0.018, -0.04, -0.03), yel, rot=(math.radians(90), 0, 0)),
                      L.torus("sci_b", 0.022, 0.005, (0.018, -0.04, -0.03), yel, rot=(math.radians(90), 0, 0)),
                      L.box("sci_blade", (0.012, 0.004, 0.11), (0, -0.04, 0.05), steel, bevel=0.001)])
    # tape measure + spare nozzles box on a shelf strip
    p.append(L.box("peg_shelf", (0.4, 0.1, 0.012), (0.2, -0.06, -0.28), hook, bevel=0.002))
    p.append(L.box("tape_measure", (0.07, 0.035, 0.07), (0.1, -0.06, -0.24), yel, bevel=0.012))
    p.append(L.box("nozzle_box", (0.1, 0.06, 0.035), (0.26, -0.06, -0.255), L.mat("NozzleBox", hexc("#dfe3e6"), 0, 0.2, alpha=0.85), bevel=0.004))
    L.uv_all(p, 0.3)
    L.join(p, "pegboard_mesh", r)
    return r


# ----------------------------------------------------------------------------- small props
def trash_bin():
    r = L.empty("trash_bin", size=0.05)
    g = L.mat("BinGrey", hexc("#4b5058"), 0, 0.5, tex="micro", tex_scale=0.1)
    b = L.lathe("bin", [(0.0, 0.0), (0.15, 0.0), (0.18, 0.58), (0.185, 0.6), (0.17, 0.6), (0.155, 0.02), (0.0, 0.02)], material=g, verts=48)
    lid = L.cyl("lid", 0.19, 0.03, (0, 0, 0.6), g, verts=48, bevel=0.008, origin="bottom")
    # some spaghetti poking out
    L.uv_all([b, lid], 0.3)
    L.join([b, lid], "bin_mesh", r)
    L.empty("TrashDrop", (0, 0, 0.65), r)
    return r


def fire_extinguisher():
    r = L.empty("fire_extinguisher", size=0.05)
    red = L.mat("ExtRed", hexc("#c4161c"), 0.3, 0.3, coat=0.6)
    blk = M.black_plastic()
    p = [L.cyl("body", 0.075, 0.42, (0, -0.09, 0.0), red, verts=32, bevel=0.03, origin="bottom"),
         L.cyl("neck", 0.03, 0.05, (0, -0.09, 0.42), M.steel(), verts=16, origin="bottom"),
         L.box("handle", (0.03, 0.12, 0.02), (0, -0.11, 0.48), blk, bevel=0.006),
         L.box("bracket", (0.08, 0.02, 0.12), (0, -0.01, 0.25), M.dark_steel(), bevel=0.004, origin="bottom")]
    p.append(L.tube_path("hose", [(0.03, -0.13, 0.46), (0.07, -0.16, 0.3), (0.06, -0.16, 0.12)], 0.009, blk))
    p.append(L.box("ext_label", (0.1, 0.002, 0.14), (0, -0.166, 0.2), L.mat("ExtLabel", hexc("#f4f1e8"), 0, 0.5), bevel=0.001))
    L.uv_all(p, 0.2)
    L.join(p, "ext_mesh", r)
    return r


def wall_clock():
    r = L.empty("wall_clock", size=0.05)
    face = L.mat("ClockFace", hexc("#f7f6f2"), 0, 0.4)
    rim = L.mat("ClockRim", hexc("#1f1f1f"), 0.3, 0.35)
    p = [L.cyl("rim", 0.16, 0.04, (0, -0.02, 0), rim, verts=48, bevel=0.008, rot=(math.radians(90), 0, 0)),
         L.cyl("face", 0.145, 0.004, (0, -0.041, 0), face, verts=48, rot=(math.radians(90), 0, 0))]
    for k in range(12):
        a = 2 * math.pi * k / 12
        t = L.box("tick", (0.006 if k % 3 else 0.01, 0.002, 0.024 if k % 3 else 0.034), (math.sin(a) * 0.125, -0.044, math.cos(a) * 0.125), rim, bevel=0)
        t.rotation_euler = (0, a, 0)
        p.append(t)
    p.append(L.cyl("pin", 0.008, 0.012, (0, -0.048, 0), rim, verts=16, rot=(math.radians(90), 0, 0)))
    L.uv_all(p, 0.2)
    L.join(p, "clock_mesh", r)
    hh = L.empty("HourHand", (0, -0.046, 0), r)
    L.join([L.box("hour", (0.01, 0.002, 0.075), (0, -0.046, 0.03), rim, bevel=0)], "hour_mesh", hh)
    mh = L.empty("MinuteHand", (0, -0.05, 0), r)
    L.join([L.box("minute", (0.006, 0.002, 0.11), (0, -0.05, 0.045), rim, bevel=0)], "minute_mesh", mh)
    return r


def radio():
    r = L.empty("radio", size=0.05)
    body = L.mat("RadioBody", hexc("#3c5a48"), 0.1, 0.45, tex="micro", tex_scale=0.1)
    grille = L.mat("RadioGrille", hexc("#1a1a1a"), 0.6, 0.5, tex="carbon", tex_scale=0.01, albedo=False)
    p = [L.box("body", (0.34, 0.12, 0.19), (0, 0, 0), body, bevel=0.02, segments=3, origin="bottom")]
    for sx in (-1, 1):
        p.append(L.cyl("spk", 0.055, 0.01, (sx * 0.1, -0.062, 0.09), grille, verts=32, rot=(math.radians(90), 0, 0)))
    p.append(L.box("dial", (0.08, 0.006, 0.03), (0, -0.062, 0.145), L.mat("RadioDial", hexc("#f3e7c8"), 0, 0.3, emission=hexc("#ffcf7a"), emission_strength=0.6), bevel=0.003))
    p.append(L.box("handle", (0.26, 0.03, 0.02), (0, 0, 0.22), M.dark_steel(), bevel=0.008))
    p.append(L.cyl("antenna", 0.003, 0.3, (0.14, 0.04, 0.19), M.steel(), verts=8, rot=(math.radians(-20), math.radians(25), 0), origin="bottom"))
    for sx in (-0.03, 0.03):
        p.append(knob("knob", 0.012, 0.012, (sx, -0.06, 0.1), rot=(math.radians(90), 0, 0)))
    L.uv_all(p, 0.2)
    L.join(p, "radio_mesh", r)
    return r


def poster():
    r = L.empty("poster", size=0.05)
    fr = L.box("frame", (0.62, 0.02, 0.86), (0, -0.01, 0), L.mat("FrameBlack", hexc("#151515"), 0, 0.4), bevel=0.004)
    L.join([fr], "poster_frame", r)
    d = L.decal("art", 0.58, 0.82, (0, -0.021, 0), (math.radians(90), 0, 0), "decal_poster.png", rough=0.4)
    d.parent = r
    return r


def calendar():
    r = L.empty("calendar", size=0.05)
    d = L.decal("cal", 0.3, 0.39, (0, -0.002, 0), (math.radians(90), 0, 0), "decal_calendar.png", rough=0.7)
    d.parent = r
    return r


def shop_vac():
    r = L.empty("shop_vac", size=0.05)
    y = L.mat("VacYellow", hexc("#e8b21c"), 0, 0.4, tex="micro", tex_scale=0.1)
    k = M.black_plastic()
    p = [L.cyl("drum", 0.2, 0.38, (0, 0, 0.05), y, verts=40, bevel=0.02, origin="bottom"),
         L.cyl("head", 0.21, 0.14, (0, 0, 0.43), k, verts=40, bevel=0.03, origin="bottom"),
         L.box("handle", (0.2, 0.04, 0.05), (0, 0, 0.6), k, bevel=0.015)]
    for a in range(4):
        p.append(L.cyl("wheel", 0.03, 0.025, (math.cos(a * 1.57) * 0.17, math.sin(a * 1.57) * 0.17, 0.03), k, verts=16, rot=(math.radians(90), 0, a * 1.57)))
    p.append(L.tube_path("hose", [(0.18, 0, 0.3), (0.35, 0.1, 0.2), (0.4, 0.3, 0.04), (0.2, 0.45, 0.03)], 0.022, k))
    L.uv_all(p, 0.3)
    L.join(p, "vac_mesh", r)
    return r


# ============================================================================ M1.1 set dressing
def osb_wall():
    """Three 1.22 x 2.44 m OSB sheets screwed to the back wall (maker-garage classic)."""
    r = L.empty("osb_wall", size=0.1)
    osb = L.mat("OSB", (1, 1, 1), 0, 0.72, tex="osb", tex_scale=1.2)
    p = []
    for i, x in enumerate((-1.22, 0.0, 1.22)):
        p.append(L.box(f"sheet{i}", (1.215, 0.012, 2.44), (x, -0.006, 0), osb, bevel=0.0015, origin="bottom"))
        for zx in (-0.55, 0.0, 0.55):
            for zz in (0.15, 0.8, 1.45, 2.1):
                p.append(L.cyl("screw", 0.004, 0.001, (x + zx, -0.0125, zz), M.dark_steel(), verts=8, rot=(math.radians(90), 0, 0), bevel=0))
    L.uv_all(p, 1.2)
    L.join(p, "osb_mesh", r)
    return r


def tool_chest():
    """Red rolling tool cabinet with 6 drawers and a top chest."""
    r = L.empty("tool_chest", size=0.1)
    red = L.mat("ChestRed", hexc("#a3201d"), 0.45, 0.4, tex="powder", tex_scale=0.25)
    alu = M.alu()
    blk = M.black_plastic()
    W, D = 0.68, 0.46
    p = [L.box("cab", (W, D, 0.78), (0, 0, 0.09), red, bevel=0.008, origin="bottom"),
         L.box("top_chest", (W, D * 0.92, 0.3), (0, 0.01, 0.875), red, bevel=0.01, origin="bottom"),
         L.box("top_lid", (W + 0.01, D * 0.94, 0.02), (0, 0.01, 1.175), red, bevel=0.006, origin="bottom"),
         L.box("mat_top", (W - 0.04, D * 0.86, 0.004), (0, 0.01, 1.195), L.mat("ChestMat", hexc("#1a1a1a"), 0, 0.9, tex="rubber", tex_scale=0.1), bevel=0.001, origin="bottom")]
    hs = [0.08, 0.08, 0.1, 0.12, 0.14, 0.18]
    z = 0.1
    for i, hh in enumerate(hs):
        p.append(L.box("drawer", (W - 0.04, 0.006, hh - 0.01), (0, -D / 2 - 0.002, z), red, bevel=0.003, origin="bottom"))
        p.append(L.box("handle", (W * 0.6, 0.022, 0.014), (0, -D / 2 - 0.014, z + hh - 0.03), alu, bevel=0.004))
        z += hh + 0.005
    for i in range(3):
        p.append(L.box("drawer_t", (W - 0.06, 0.006, 0.07), (0, -D * 0.46 - 0.004 + 0.01, 0.9 + i * 0.085), red, bevel=0.003, origin="bottom"))
        p.append(L.box("handle_t", (W * 0.5, 0.018, 0.012), (0, -D * 0.46 - 0.014 + 0.01, 0.945 + i * 0.085), alu, bevel=0.004))
    p.append(L.box("sidehandle", (0.02, 0.3, 0.03), (W / 2 + 0.03, 0, 0.8), alu, bevel=0.008))
    for sx in (-1, 1):
        for sy in (-1, 1):
            p.append(L.cyl("caster", 0.04, 0.03, (sx * (W / 2 - 0.06), sy * (D / 2 - 0.06), 0.04), blk, verts=20, rot=(0, math.radians(90), 0), bevel=0.01))
            p.append(L.box("caster_fork", (0.05, 0.05, 0.05), (sx * (W / 2 - 0.06), sy * (D / 2 - 0.06), 0.07), M.dark_steel(), bevel=0.005))
    p.append(L.text("brand", "KRAFTLINE", 0.03, 0.001, (0, -D / 2 - 0.006, 0.84), (math.radians(90), 0, 0), M.white_print()))
    L.uv_all(p, 0.3)
    L.join(p, "chest_mesh", r)
    return r


def wall_shelf():
    """Plywood wall shelf on steel brackets: paint cans, spray cans, IPA bottle, tape, glue."""
    r = L.empty("wall_shelf", size=0.1)
    p = [L.box("board", (1.0, 0.22, 0.022), (0, -0.11, 0), L.mat("Plywood", (1, 1, 1), 0, 0.7, tex="plywood", tex_scale=0.6), bevel=0.003)]
    for x in (-0.4, 0.4):
        p.append(L.prism("bracket", [(0, 0), (0.2, 0), (0.02, -0.2), (0, -0.2)], 0.02, (x - 0.01, 0.0, -0.012), M.dark_steel(), axis="x", bevel=0.002))
    L.uv_all(p, 0.6)
    items = []
    def can(x, label, rr=0.055, hh=0.12):
        c = L.cyl("can", rr, hh, (x, -0.11, 0.011), L.mat("CanSteel", hexc("#b9bcc0"), 1, 0.35, tex="brushed", tex_scale=0.2, albedo=False), verts=32, bevel=0.004, origin="bottom")
        lab = L.lathe("canlabel", [(rr + 0.0006, 0.015), (rr + 0.0006, hh - 0.015)], material=L.image_mat(f"Label_{label}", L.TEX / f"decal_{label}.png", rough=0.5), verts=32, cap=False)
        lab.location = (x, -0.11, 0.011)
        # cylindrical UVs for the label
        me = lab.data
        uvl = me.uv_layers.new(name="UVMap")
        for poly in me.polygons:
            for li in poly.loop_indices:
                v = me.vertices[me.loops[li].vertex_index].co
                a = math.atan2(v.y, v.x)
                uvl.data[li].uv = ((a / (2 * math.pi)) % 1.0, (v.z - 0.015) / (hh - 0.03))
        return [c, lab, L.cyl("lid", rr * 0.96, 0.006, (x, -0.11, 0.011 + hh), M.dark_steel(), verts=32, bevel=0.002, origin="bottom")]
    items += can(-0.36, "paint") + can(-0.22, "paint2", 0.05, 0.1)
    for i, x in enumerate((-0.05, 0.02)):
        items.append(L.cyl("spray", 0.033, 0.2, (x, -0.09 - i * 0.03, 0.011), L.image_mat("Label_spray", L.TEX / "decal_spray.png", rough=0.4, metal=0.3), verts=24, bevel=0.005, origin="bottom"))
        items.append(L.cyl("spray_cap", 0.028, 0.04, (x, -0.09 - i * 0.03, 0.211), L.mat("CapWhite", hexc("#ececec"), 0, 0.35), verts=24, bevel=0.006, origin="bottom"))
    items.append(L.cyl("ipa", 0.035, 0.18, (0.16, -0.12, 0.011), L.image_mat("Label_ipa", L.TEX / "decal_ipa.png", rough=0.3), verts=24, bevel=0.006, origin="bottom"))
    items.append(L.cyl("ipa_pump", 0.012, 0.05, (0.16, -0.12, 0.19), M.black_plastic(), verts=12, origin="bottom"))
    items.append(L.torus("tape_roll", 0.045, 0.022, (0.3, -0.12, 0.04), L.mat("MaskTape", hexc("#d8c89a"), 0, 0.7)))
    items.append(L.cyl("glue", 0.012, 0.09, (0.42, -0.06, 0.011), L.mat("GluePurple", hexc("#7a4fd1"), 0, 0.4), verts=16, origin="bottom"))
    items.append(L.box("nozzle_box", (0.08, 0.05, 0.03), (0.42, -0.15, 0.011), L.mat("NozzleBox", hexc("#dfe3e6"), 0, 0.2, alpha=0.85), bevel=0.004, origin="bottom"))
    for o in items:
        if not o.data.uv_layers:
            L.box_uv(o, 0.2)
    L.join(p, "shelf_board", r)
    L.join(items, "shelf_items", r)
    return r


def floor_mat():
    r = L.empty("floor_mat", size=0.1)
    m = L.mat("MatRubber", hexc("#202123"), 0, 0.8, tex="rubber", tex_scale=0.1, albedo=False)
    p = [L.prism("mat", L.rounded_rect(1.8, 0.9, 0.04), 0.014, (0, 0, 0), m, bevel=0.006)]
    L.uv_all(p, 0.3)
    L.join(p, "mat_mesh", r)
    return r


def rug():
    r = L.empty("rug", size=0.1)
    d = L.decal("rug_top", 1.6, 1.1, (0, 0, 0.006), (0, 0, 0), "decal_rug.png", rough=0.95)
    d.parent = r
    edge = L.box("rug_base", (1.6, 1.1, 0.005), (0, 0, 0), L.mat("RugEdge", hexc("#3a1d17"), 0, 0.95, tex="fabric", tex_scale=0.1), bevel=0.002, origin="bottom")
    L.uv_all([edge], 0.2)
    L.join([edge], "rug_base", r)
    return r


def broom():
    r = L.empty("broom", size=0.05)
    wood = L.mat("BroomStick", hexc("#b88a55"), 0, 0.6, tex="plywood", tex_scale=0.3)
    p = [L.cyl("stick", 0.012, 1.3, (0, 0, 0.12), wood, verts=12, origin="bottom"),
         L.box("head", (0.32, 0.06, 0.05), (0, 0, 0.09), L.mat("BroomHead", hexc("#2b5fb0"), 0, 0.5), bevel=0.01, origin="bottom"),
         L.box("bristles", (0.31, 0.055, 0.09), (0, 0, 0.0), L.mat("Bristles", hexc("#3a3a3a"), 0, 0.9, tex="fabric", tex_scale=0.05), bevel=0.006, origin="bottom")]
    L.uv_all(p, 0.3)
    j = L.join(p, "broom_mesh", r)
    j.rotation_euler = (math.radians(-12), 0, 0)
    return r


def step_ladder():
    r = L.empty("step_ladder", size=0.05)
    alu = M.alu()
    p = []
    for sx in (-1, 1):
        p.append(L.box("rail", (0.025, 0.07, 1.6), (sx * 0.22, 0, 0), alu, bevel=0.004, origin="bottom"))
    for k in range(5):
        p.append(L.box("step", (0.44, 0.1, 0.025), (0, -0.01, 0.3 + k * 0.28), L.mat("StepRibbed", hexc("#a9adb1"), 1, 0.45, tex="powder", tex_scale=0.1), bevel=0.003))
    p.append(L.box("top_cap", (0.5, 0.14, 0.06), (0, 0, 1.6), L.mat("LadderCap", hexc("#e0a526"), 0, 0.5), bevel=0.01, origin="bottom"))
    for sx in (-1, 1):
        p.append(L.box("foot", (0.04, 0.08, 0.03), (sx * 0.22, 0, 0), M.rubber(), bevel=0.005, origin="bottom"))
    L.uv_all(p, 0.3)
    j = L.join(p, "ladder_mesh", r)
    j.rotation_euler = (math.radians(-10), 0, 0)
    return r


def box_stack():
    r = L.empty("box_stack", size=0.1)
    card = L.mat("Cardboard", (1, 1, 1), 0, 0.85, tex="cardboard", tex_scale=0.35)
    tape = L.mat("PackTape", hexc("#b8874a"), 0, 0.18, coat=0.5)
    rr = random.Random(7)
    p = []
    z = 0.0
    for i, (w, d, h) in enumerate([(0.6, 0.45, 0.4), (0.5, 0.4, 0.35), (0.45, 0.35, 0.3), (0.35, 0.3, 0.25)]):
        b = L.box(f"b{i}", (w, d, h), (rr.uniform(-0.04, 0.04), rr.uniform(-0.03, 0.03), z), card, bevel=0.006, origin="bottom")
        b.rotation_euler = (0, 0, math.radians(rr.uniform(-8, 8)))
        p.append(b)
        t = L.box(f"t{i}", (0.05, d + 0.002, 0.0008), (b.location.x, b.location.y, z + h + 0.0004), tape, bevel=0)
        t.rotation_euler = b.rotation_euler
        p.append(t)
        z += h
    L.uv_all(p, 0.35)
    L.join(p, "stack_mesh", r)
    lab = L.decal("stack_label", 0.1, 0.15, (0.05, -0.226, 0.2), (math.radians(90), 0, math.radians(0)), "decal_label.png")
    lab.parent = r
    return r


def mini_fridge():
    r = L.empty("mini_fridge", size=0.1)
    white = L.mat("FridgeWhite", hexc("#e9e8e3"), 0.1, 0.35, tex="plastic", tex_scale=0.3)
    p = [L.box("body", (0.48, 0.5, 0.84), (0, 0, 0.02), white, bevel=0.02, segments=3, origin="bottom"),
         L.box("door_gap", (0.46, 0.004, 0.003), (0, -0.252, 0.62), L.mat("SeamDark", hexc("#2a2a2a"), 0, 0.9), bevel=0),
         L.box("handle", (0.02, 0.03, 0.3), (0.2, -0.265, 0.4), M.dark_steel(), bevel=0.008, origin="bottom"),
         L.box("plinth", (0.44, 0.46, 0.02), (0, 0.0, 0.0), M.black_plastic(), bevel=0.004, origin="bottom")]
    rr = random.Random(11)
    for i in range(5):
        c = ["#d42a23", "#2160d0", "#f3c21b", "#2fa84f", "#ff6a13"][i]
        p.append(L.box("magnet", (0.035, 0.008, 0.035), (rr.uniform(-0.15, 0.12), -0.255, rr.uniform(0.35, 0.75)), L.mat(f"Magnet{i}", hexc(c), 0, 0.3), bevel=0.004))
    p.append(L.box("note", (0.09, 0.002, 0.11), (-0.08, -0.253, 0.58), L.mat("NotePaper", hexc("#fff4a8"), 0, 0.8), bevel=0.0005))
    L.uv_all(p, 0.3)
    L.join(p, "fridge_mesh", r)
    return r


def poster_benchy():
    r = L.empty("poster_benchy", size=0.05)
    fr = L.box("frame", (0.54, 0.02, 0.74), (0, -0.01, 0), L.mat("FrameBlack", hexc("#151515"), 0, 0.4), bevel=0.004)
    L.join([fr], "frame_mesh", r)
    d = L.decal("art", 0.5, 0.7, (0, -0.021, 0), (math.radians(90), 0, 0), "decal_benchy.png", rough=0.4)
    d.parent = r
    return r


def bench_clutter():
    """Small things lying on the workbench front edge (placed as a child of the workbench in the layout)."""
    r = L.empty("bench_clutter", size=0.05)
    p = [L.box("scraper_h", (0.11, 0.03, 0.02), (-0.62, -0.26, 0.0), L.mat("HandleYellow", hexc("#f0c419"), 0, 0.5), bevel=0.006, origin="bottom"),
         L.box("scraper_b", (0.07, 0.045, 0.002), (-0.53, -0.26, 0.0), M.steel(), bevel=0.0005, origin="bottom"),
         L.cyl("gluestick", 0.012, 0.095, (0.62, -0.27, 0.012), L.mat("GluePurple", hexc("#7a4fd1"), 0, 0.4), verts=16, rot=(0, math.radians(90), 0.3)),
         L.box("calipers", (0.22, 0.035, 0.006), (0.0, -0.29, 0.0), M.steel(), bevel=0.001, origin="bottom"),
         L.box("calipers_head", (0.04, 0.06, 0.012), (-0.09, -0.29, 0.0), L.mat("CalBlack", hexc("#1b1b1b"), 0, 0.4), bevel=0.003, origin="bottom")]
    # filament off-cuts: little curls of coloured filament
    rr = random.Random(4)
    for i, c in enumerate(["#d42a23", "#2160d0", "#eeeeea", "#ff6a13"]):
        pts = []
        cx, cy = rr.uniform(-1.1, 1.1), rr.uniform(-0.3, -0.24)
        for k in range(14):
            a = k * 0.9
            pts.append((cx + math.cos(a) * 0.018 + k * 0.004, cy + math.sin(a) * 0.014, 0.001 + (k % 3) * 0.0008))
        p.append(L.tube_path(f"offcut{i}", pts, 0.0009, L.mat(f"Offcut{i}", hexc(c), 0, 0.35)))
    L.uv_all(p, 0.2)
    L.join(p, "clutter_mesh", r)
    return r


# ============================================================================ M2: farm furniture + dryer
def print_table():
    """Heavy-duty island print table (2.7 x 0.9 m), 3 wide printer slots (size class L)."""
    r = L.empty("print_table", size=0.1)
    W, D, Hh = 2.7, 0.9, 0.85
    steel = powder("TableSteel", "#2f3338")
    top_m = L.mat("PhenolicTop", hexc("#8d9096"), 0, 0.45, tex="plastic", tex_scale=0.3)
    p = [L.box("top", (W, D, 0.035), (0, 0, Hh - 0.035), top_m, bevel=0.004, origin="bottom"),
         L.box("top_edge", (W + 0.01, D + 0.01, 0.012), (0, 0, Hh - 0.047), L.mat("EdgeBand", hexc("#1c1d1f"), 0, 0.5), bevel=0.003, origin="bottom")]
    for sx in (-1, 0, 1):
        for sy in (-1, 1):
            p.append(L.box("leg", (0.06, 0.06, Hh - 0.05), (sx * (W / 2 - 0.07), sy * (D / 2 - 0.07), 0), steel, bevel=0.005, origin="bottom"))
            p.append(L.cyl("foot", 0.035, 0.012, (sx * (W / 2 - 0.07), sy * (D / 2 - 0.07), 0.0), M.rubber(), verts=16, origin="bottom"))
    for sy in (-1, 1):
        p.append(L.box("rail", (W - 0.1, 0.05, 0.08), (0, sy * (D / 2 - 0.07), Hh - 0.13), steel, bevel=0.004))
        p.append(L.box("rail_low", (W - 0.1, 0.05, 0.05), (0, sy * (D / 2 - 0.07), 0.16), steel, bevel=0.004))
    p.append(L.box("shelf", (W - 0.16, D - 0.12, 0.02), (0, 0, 0.19), L.mat("Plywood", (1, 1, 1), 0, 0.7, tex="plywood", tex_scale=0.6), bevel=0.002, origin="bottom"))
    # spool storage bins on the lower shelf + a long power strip
    for i, x in enumerate((-0.85, 0.0, 0.85)):
        p += tote(f"ptote{i}", 0.5, 0.6, 0.26, ["#3a3f46", "#b9c2cb", "#3a3f46"][i], ["#e0a526", "#3a3f46", "#2c6fd1"][i], (x, 0.0, 0.21))
    p.append(L.box("strip", (0.8, 0.05, 0.04), (0.6, D / 2 - 0.1, Hh - 0.08), L.mat("StripWhite", hexc("#ececea"), 0, 0.4), bevel=0.008))
    L.uv_all(p, 0.5)
    L.join(p, "table_mesh", r)
    for i, x in enumerate((-0.88, 0.0, 0.88)):
        L.empty(f"Slot_{i}", (x, -0.03, Hh), r)
    return r


def xl_cart():
    """Rolling steel cabinet the Prusa XL stands on (size class XL)."""
    r = L.empty("xl_cart", size=0.1)
    W, D, Hh = 0.9, 0.82, 0.42
    blue = L.mat("CartGrey", hexc("#3b4148"), 0.45, 0.45, tex="powder", tex_scale=0.25)
    p = [L.box("body", (W, D, Hh - 0.09), (0, 0, 0.09), blue, bevel=0.008, origin="bottom"),
         L.box("top", (W + 0.02, D + 0.02, 0.025), (0, 0, Hh - 0.025), L.mat("PhenolicTop", hexc("#8d9096"), 0, 0.45, tex="plastic", tex_scale=0.3), bevel=0.004, origin="bottom")]
    for k in range(2):
        p.append(L.box("drawer", (W - 0.06, 0.006, 0.13), (0, -D / 2 - 0.002, 0.12 + k * 0.15), blue, bevel=0.003, origin="bottom"))
        p.append(L.box("handle", (W * 0.5, 0.02, 0.014), (0, -D / 2 - 0.014, 0.22 + k * 0.15), M.alu(), bevel=0.004))
    for sx in (-1, 1):
        for sy in (-1, 1):
            p.append(L.cyl("caster", 0.04, 0.03, (sx * (W / 2 - 0.07), sy * (D / 2 - 0.07), 0.04), M.black_plastic(), verts=20, rot=(0, math.radians(90), 0), bevel=0.01))
    L.uv_all(p, 0.4)
    L.join(p, "cart_mesh", r)
    L.empty("Slot_0", (0, 0, Hh), r)
    return r


def filament_dryer():
    """Dual-spool filament dryer after the Creality Space Pi Plus type: a hollow rounded shell with a front window and
    a smoked see-through lid (spools visible from the orbit camera), spools standing on rollers with their axis across
    the width, a front control panel with LCD (material DryerScreen) and two buttons, filament outlets on top.
    Spool slots DryerSlot_0/1 are rotated so a spool's own axis (local Z in three.js) runs along the dryer's width."""
    r = L.empty("filament_dryer", size=0.05)
    W, D, Hh = 0.37, 0.27, 0.25
    body = L.mat("DryerGrey", hexc("#dcdcd8"), 0, 0.38, tex="plastic", tex_scale=0.1)
    dark = L.mat("DryerDark", hexc("#2a2d31"), 0, 0.45, tex="plastic", tex_scale=0.1)
    inner_m = L.mat("DryerInner", hexc("#8d9096"), 0, 0.55, tex="plastic", tex_scale=0.1)
    metal = L.mat("DryerRoller", hexc("#b9bcc0"), 1.0, 0.3)
    shell = L.box("shell", (W, D, Hh), (0, 0, 0), body, bevel=0.02, segments=3, origin="bottom")
    cuts = [L.box("cavity", (W - 0.016, D - 0.016, Hh), (0, 0, 0.008), None, bevel=0.01, origin="bottom"),
            L.box("window_cut", (W - 0.125, 0.05, Hh - 0.075), (-0.03, -D / 2, 0.035), None, bevel=0.012, origin="bottom")]
    for c in cuts:
        bo = shell.modifiers.new("c", "BOOLEAN"); bo.object = c; bo.operation = "DIFFERENCE"
        L.apply_modifiers(shell)
        bpy.data.objects.remove(c)
    shell.data.materials.append(inner_m)
    # faces pointing into the cavity get the darker inner plastic
    for poly in shell.data.polygons:
        c = poly.center
        if abs(c.x) < W / 2 - 0.009 and abs(c.y) < D / 2 - 0.009 and c.z > 0.006 and poly.normal.z > -0.5:
            inward = (poly.normal.x * c.x + poly.normal.y * c.y) < 0 or poly.normal.z > 0.5
            if inward:
                poly.material_index = 1
    p = [shell]
    # lid rim (dark) around the smoked lid
    rim = L.box("lid_rim", (W, D, 0.014), (0, 0, Hh), dark, bevel=0.012, segments=3, origin="bottom")
    hole = L.box("lid_hole", (W - 0.05, D - 0.05, 0.05), (0, 0, Hh - 0.01), None, bevel=0.01, origin="bottom")
    bo = rim.modifiers.new("c", "BOOLEAN"); bo.object = hole; bo.operation = "DIFFERENCE"
    L.apply_modifiers(rim)
    bpy.data.objects.remove(hole)
    p.append(rim)
    # front control panel with buttons
    p.append(L.box("panel", (0.075, 0.006, Hh - 0.07), (W / 2 - 0.052, -D / 2 - 0.002, 0.03), dark, bevel=0.005, origin="bottom"))
    for k in range(2):
        p.append(L.cyl("button", 0.007, 0.006, (W / 2 - 0.064 + k * 0.024, -D / 2 - 0.006, 0.07), dark, verts=16, bevel=0.0015,
                       rot=(math.radians(90), 0, 0)))
    # window frame
    fr = L.box("win_frame", (W - 0.11, 0.006, Hh - 0.06), (-0.03, -D / 2 - 0.001, 0.0275), dark, bevel=0.006, origin="bottom")
    fh = L.box("win_frame_cut", (W - 0.125, 0.05, Hh - 0.075), (-0.03, -D / 2, 0.035), None, bevel=0.012, origin="bottom")
    bo = fr.modifiers.new("c", "BOOLEAN"); bo.object = fh; bo.operation = "DIFFERENCE"
    L.apply_modifiers(fr)
    bpy.data.objects.remove(fh)
    p.append(fr)
    # rollers the spools sit on, filament outlets (with short PTFE stubs), feet, side vents
    for sy in (-1, 1):
        p.append(L.cyl("roller", 0.008, W - 0.05, (0, sy * 0.06, 0.047), metal, verts=20, bevel=0.001, rot=(0, math.radians(90), 0)))
    for sx in (-0.085, 0.0):
        p.append(L.cyl("outlet", 0.009, 0.012, (sx, 0.05, Hh + 0.014), dark, verts=16, bevel=0.002, origin="bottom"))
        p.append(L.cyl("ptfe", 0.002, 0.03, (sx, 0.05, Hh + 0.026), L.mat("PTFE", hexc("#f2f2ee"), 0, 0.35, alpha=1.0), verts=10, bevel=0, origin="bottom"))
    for fx in (-1, 1):
        for fy in (-1, 1):
            p.append(L.cyl("foot", 0.012, 0.006, (fx * (W / 2 - 0.03), fy * (D / 2 - 0.03), -0.005), L.mat("Rubber", hexc("#141414"), 0, 0.8), verts=16, bevel=0.001, origin="bottom"))
    for k in range(4):
        p.append(L.box("vent", (0.004, 0.12, 0.005), (W / 2 + 0.0005, 0.03, 0.06 + k * 0.028), L.mat("VentDark", (0.004,) * 3, 0, 0.9), bevel=0.001))
    L.uv_all(p, 0.2)
    L.join(p, "dryer_mesh", r)
    glass = L.box("dryer_glass", (W - 0.115, 0.003, Hh - 0.07), (-0.03, -D / 2 + 0.004, 0.0325), L.mat("WindowGlass", hexc("#c8d6de"), 0, 0.03, alpha=0.18), bevel=0.002, origin="bottom")
    glass.parent = r
    lid = L.box("dryer_lid", (W - 0.046, D - 0.046, 0.004), (0, 0, Hh + 0.006), L.mat("DryerLidSmoke", hexc("#4b5058"), 0, 0.05, alpha=0.42), bevel=0.003, origin="bottom")
    lid.parent = r
    scr = L.box("DryerScreen", (0.05, 0.002, 0.034), (W / 2 - 0.052, -D / 2 - 0.0065, 0.165), L.mat("DryerScreen", hexc("#05070a"), 0, 0.2, emission=hexc("#10161e"), emission_strength=1.0), bevel=0.001)
    # planar 0..1 UVs over width (X) and height (Z) so the game's LCD canvas fills the face
    me = scr.data
    xs = [v.co.x for v in me.vertices]
    zs = [v.co.z for v in me.vertices]
    uvl = me.uv_layers.new(name="UVMap") if not me.uv_layers else me.uv_layers[0]
    for loop in me.loops:
        co = me.vertices[loop.vertex_index].co
        uvl.data[loop.index].uv = ((co.x - min(xs)) / (max(xs) - min(xs)), (co.z - min(zs)) / (max(zs) - min(zs)))
    scr.parent = r
    for i, sx in enumerate((-0.085, 0.0)):
        e = L.empty(f"DryerSlot_{i}", (sx, 0.0, 0.047 + 0.008 + 0.088 * 0.88), r)
        e.rotation_euler = (0, 0, math.radians(90))
    return r


PROPS = [workbench, shelf_boltless, desk, office_chair, packing_table, outbox_shelf, pegboard, trash_bin,
         fire_extinguisher, wall_clock, radio, poster, calendar, shop_vac, tool_chest, wall_shelf, floor_mat, rug,
         broom, step_ladder, box_stack, mini_fridge, poster_benchy, bench_clutter, print_table, xl_cart,
         filament_dryer]

AO = dict(children=True, size=1024, samples=32)


def build():
    root = L.empty("props", size=0.2)
    x = 0.0
    for fn in PROPS:
        p = fn()
        L.sync()
        p.location = (x, 0, 0)
        p.parent = root
        x += 5.0  # far apart: baked AO must not see neighbouring props
    return root
