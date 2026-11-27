"""Garage environment shell (Stage 1). Interior: x -3..3, y -3.25..3.25 (front = -Y, garage door), z 0..2.7.

Game-facing nodes: HouseDoor (pivot at hinge), LightBatten_0/1 (emissive), LightPoint_0/1 (empties),
WindowLight (empty, where daylight enters).
"""
import math

from mathutils import Vector

import lib as L
from parts import M, hexc

PREVIEW = dict(angle=200, elev=35, dist_mul=0.55)
# built + lightmapped by tools/blender/bake_lightmaps.py (its second UV must match the baked lightmaps)
LIGHTMAPPED = True

X0, X1, Y0, Y1, H = -3.0, 3.0, -3.25, 3.25, 2.7
T = 0.2
GD_W, GD_H = 4.8, 2.2              # garage door opening
WIN_Y0, WIN_Y1, WIN_Z0, WIN_Z1 = 0.0, 1.2, 1.0, 2.05
HD_Y0, HD_Y1, HD_H = 1.85, 2.75, 2.05   # house door on the left wall


def cut(ob, cutter):
    bo = ob.modifiers.new("cut", "BOOLEAN")
    bo.object = cutter
    bo.operation = "DIFFERENCE"
    L.apply_modifiers(ob)
    L.bpy.data.objects.remove(cutter)


def build():
    root = L.empty("garage", size=0.3)
    wall = L.mat("BlockWall", hexc("#b8b3aa"), 0, 0.85, tex="blockwall", tex_scale=1.2)
    floor = L.mat("ConcreteFloor", (1, 1, 1), 0, 0.6, tex="concrete", tex_scale=2.0)
    ceil = L.mat("Drywall", hexc("#f1f1ee"), 0, 0.9, tex="drywall", tex_scale=1.5)
    white = L.mat("PaintedSteelWhite", hexc("#eceeef"), 0.3, 0.45, tex="micro", tex_scale=0.1)
    trim = L.mat("TrimWhite", hexc("#f3f3f1"), 0, 0.5)
    galv = L.mat("Galvanised", hexc("#a9adb1"), 1, 0.45, tex="brushed", tex_scale=0.3, albedo=False)
    dark = M.black_plastic()

    # ------------------------------------------------------------------ floor / ceiling / walls
    fl = L.box("floor", (X1 - X0 + 2 * T, Y1 - Y0 + 2 * T, 0.1), (0, 0, -0.1), floor, bevel=0, origin="bottom")
    L.cull_faces(fl, lambda n, c: n.z > 0.5)
    L.uv_all([fl], 2.0)
    L.join([fl], "Floor", root)
    ce = L.box("ceiling", (X1 - X0 + 2 * T, Y1 - Y0 + 2 * T, 0.1), (0, 0, H), ceil, bevel=0, origin="bottom")
    L.cull_faces(ce, lambda n, c: n.z < -0.5)
    L.uv_all([ce], 1.5)
    walls = []
    back = L.box("wall_back", (X1 - X0 + 2 * T, T, H), (0, Y1 + T / 2, 0), wall, bevel=0, origin="bottom")
    front = L.box("wall_front", (X1 - X0 + 2 * T, T, H), (0, Y0 - T / 2, 0), wall, bevel=0, origin="bottom")
    cut(front, L.box("c", (GD_W, 1, GD_H), (0, Y0, -0.01), None, bevel=0, origin="bottom"))
    left = L.box("wall_left", (T, Y1 - Y0, H), (X0 - T / 2, 0, 0), wall, bevel=0, origin="bottom")
    cut(left, L.box("c", (1, HD_Y1 - HD_Y0, HD_H), (X0, (HD_Y0 + HD_Y1) / 2, -0.01), None, bevel=0, origin="bottom"))
    right = L.box("wall_right", (T, Y1 - Y0, H), (X1 + T / 2, 0, 0), wall, bevel=0, origin="bottom")
    cut(right, L.box("c", (1, WIN_Y1 - WIN_Y0, WIN_Z1 - WIN_Z0), (X1, (WIN_Y0 + WIN_Y1) / 2, WIN_Z0), None, bevel=0, origin="bottom"))
    walls += [back, front, left, right]
    # keep only faces that can be seen from inside the room (outer/top/bottom faces waste lightmap space)
    def visible(n, c):
        on_outer = max(abs(c.x) - (X1 + T), abs(c.y) - (Y1 + T)) > -0.003
        if abs(n.z) < 0.5:
            return not on_outer
        return n.z < -0.5 and c.z < H - 0.05  # undersides of lintels above openings
    for w_ in walls:
        L.cull_faces(w_, visible)
    L.uv_all(walls, 1.2)
    L.join(walls, "Walls", root)
    L.join([ce], "Ceiling", root)

    # ------------------------------------------------------------------ sectional garage door (inside face)
    gd = []
    sec_h = GD_H / 4
    gy = Y0 + 0.03
    for i in range(4):
        z = i * sec_h
        gd.append(L.box("gd_panel", (GD_W + 0.1, 0.04, sec_h - 0.006), (0, gy, z + 0.003), white, bevel=0.006, origin="bottom"))
        # vertical stiles and horizontal struts on the inside face
        for k in range(9):
            x = -GD_W / 2 + k * GD_W / 8
            gd.append(L.box("gd_stile", (0.05, 0.012, sec_h - 0.03), (x, gy + 0.026, z + 0.015), white, bevel=0.003, origin="bottom"))
        gd.append(L.box("gd_strut", (GD_W - 0.1, 0.03, 0.06), (0, gy + 0.04, z + sec_h * 0.5), galv, bevel=0.004))
        # hinges + rollers
        for k in range(5):
            x = -GD_W / 2 + 0.05 + k * (GD_W - 0.1) / 4
            gd.append(L.box("gd_hinge", (0.07, 0.01, 0.09), (x, gy + 0.035, z), galv, bevel=0.002))
        for sx in (-1, 1):
            gd.append(L.cyl("gd_roller", 0.025, 0.02, (sx * (GD_W / 2 + 0.06), gy + 0.04, z + 0.05), dark, verts=20,
                            rot=(0, math.radians(90), 0), bevel=0.003))
    # windows in top section
    glow = L.mat("WindowGlow", hexc("#dfe9f2"), 0, 0.2, emission=hexc("#e6f0ff"), emission_strength=2.5)
    for k in range(4):
        x = -1.65 + k * 1.1
        gd.append(L.box("gd_win", (0.55, 0.05, 0.24), (x, gy + 0.002, 3 * sec_h + 0.16), glow, bevel=0.01, origin="bottom"))
        gd.append(L.box("gd_winframe", (0.6, 0.03, 0.29), (x, gy + 0.02, 3 * sec_h + 0.135), dark, bevel=0.006, origin="bottom"))
    gd.append(L.box("gd_handle", (0.12, 0.03, 0.04), (0.3, gy + 0.04, 0.95), dark, bevel=0.008))
    gd.append(L.box("gd_seal", (GD_W + 0.1, 0.06, 0.015), (0, gy, 0.0), L.mat("Rubber", hexc("#161616"), 0, 0.85), bevel=0.004, origin="bottom"))
    # tracks, torsion spring, opener + rail
    for sx in (-1, 1):
        tx = sx * (GD_W / 2 + 0.08)
        gd.append(L.box("track_v", (0.04, 0.08, GD_H + 0.15), (tx, gy + 0.05, 0), galv, bevel=0.003, origin="bottom"))
        gd.append(L.box("track_h", (0.04, 2.6, 0.08), (tx, gy + 1.35, GD_H + 0.15), galv, bevel=0.003))
        gd.append(L.box("track_hang", (0.03, 0.03, H - GD_H - 0.2), (tx, gy + 2.5, GD_H + 0.18), galv, bevel=0.003, origin="bottom"))
        gd.append(L.cyl("drum", 0.06, 0.05, (sx * (GD_W / 2 + 0.03), gy + 0.08, GD_H + 0.3), galv, verts=24, rot=(0, math.radians(90), 0)))
    gd.append(L.cyl("torsion_bar", 0.016, GD_W + 0.1, (0, gy + 0.08, GD_H + 0.3), galv, verts=16, rot=(0, math.radians(90), 0)))
    for sx in (-1, 1):
        spring = L.cyl("spring", 0.03, 0.9, (sx * 0.7, gy + 0.08, GD_H + 0.3), L.mat("SpringBlack", hexc("#222222"), 0.6, 0.5, tex="carbon", tex_scale=0.03, albedo=False), verts=20, rot=(0, math.radians(90), 0))
        gd.append(spring)
    gd.append(L.box("gd_header", (GD_W + 0.4, 0.05, 0.2), (0, Y0 + 0.03, GD_H), trim, bevel=0.004, origin="bottom"))
    gd.append(L.box("opener_rail", (0.04, 2.9, 0.04), (0, Y0 + 1.5, GD_H + 0.22), galv, bevel=0.002))
    gd.append(L.box("opener", (0.34, 0.45, 0.18), (0, Y0 + 3.05, GD_H + 0.16), L.mat("OpenerGrey", hexc("#d6d7d5"), 0, 0.5), bevel=0.02, origin="bottom"))
    gd.append(L.box("opener_lens", (0.2, 0.005, 0.06), (0, Y0 + 2.82, GD_H + 0.2), L.mat("OpenerLens", hexc("#f6f3e8"), 0, 0.2, emission=hexc("#fff4dc"), emission_strength=0.4), bevel=0.004))
    for sx in (-1, 1):
        gd.append(L.box("opener_strap", (0.03, 0.03, H - GD_H - 0.34), (sx * 0.12, Y0 + 3.05, GD_H + 0.34), galv, bevel=0.002, origin="bottom"))
    gd.append(L.tube_path("release_cord", [(0, Y0 + 0.25, GD_H + 0.2), (0, Y0 + 0.26, 1.9)], 0.004, L.mat("CordRed", hexc("#b3241c"), 0, 0.6)))
    gd.append(L.cyl("release_knob", 0.025, 0.06, (0, Y0 + 0.26, 1.87), L.mat("CordRed", hexc("#b3241c"), 0, 0.6), verts=16, r2=0.02))
    L.uv_all(gd, 0.5)
    L.join(gd, "GarageDoor", root)

    # ------------------------------------------------------------------ window (right wall) + outside view
    win = []
    wx = X1
    yc, zc = (WIN_Y0 + WIN_Y1) / 2, (WIN_Z0 + WIN_Z1) / 2
    ww, wh = WIN_Y1 - WIN_Y0, WIN_Z1 - WIN_Z0
    win.append(L.box("win_frame_t", (0.12, ww, 0.05), (wx + 0.02, yc, WIN_Z1 - 0.025), trim, bevel=0.005))
    win.append(L.box("win_frame_b", (0.12, ww, 0.05), (wx + 0.02, yc, WIN_Z0 + 0.025), trim, bevel=0.005))
    for sy in (-1, 1):
        win.append(L.box("win_frame_s", (0.12, 0.05, wh), (wx + 0.02, yc + sy * (ww / 2 - 0.025), zc), trim, bevel=0.005))
    win.append(L.box("win_mullion", (0.08, 0.04, wh), (wx + 0.03, yc, zc), trim, bevel=0.004))
    win.append(L.box("win_sill", (0.2, ww + 0.1, 0.03), (wx - 0.04, yc, WIN_Z0 - 0.015), trim, bevel=0.006))
    L.uv_all(win, 0.5)
    L.join(win, "Window", root)
    glass = L.box("win_glass", (0.006, ww - 0.08, wh - 0.08), (wx + 0.05, yc, zc), L.mat("WindowGlass", hexc("#c8d6de"), 0, 0.03, alpha=0.18), bevel=0)
    glass.parent = root
    outside = L.decal("OutsideView", 5.0, 3.1, (wx + 1.6, yc, zc - 0.1), (math.radians(90), 0, math.radians(-90)),
                      "decal_outside.png", rough=1.0, emission=1.6)
    outside.parent = root
    L.empty("WindowLight", (wx + 0.1, yc, zc), root)

    # ------------------------------------------------------------------ house door (left wall)
    hd_m = L.mat("DoorPaint", hexc("#dcd8cf"), 0, 0.45, tex="micro", tex_scale=0.2)
    frame = []
    hy = (HD_Y0 + HD_Y1) / 2
    for sy in (-1, 1):
        frame.append(L.box("casing", (0.03, 0.08, HD_H + 0.05), (X0 + 0.015, hy + sy * ((HD_Y1 - HD_Y0) / 2 + 0.02), 0), trim, bevel=0.004, origin="bottom"))
    frame.append(L.box("casing_top", (0.03, HD_Y1 - HD_Y0 + 0.2, 0.08), (X0 + 0.015, hy, HD_H + 0.01), trim, bevel=0.004, origin="bottom"))
    frame.append(L.box("jamb", (T + 0.02, HD_Y1 - HD_Y0, 0.02), (X0 - T / 2, hy, HD_H), trim, bevel=0.002))
    frame.append(L.box("step", (0.42, 1.05, 0.18), (X0 + 0.21, hy, 0), L.mat("StepConcrete", (0.9, 0.9, 0.88), 0, 0.7, tex="concrete", tex_scale=1.0), bevel=0.01, origin="bottom"))
    frame.append(L.box("house_dark", (0.02, HD_Y1 - HD_Y0, HD_H), (X0 - T, hy, 0), L.mat("HouseDark", hexc("#2b2520"), 0, 0.9), bevel=0, origin="bottom"))
    L.uv_all(frame, 0.6)
    L.join(frame, "HouseDoorFrame", root)
    door = L.empty("HouseDoor", (X0 + 0.02, HD_Y0 + 0.01, 0.18), root)
    dp = [L.box("door_slab", (0.045, HD_Y1 - HD_Y0 - 0.02, HD_H - 0.19), (X0 + 0.02, hy, 0.185), hd_m, bevel=0.004, origin="bottom")]
    for zz in (0.55, 1.35):  # raised panels
        dp.append(L.box("door_panel", (0.006, 0.62, 0.6), (X0 + 0.045, hy, 0.185 + zz - 0.3), hd_m, bevel=0.01, origin="bottom"))
    brass = L.mat("DoorBrass", hexc("#a8915e"), 1, 0.3)
    dp.append(L.cyl("door_rose", 0.028, 0.012, (X0 + 0.05, HD_Y1 - 0.08, 1.0), brass, verts=24, rot=(0, math.radians(90), 0)))
    dp.append(L.box("door_lever", (0.02, 0.12, 0.018), (X0 + 0.075, HD_Y1 - 0.13, 1.0), brass, bevel=0.006))
    dp.append(L.cyl("deadbolt", 0.026, 0.012, (X0 + 0.05, HD_Y1 - 0.08, 1.15), brass, verts=24, rot=(0, math.radians(90), 0)))
    L.uv_all(dp, 0.5)
    L.join(dp, "HouseDoorSlab", door)

    # ------------------------------------------------------------------ lights, electrical, outlets
    lp = L.mat("LightPanel", hexc("#ffffff"), 0, 0.3, emission=hexc("#f4f8ff"), emission_strength=8.0)
    for i, x in enumerate((-1.3, 1.3)):
        batt = [L.box("batten_body", (0.1, 1.22, 0.05), (x, 0.3, H - 0.05), L.mat("BattenBody", hexc("#e9e9e6"), 0.2, 0.4), bevel=0.008, origin="bottom")]
        L.uv_all(batt, 0.5)
        L.join(batt, f"BattenBody_{i}", root)
        diff = L.box(f"LightBatten_{i}", (0.08, 1.18, 0.012), (x, 0.3, H - 0.056), lp, bevel=0.004, origin="bottom")
        diff.parent = root
        L.empty(f"LightPoint_{i}", (x, 0.3, H - 0.07), root)
    el = []
    panel_m = L.mat("PanelGrey", hexc("#b9bbbc"), 0.6, 0.45, tex="micro", tex_scale=0.1)
    el.append(L.box("elec_panel", (0.1, 0.4, 0.6), (X0 + 0.05, -2.0, 1.2), panel_m, bevel=0.01, origin="bottom"))
    el.append(L.box("elec_door_line", (0.003, 0.36, 0.002), (X0 + 0.101, -2.0, 1.5), L.mat("VentDark", (0.004,) * 3, 0, 0.9), bevel=0))
    el.append(L.cyl("conduit", 0.012, H - 1.8, (X0 + 0.04, -2.1, 1.8), galv, verts=12, origin="bottom"))
    el.append(L.cyl("conduit2", 0.012, H - 1.8, (X0 + 0.04, -1.9, 1.8), galv, verts=12, origin="bottom"))
    outlet_m = L.mat("OutletWhite", hexc("#f2f1ec"), 0, 0.35)
    def outlet(loc, rot):
        o = [L.box("outlet", (0.07, 0.012, 0.115), (0, 0, 0), outlet_m, bevel=0.004)]
        for dz in (0.026, -0.026):
            o.append(L.box("slot", (0.004, 0.004, 0.012), (-0.007, -0.007, dz), L.mat("VentDark", (0.004,) * 3, 0, 0.9), bevel=0))
            o.append(L.box("slot", (0.004, 0.004, 0.012), (0.007, -0.007, dz), L.mat("VentDark", (0.004,) * 3, 0, 0.9), bevel=0))
        j = L.join(o, "outlet")
        j.location = loc
        j.rotation_euler = rot
        return j
    for x in (-1.0, 0.0, 1.0):
        el.append(outlet((x, Y1 - 0.018, 1.12), (0, 0, math.radians(180))))
    el.append(outlet((X1 - 0.006, 2.0, 0.9), (0, 0, math.radians(90))))
    el.append(outlet((X1 - 0.006, -1.6, 1.12), (0, 0, math.radians(90))))
    el.append(outlet((X0 + 0.006, 0.5, 0.4), (0, 0, math.radians(-90))))
    sw = outlet((X0 + 0.006, HD_Y0 - 0.2, 1.2), (0, 0, math.radians(-90)))
    el.append(sw)
    L.uv_all(el, 0.4)
    L.join(el, "Electrical", root)
    # OSB cladding behind the workbench (3 sheets 1.22 x 2.44, screwed to the block wall)
    osb = L.mat("OSB", (1, 1, 1), 0, 0.72, tex="osb", tex_scale=1.2)
    sheets = []
    for i, x in enumerate((-1.22, 0.0, 1.22)):
        sheets.append(L.box(f"osb{i}", (1.215, 0.012, 2.44), (x, Y1 - 0.006, 0), osb, bevel=0.0015, origin="bottom"))
    screws = []
    for x in (-1.22, 0.0, 1.22):
        for zx in (-0.55, 0.0, 0.55):
            for zz in (0.15, 0.8, 1.45, 2.1):
                screws.append(L.cyl("screw", 0.004, 0.001, (x + zx, Y1 - 0.0125, zz), M.dark_steel(), verts=8, rot=(math.radians(90), 0, 0), bevel=0))
    L.uv_all(sheets + screws, 1.2)
    L.join(sheets + screws, "OSBWall", root)
    # floor drain
    drain = L.cyl("drain", 0.09, 0.004, (0.4, -0.8, 0.0), galv, verts=32)
    drain.parent = root
    return root
