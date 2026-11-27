"""Printable products (real print sizes). One GLB, one named root per product, each with origin at the
bottom centre (as it sits on the build plate). Material "Filament" is recoloured at runtime and gets the
layer-line / progressive-reveal shader in the game.
"""
import math

import bmesh
import bpy
from mathutils import Vector

import lib as L
from parts import hexc

EXPORT_NAME = "products"
PREVIEW = dict(angle=20, elev=35, dist_mul=0.75, res=(1100, 600))


def fil():
    return L.mat("Filament", hexc("#d8d8d8"), 0, 0.42)


def _root(name, x):
    r = L.empty(name, (0, 0, 0), size=0.02)
    r["_x"] = x
    return r


def _finish(root, objs, height):
    L.uv_all(objs, 0.05)
    L.join(objs, root.name + "_mesh", root)
    root["height"] = height
    root.location.x = root["_x"]  # preview layout only; the game resets product roots to the origin
    del root["_x"]
    return root


# ----------------------------------------------------------------------------- 3D Benchy-like boat (60 x 31 x 48 mm)
def benchy(x):
    r = _root("benchy", x)
    m = fil()
    objs = []
    # hull: loft of U-sections along X (stern at -X, bow at +X)
    bm = bmesh.new()
    secs = 14
    ring = 12
    rows = []
    for i in range(secs + 1):
        t = i / secs
        xx = -0.028 + 0.058 * t
        half_w = 0.0155 * math.sin(math.pi * (0.18 + 0.82 * t) * 0.98) ** 0.6 if t > 0.02 else 0.014
        if t > 0.8:
            half_w *= (1 - (t - 0.8) / 0.2) ** 0.8 + 0.02
        keel = 0.0 + 0.004 * t * t
        deck = 0.020 + 0.006 * max(0, t - 0.6)
        row = []
        for j in range(ring + 1):
            a = math.pi * j / ring
            y = -math.cos(a) * half_w
            z = keel + (deck - keel) * (1 - math.sin(a) ** 1.6 * 0.95) if False else keel + (deck - keel) * (1 - math.sin(a)) ** 0.5 * 0 + (deck - keel) * (1 - math.sin(a) * 0.9)
            # U section: bottom at keel, sides up to deck
            z = keel + (deck - keel) * (abs(math.cos(a)) ** 0.7)
            row.append(bm.verts.new((xx, y, z)))
        rows.append(row)
    for i in range(secs):
        for j in range(ring):
            bm.faces.new((rows[i][j], rows[i + 1][j], rows[i + 1][j + 1], rows[i][j + 1]))
    # deck cap & stern cap
    bm.faces.new([rows[i][0] for i in range(secs + 1)] + [rows[i][ring] for i in range(secs, -1, -1)])
    bm.faces.new(list(reversed(rows[0])))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new("hull")
    bm.to_mesh(me)
    bm.free()
    hull = bpy.data.objects.new("hull", me)
    me.materials.append(m)
    L.link(hull)
    L.shade(hull, 50)
    objs.append(hull)
    # cabin with windows (boolean), roof, chimney
    cab = L.box("cabin", (0.026, 0.024, 0.02), (-0.008, 0, 0.02), m, bevel=0.001, origin="bottom")
    cuts = [L.box("w1", (0.01, 0.04, 0.009), (-0.012, 0, 0.031), None, bevel=0),
            L.box("w2", (0.04, 0.012, 0.009), (-0.006, 0, 0.031), None, bevel=0)]
    for c in cuts:
        bo = cab.modifiers.new("c", "BOOLEAN"); bo.object = c; bo.operation = "DIFFERENCE"
        L.apply_modifiers(cab)
        bpy.data.objects.remove(c)
    objs.append(cab)
    roof = L.box("roof", (0.03, 0.027, 0.003), (-0.008, 0, 0.0415), m, bevel=0.0008)
    roof.rotation_euler = (0, math.radians(-6), 0)
    objs.append(roof)
    objs.append(L.cyl("chimney", 0.0045, 0.012, (-0.015, 0, 0.046), m, verts=20, bevel=0.0005))
    objs.append(L.box("bridge_win", (0.004, 0.016, 0.008), (0.006, 0, 0.034), m, bevel=0.0008))
    return _finish(r, objs, 0.048)


# ----------------------------------------------------------------------------- cable clips x10
def clips(x):
    r = _root("clips", x)
    m = fil()
    objs = []
    pts = []
    R0, R1 = 0.0045, 0.0065
    for k in range(17):
        a = math.radians(-50 + 280 * k / 16)
        pts.append((math.cos(a) * R1, math.sin(a) * R1))
    for k in range(17):
        a = math.radians(230 - 280 * k / 16)
        pts.append((math.cos(a) * R0, math.sin(a) * R0))
    for i in range(10):
        c = L.prism("clip", pts + [], 0.006, (-0.03 + (i % 5) * 0.015, -0.009 + (i // 5) * 0.018, 0), m, bevel=0.0004)
        objs.append(c)
        objs.append(L.box("clip_tab", (0.004, 0.006, 0.006), (-0.03 + (i % 5) * 0.015, -0.009 + (i // 5) * 0.018 - 0.0085, 0.003), m, bevel=0.0004))
    return _finish(r, objs, 0.006)


# ----------------------------------------------------------------------------- phone stand (side profile extruded)
def phone_stand(x):
    r = _root("phone_stand", x)
    m = fil()
    prof = [(-0.04, 0), (0.045, 0), (0.045, 0.006), (0.0, 0.006), (0.03, 0.085), (0.024, 0.088), (-0.012, 0.012),
            (-0.03, 0.012), (-0.03, 0.026), (-0.036, 0.026), (-0.04, 0.014)]
    ob = L.prism("stand", prof, 0.07, (0, 0.035, 0), m, bevel=0.0012, axis="y")
    return _finish(r, [ob], 0.088)


# ----------------------------------------------------------------------------- fidget gear
def gear(x):
    r = _root("gear", x)
    m = fil()
    pts = []
    teeth = 18
    Ro, Ri = 0.03, 0.0265
    for k in range(teeth):
        a0 = 2 * math.pi * k / teeth
        for da, rr in ((0.0, Ri), (0.25, Ri), (0.38, Ro), (0.62, Ro), (0.75, Ri)):
            a = a0 + da * 2 * math.pi / teeth
            pts.append((math.cos(a) * rr, math.sin(a) * rr))
    g = L.prism("gear", pts, 0.008, (0, 0, 0), m, bevel=0.0006)
    cuts = [L.cyl("hole", 0.008, 0.05, (0, 0, 0), None, verts=32, bevel=0)]
    for k in range(5):
        a = 2 * math.pi * k / 5
        cuts.append(L.cyl("win", 0.0055, 0.05, (math.cos(a) * 0.017, math.sin(a) * 0.017, 0), None, verts=24, bevel=0))
    for c in cuts:
        bo = g.modifiers.new("c", "BOOLEAN"); bo.object = c; bo.operation = "DIFFERENCE"
        L.apply_modifiers(g)
        bpy.data.objects.remove(c)
    hub = L.cyl("hub", 0.012, 0.012, (0, 0, 0), m, verts=32, bevel=0.0008, origin="bottom")
    hole = L.cyl("hole2", 0.0075, 0.05, (0, 0, 0), None, verts=32, bevel=0)
    bo = hub.modifiers.new("c", "BOOLEAN"); bo.object = hole; bo.operation = "DIFFERENCE"
    L.apply_modifiers(hub)
    bpy.data.objects.remove(hole)
    return _finish(r, [g, hub], 0.012)


# ----------------------------------------------------------------------------- spiral vase (vase mode look)
def vase(x):
    r = _root("vase", x)
    m = fil()
    bm = bmesh.new()
    rings, seg = 60, 72
    H = 0.18
    rows = []
    for i in range(rings + 1):
        t = i / rings
        z = H * t
        base_r = 0.035 + 0.018 * math.sin(math.pi * (t * 0.9 + 0.05)) - 0.008 * t
        row = []
        for j in range(seg):
            a = 2 * math.pi * j / seg
            rr = base_r * (1 + 0.06 * math.cos(8 * a + t * 5.0))
            row.append(bm.verts.new((rr * math.cos(a), rr * math.sin(a), z)))
        rows.append(row)
    for i in range(rings):
        for j in range(seg):
            bm.faces.new((rows[i][j], rows[i][(j + 1) % seg], rows[i + 1][(j + 1) % seg], rows[i + 1][j]))
    bm.faces.new(list(reversed(rows[0])))
    # inner wall (thin, 0.9 mm) so the open top looks right
    inner = []
    for i in range(rings + 1):
        row = []
        for j in range(seg):
            v = rows[i][j].co
            d = Vector((v.x, v.y, 0)).normalized() * 0.0009
            row.append(bm.verts.new((v.x - d.x, v.y - d.y, max(v.z, 0.0012))))
        inner.append(row)
    for i in range(rings):
        for j in range(seg):
            bm.faces.new((inner[i][j], inner[i + 1][j], inner[i + 1][(j + 1) % seg], inner[i][(j + 1) % seg]))
    for j in range(seg):  # rim
        bm.faces.new((rows[rings][j], rows[rings][(j + 1) % seg], inner[rings][(j + 1) % seg], inner[rings][j]))
    bm.faces.new(inner[0])
    me = bpy.data.meshes.new("vase")
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new("vase", me)
    me.materials.append(m)
    L.link(ob)
    L.shade(ob, 60)
    return _finish(r, [ob], H)


# ----------------------------------------------------------------------------- articulated dragon
def dragon(x):
    r = _root("dragon", x)
    m = fil()
    objs = []
    n = 14
    for i in range(n):
        t = i / (n - 1)
        px = -0.06 + 0.12 * t
        py = 0.018 * math.sin(t * math.pi * 1.6)
        w = 0.022 * (1 - t * 0.65)
        h = 0.014 * (1 - t * 0.5) + 0.004
        seg = L.prism("seg", [(-0.005, -w / 2), (0.004, -w / 2), (0.007, 0), (0.004, w / 2), (-0.005, w / 2), (-0.007, 0)],
                      h, (px, py, 0), m, bevel=0.0009)
        seg.rotation_euler = (0, 0, math.atan2(0.018 * 1.6 * math.pi * math.cos(t * math.pi * 1.6), 0.12))
        objs.append(seg)
        # dorsal spike
        sp = L.prism("spike", [(-0.003, 0), (0.003, 0), (0.0, 0.006 * (1 - t * 0.5))], 0.0025, (px, py + 0.00125, h), m,
                     bevel=0.0003, axis="y")
        objs.append(sp)
    # head (at -X end)
    head = L.prism("head", [(-0.028, 0), (-0.006, -0.012), (0.004, -0.011), (0.004, 0.011), (-0.006, 0.012)], 0.016,
                   (-0.065, 0.0, 0), m, bevel=0.0015)
    objs.append(head)
    for sy in (-1, 1):
        horn = L.cyl("horn", 0.0025, 0.014, (-0.061, sy * 0.007, 0.019), m, verts=12, r2=0.0005)
        horn.rotation_euler = (sy * math.radians(-25), math.radians(35), 0)
        objs.append(horn)
        objs.append(L.cyl("eye", 0.0022, 0.002, (-0.075, sy * 0.0075, 0.0145), m, verts=12))
        # legs
        for lx in (-0.045, 0.0):
            objs.append(L.box("leg", (0.006, 0.012, 0.006), (lx, sy * 0.016, 0.003), m, bevel=0.001))
    return _finish(r, objs, 0.024)


# ----------------------------------------------------------------------------- Suzanne bust
def suzanne(x):
    r = _root("suzanne", x)
    m = fil()
    bpy.ops.mesh.primitive_monkey_add(size=0.07, location=(0, 0, 0.062))
    mk = bpy.context.object
    mk.rotation_euler = (math.radians(-10), 0, 0)
    sub = mk.modifiers.new("s", "SUBSURF")
    sub.levels = 1
    L.apply_modifiers(mk)
    mk.data.materials.clear()
    mk.data.materials.append(m)
    L.shade(mk, 80)
    ped = L.cyl("pedestal", 0.032, 0.022, (0, 0, 0), m, verts=48, bevel=0.002, origin="bottom", r2=0.028)
    neck = L.cyl("neck", 0.014, 0.02, (0, 0.004, 0.02), m, verts=24, bevel=0.001, origin="bottom")
    return _finish(r, [mk, ped, neck], 0.1)


# ----------------------------------------------------------------------------- hex planter
def planter(x):
    r = _root("planter", x)
    m = fil()
    hexo = [(math.cos(math.radians(60 * k + 30)) * 0.06, math.sin(math.radians(60 * k + 30)) * 0.06) for k in range(6)]
    body = L.prism("planter", hexo, 0.1, (0, 0, 0), m, bevel=0.002)
    inner = L.prism("pcut", [(px * 0.88, py * 0.88) for px, py in hexo], 0.2, (0, 0, 0.004), None, bevel=0)
    bo = body.modifiers.new("c", "BOOLEAN"); bo.object = inner; bo.operation = "DIFFERENCE"
    L.apply_modifiers(body)
    bpy.data.objects.remove(inner)
    objs = [body]
    # decorative horizontal ridges
    for k in range(4):
        ring = L.prism("ridge", [(px * 1.025, py * 1.025) for px, py in hexo], 0.003, (0, 0, 0.02 + k * 0.022), m, bevel=0.0008)
        cut = L.prism("rcut", [(px * 0.95, py * 0.95) for px, py in hexo], 0.02, (0, 0, 0.01 + k * 0.022), None, bevel=0)
        bo = ring.modifiers.new("c", "BOOLEAN"); bo.object = cut; bo.operation = "DIFFERENCE"
        L.apply_modifiers(ring)
        bpy.data.objects.remove(cut)
        objs.append(ring)
    return _finish(r, objs, 0.1)


# ----------------------------------------------------------------------------- cosplay helmet
def helmet(x):
    r = _root("helmet", x)
    m = fil()
    prof = []
    for k in range(25):
        a = math.radians(90 * k / 24)
        prof.append((0.105 * math.cos(a) + 0.0001, 0.06 + 0.13 * math.sin(a)))
    prof = [(0.0, 0.19 + 0.0001)] + list(reversed(prof)) + [(0.1, 0.0), (0.094, 0.0)]
    prof = [(0.094, 0.0), (0.1, 0.0)] + [(0.105 * math.cos(math.radians(90 * k / 24)), 0.06 + 0.13 * math.sin(math.radians(90 * k / 24))) for k in range(25)]
    prof[-1] = (0.0, prof[-1][1])
    shell = L.lathe("helmet", [(0.1, 0.0), (0.105, 0.03)] + prof[2:], material=m, verts=64, smooth_angle=60)
    shell.scale = (1.0, 1.12, 1.0)
    visor_cut = L.box("vcut", (0.09, 0.2, 0.05), (0, -0.1, 0.11), None, bevel=0)
    bo = shell.modifiers.new("c", "BOOLEAN"); bo.object = visor_cut; bo.operation = "DIFFERENCE"
    L.apply_modifiers(shell)
    bpy.data.objects.remove(visor_cut)
    sol = shell.modifiers.new("thick", "SOLIDIFY")
    sol.thickness = 0.003
    sol.offset = -1
    L.apply_modifiers(shell)
    objs = [shell]
    for sx in (-1, 1):
        objs.append(L.cyl("ear", 0.025, 0.012, (sx * 0.106, 0, 0.1), m, verts=32, bevel=0.002, rot=(0, math.radians(90), 0)))
    return _finish(r, objs, 0.205)


# ----------------------------------------------------------------------------- logo keychains x20 (2-colour: 2 mm tag + 2 mm raised logo)
def keychains(x):
    r = _root("keychains", x)
    m = fil()
    objs = []
    tag = L.rounded_rect(0.024, 0.014, 0.004, n=5)
    hexo = [(math.cos(math.radians(60 * k)) * 0.0042, math.sin(math.radians(60 * k)) * 0.0042) for k in range(6)]
    bolt = [(-0.0012, 0.0036), (0.0016, 0.0036), (0.0002, 0.0006), (0.0018, 0.0006), (-0.0014, -0.0042), (-0.0002, -0.0008),
            (-0.0018, -0.0008)]
    for i in range(20):
        cx = -0.05 + (i % 5) * 0.025
        cy = -0.027 + (i // 5) * 0.018
        t = L.prism("tag", tag, 0.002, (cx, cy, 0), m, bevel=0.0004)
        hole = L.cyl("hole", 0.0022, 0.02, (cx - 0.0085, cy, 0), None, verts=20, bevel=0)
        bo = t.modifiers.new("c", "BOOLEAN"); bo.object = hole; bo.operation = "DIFFERENCE"
        L.apply_modifiers(t)
        bpy.data.objects.remove(hole)
        objs.append(t)
        ring = L.prism("logo_ring", hexo, 0.002, (cx + 0.003, cy, 0.002), m, bevel=0.0003)
        cut = L.prism("lcut", [(px * 0.72, py * 0.72) for px, py in hexo], 0.01, (cx + 0.003, cy, 0.001), None, bevel=0)
        bo = ring.modifiers.new("c", "BOOLEAN"); bo.object = cut; bo.operation = "DIFFERENCE"
        L.apply_modifiers(ring)
        bpy.data.objects.remove(cut)
        objs.append(ring)
        objs.append(L.prism("logo_bolt", bolt, 0.002, (cx + 0.003, cy, 0.002), m, bevel=0.0002))
        objs.append(L.box("logo_bar", (0.0012, 0.008, 0.002), (cx + 0.0095, cy, 0.003), m, bevel=0.0003))
    return _finish(r, objs, 0.004)


# ----------------------------------------------------------------------------- cosplay chest armour (330 x 300 mm shell, printed standing)
def chestplate(x):
    r = _root("chestplate", x)
    m = fil()
    W, D, H = 0.33, 0.12, 0.30  # width (x), depth of the curve (y), height (z)
    nu, nv = 64, 48
    bm = bmesh.new()
    rows = []
    for j in range(nv + 1):
        v = -1 + 2 * j / nv
        row = []
        for i in range(nu + 1):
            u = -1 + 2 * i / nu
            bulge = D * (1 - u * u) ** 0.55
            pec = 0.02 * math.exp(-(((abs(u) - 0.42) / 0.26) ** 2 + ((v - 0.3) / 0.28) ** 2))
            abs_ = 0.005 * (math.cos(u * 10) * 0.5 + 0.5) * math.exp(-(((v + 0.3) / 0.25) ** 2)) * (abs(u) < 0.35)
            ridge = 0.007 * math.exp(-((u / 0.045) ** 2))
            waist = 1 - 0.12 * max(0.0, -v) ** 2  # taper in towards the waist
            y = -(bulge + pec + abs_ + ridge) + D * 0.5
            row.append(bm.verts.new((u * W / 2 * waist, y, (v + 1) / 2 * H)))
        rows.append(row)
    for j in range(nv):
        for i in range(nu):
            bm.faces.new((rows[j][i], rows[j][i + 1], rows[j + 1][i + 1], rows[j + 1][i]))
    me = bpy.data.meshes.new("chest")
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new("chest", me)
    me.materials.append(m)
    L.link(ob)
    sol = ob.modifiers.new("thick", "SOLIDIFY")
    sol.thickness = 0.0035
    sol.offset = 0
    L.apply_modifiers(ob)
    # neck scoop and arm scoops: smooth boolean cuts through the shell
    cuts = [L.cyl("neck", 0.075, 0.4, (0, 0, H + 0.025), None, verts=64, bevel=0, rot=(math.radians(90), 0, 0))]
    for sx in (-1, 1):
        cuts.append(L.cyl("arm", 0.085, 0.4, (sx * 0.205, 0, H - 0.005), None, verts=64, bevel=0, rot=(math.radians(90), 0, 0)))
    for c in cuts:
        bo = ob.modifiers.new("c", "BOOLEAN"); bo.object = c; bo.operation = "DIFFERENCE"
        L.apply_modifiers(ob)
        bpy.data.objects.remove(c)
    L.shade(ob, 50)
    objs = [ob]
    u = 0.095 / (W / 2)
    ty = D * 0.5 - D * (1 - u * u) ** 0.55 + 0.004  # on the inner face of the shell at the shoulder
    for sx in (-1, 1):  # shoulder strap tabs
        objs.append(L.box("strap_tab", (0.03, 0.006, 0.026), (sx * 0.095, ty, H - 0.004), m, bevel=0.002))
    return _finish(r, objs, H + 0.009)

def build():
    root = L.empty("products", size=0.05)
    xs = 0.0
    for fn, w in ((benchy, 0.07), (clips, 0.08), (phone_stand, 0.1), (gear, 0.07), (vase, 0.12), (dragon, 0.16),
                  (suzanne, 0.09), (planter, 0.13), (helmet, 0.24), (keychains, 0.13), (chestplate, 0.34)):
        xs += w / 2
        p = fn(xs)
        p.parent = root
        xs += w / 2 + 0.015
    return root
