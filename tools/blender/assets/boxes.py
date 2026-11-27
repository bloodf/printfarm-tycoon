"""Shipping boxes (S/M/L) with packing-stage parts, flat-pack stack, supplier delivery box.

Each box root has children the game toggles while packing:
  BoxOpen (hollow, flaps open) · Fill (kraft paper) · BoxClosed · Tape · Label
"""
import math

import lib as L
from parts import hexc

EXPORT_NAME = "boxes"
PREVIEW = dict(angle=25, elev=30, dist_mul=0.8)

SIZES = {"s": (0.15, 0.15, 0.10), "m": (0.25, 0.20, 0.15), "l": (0.40, 0.30, 0.25)}


def card():
    return L.mat("Cardboard", (1, 1, 1), 0, 0.85, tex="cardboard", tex_scale=0.35)


def tape_m():
    return L.mat("PackTape", hexc("#b8874a"), 0, 0.18, tex="micro", tex_scale=0.05, alpha=1.0, coat=0.5)


def kraft():
    return L.mat("KraftPaper", (1, 1, 1), 0, 0.9, tex="kraft", tex_scale=0.2, rough_tex=False)


def box_rig(key):
    w, d, h = SIZES[key]
    root = L.empty(f"box_{key}", size=0.05)
    root["size"] = [w, d, h]
    t = 0.004
    # closed box
    closed = [L.box("body", (w, d, h), (0, 0, 0), card(), bevel=0.004, origin="bottom")]
    seam = L.box("seam", (0.002, d - 0.004, 0.0008), (0, 0, h), L.mat("SeamDark", hexc("#3a2a18"), 0, 0.9), bevel=0)
    closed.append(seam)
    L.uv_all(closed, 0.35)
    L.join(closed, "BoxClosed", L.empty("BoxClosedNode", (0, 0, 0), root))
    # tape: across top seam and 6 cm down each end
    tp = [L.box("tape_top", (0.05, d + 0.002, 0.0006), (0, 0, h + 0.0004), tape_m(), bevel=0)]
    for sy in (-1, 1):
        tp.append(L.box("tape_end", (0.05, 0.0006, 0.06), (0, sy * (d / 2 + 0.0004), h - 0.03), tape_m(), bevel=0))
    L.uv_all(tp, 0.1)
    L.join(tp, "Tape", root)
    # label on top
    lw = min(w * 0.6, 0.1)
    lab = L.decal("Label", lw, lw * 1.5 if lw * 1.5 < d * 0.8 else d * 0.75, (w * 0.18 if w > 0.2 else 0.0, 0, h + 0.0012),
                  (0, 0, math.radians(90)), "decal_label.png", rough=0.7)
    if w <= 0.2:
        lab.location = (0, 0, h + 0.0012)
        lab.scale = (0.55, 0.55, 1)
    lab.parent = root
    # open box: 5 walls + 4 flaps folded out
    op = [L.box("floor", (w, d, t), (0, 0, 0), card(), bevel=0.001, origin="bottom")]
    for sx in (-1, 1):
        op.append(L.box("wall_x", (t, d, h), (sx * (w / 2 - t / 2), 0, 0), card(), bevel=0.001, origin="bottom"))
        op.append(L.box("wall_y", (w, t, h), (0, sx * (d / 2 - t / 2), 0), card(), bevel=0.001, origin="bottom"))
        fx = L.box("flap_x", (t, d, w * 0.48), (0, 0, 0), card(), bevel=0.001, origin="bottom")
        fx.rotation_euler = (0, sx * math.radians(115), 0)
        fx.location = (sx * w / 2, 0, h)
        op.append(fx)
        fy = L.box("flap_y", (w, t, d * 0.48), (0, 0, 0), card(), bevel=0.001, origin="bottom")
        fy.rotation_euler = (-sx * math.radians(110), 0, 0)
        fy.location = (0, sx * d / 2, h)
        op.append(fy)
    L.uv_all(op, 0.35)
    L.join(op, "BoxOpen", root)
    # crumpled kraft fill: lumpy blobs inside the open box
    import random
    r = random.Random(5)
    fill = []
    for i in range(int(8 + w * 60)):
        bx = L.box("crumple", (r.uniform(0.03, 0.06) * (w / 0.25 + 0.3),) * 2 + (r.uniform(0.02, 0.04),),
                   (r.uniform(-w / 2 + 0.03, w / 2 - 0.03), r.uniform(-d / 2 + 0.03, d / 2 - 0.03), h * r.uniform(0.45, 0.8)),
                   kraft(), bevel=0.012, segments=2)
        bx.rotation_euler = (r.uniform(-0.6, 0.6), r.uniform(-0.6, 0.6), r.uniform(0, 3))
        fill.append(bx)
    L.uv_all(fill, 0.2)
    L.join(fill, "Fill", root)
    L.empty("ItemSlot", (0, 0, t), root)  # where the print sits while packing
    return root


def flat_stack():
    root = L.empty("box_flat_stack", size=0.05)
    parts = []
    for i in range(8):
        s = L.box("flat", (0.5, 0.36, 0.006), (0.003 * (i % 3), 0.002 * (i % 2), i * 0.0065), card(), bevel=0.001, origin="bottom")
        s.rotation_euler = (0, 0, math.radians((i % 3 - 1) * 0.8))
        parts.append(s)
    strap = [L.box("strap", (0.012, 0.365, 0.0545), (sx * 0.15, 0, 0), L.mat("Strap", hexc("#e8e8e8"), 0, 0.4), bevel=0.001, origin="bottom") for sx in (-1, 1)]
    L.uv_all(parts + strap, 0.35)
    L.join(parts + strap, "stack", root)
    return root


def delivery_box(name="delivery_box", size=(0.5, 0.4, 0.35)):
    root = L.empty(name, size=0.05)
    w, d, h = size
    parts = [L.box("body", (w, d, h), (0, 0, 0), card(), bevel=0.005, origin="bottom")]
    parts.append(L.box("tape", (0.05, d + 0.002, 0.0006), (0, 0, h + 0.0004), tape_m(), bevel=0))
    L.uv_all(parts, 0.35)
    L.join(parts, "body", root)
    # supplier logo on the long sides (faces ±Y, text upright)
    for sy in (-1, 1):
        dc = L.decal("logo", min(w, h) * 0.85, min(w, h) * 0.85, (0, sy * (d / 2 + 0.0008), h / 2),
                     (math.radians(90), 0, 0 if sy < 0 else math.radians(180)), "decal_supplier.png")
        dc.parent = root
    lab = L.decal("Label", 0.1, 0.15, (0.12, 0.0, h + 0.0012), (0, 0, math.radians(90)), "decal_label.png")
    lab.parent = root
    return root


def build():
    root = L.empty("boxes", size=0.1)
    x = 0.0
    for k in ("s", "m", "l"):
        b = box_rig(k)
        b.location = (x, 0, 0)
        b.parent = root
        x += SIZES[k][0] / 2 + 0.35
    fs = flat_stack(); fs.location = (0, 0.6, 0); fs.parent = root
    db = delivery_box(); db.location = (0.7, 0.6, 0); db.parent = root
    pb = delivery_box("printer_box", (0.62, 0.62, 0.62)); pb.location = (1.4, 0.6, 0); pb.parent = root
    return root
