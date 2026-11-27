"""Shared Blender (bpy 5.x) helpers for building PrintFarm Tycoon assets headlessly.

Conventions (see docs/specs/ART.md):
  * metres, Z-up in Blender (exported as Y-up glTF)
  * every hard edge gets a bevel (bevel= argument, in metres)
  * UVs are box-projected in world scale, so tiling textures have a constant texel density
  * rig nodes are Empties named exactly as in the rig contract
"""
from __future__ import annotations

import math
from pathlib import Path

import bpy  # must be imported before bmesh/mathutils when running as a module
import bmesh
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parents[2]
TEX = ROOT / "assets_src/textures"
MODELS = ROOT / "tools/blender/out"  # raw exports; tools/optimize_models.mjs writes public/assets/models
QA = ROOT / "docs/qa/assets"


# ----------------------------------------------------------------------------- scene
def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.unit_settings.system = "METRIC"
    sc.unit_settings.scale_length = 1.0
    return sc


def link(obj):
    bpy.context.scene.collection.objects.link(obj)
    return obj


def empty(name, loc=(0, 0, 0), parent=None, size=0.02):
    e = bpy.data.objects.new(name, None)
    e.empty_display_size = size
    e.location = loc
    link(e)
    if parent:
        set_parent(e, parent)
    return e


def sync():
    """Refresh matrix_world of every object (Blender computes it lazily)."""
    bpy.context.view_layer.update()


def set_parent(child, parent, keep_world=True):
    sync()
    mw = child.matrix_world.copy()
    child.parent = parent
    if keep_world:
        child.matrix_world = mw
    return child


# ----------------------------------------------------------------------------- materials
_mat_cache: dict[str, bpy.types.Material] = {}
_img_cache: dict[str, bpy.types.Image] = {}


def _img(name, non_color=False):
    key = f"{name}:{non_color}"
    if key not in _img_cache:
        img = bpy.data.images.load(str(TEX / f"{name}.jpg"), check_existing=True)
        if non_color:
            img.colorspace_settings.name = "Non-Color"
        _img_cache[key] = img
    return _img_cache[key]


def mat(name, color=(0.5, 0.5, 0.5), metal=0.0, rough=0.5, *, tex=None, tex_scale=1.0, albedo=True,
        rough_tex=True, normal_tex=True, normal_strength=1.0, emission=None, emission_strength=1.0,
        transmission=0.0, alpha=1.0, ior=1.5, coat=0.0, tint=True):
    """Create (or reuse) a Principled material.

    tex: texture set prefix in assets_src/textures (e.g. "concrete" → concrete_albedo/_rough/_normal).
         Special prefix "micro" only supplies rough+normal (a fine plastic/powder-coat grain).
    tex_scale: how many metres one texture tile covers.
    """
    if name in _mat_cache:
        return _mat_cache[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Metallic"].default_value = metal
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["IOR"].default_value = ior
    if coat:
        bsdf.inputs["Coat Weight"].default_value = coat
    if emission is not None:
        bsdf.inputs["Emission Color"].default_value = (*emission, 1)
        bsdf.inputs["Emission Strength"].default_value = emission_strength
    if transmission:
        bsdf.inputs["Transmission Weight"].default_value = transmission
    if alpha < 1:
        bsdf.inputs["Alpha"].default_value = alpha
        try:
            m.surface_render_method = "BLENDED"
        except Exception:
            pass
    if tex:
        uv = nt.nodes.new("ShaderNodeTexCoord")
        mp = nt.nodes.new("ShaderNodeMapping")
        s = 1.0 / tex_scale
        mp.inputs["Scale"].default_value = (s, s, s)
        nt.links.new(uv.outputs["UV"], mp.inputs["Vector"])

        def teximg(suffix, non_color):
            n = nt.nodes.new("ShaderNodeTexImage")
            n.image = _img(f"{tex}_{suffix}", non_color)
            nt.links.new(mp.outputs["Vector"], n.inputs["Vector"])
            return n

        has = lambda suffix: (TEX / f"{tex}_{suffix}.jpg").exists()
        albedo = albedo and has("albedo")
        rough_tex = rough_tex and has("rough")
        normal_tex = normal_tex and has("normal")
        neutral = not has("albedo")  # neutral detail sets (plastic/powder/rubber/micro) remap roughness
        if albedo:
            a = teximg("albedo", False)
            if tint and color != (1, 1, 1):
                mix = nt.nodes.new("ShaderNodeMix")
                mix.data_type = "RGBA"
                mix.blend_type = "MULTIPLY"
                mix.inputs["Factor"].default_value = 1.0
                nt.links.new(a.outputs["Color"], mix.inputs["A"])
                mix.inputs["B"].default_value = (*color, 1)
                nt.links.new(mix.outputs["Result"], bsdf.inputs["Base Color"])
            else:
                nt.links.new(a.outputs["Color"], bsdf.inputs["Base Color"])
        if rough_tex:
            r = teximg("rough", True)
            if neutral:  # remap the neutral grain around the requested roughness
                mr = nt.nodes.new("ShaderNodeMapRange")
                mr.inputs["To Min"].default_value = max(0.0, rough - 0.12)
                mr.inputs["To Max"].default_value = min(1.0, rough + 0.12)
                nt.links.new(r.outputs["Color"], mr.inputs["Value"])
                nt.links.new(mr.outputs["Result"], bsdf.inputs["Roughness"])
            else:
                nt.links.new(r.outputs["Color"], bsdf.inputs["Roughness"])
        if normal_tex:
            n = teximg("normal", True)
            nm = nt.nodes.new("ShaderNodeNormalMap")
            nm.inputs["Strength"].default_value = normal_strength
            nt.links.new(n.outputs["Color"], nm.inputs["Color"])
            nt.links.new(nm.outputs["Normal"], bsdf.inputs["Normal"])
    _mat_cache[name] = m
    return m


def image_mat(name, image_path, rough=0.5, metal=0.0, emission_strength=0.0, alpha_blend=False):
    """Material from a specific image (decals, labels, screens)."""
    if name in _mat_cache:
        return _mat_cache[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes.get("Principled BSDF")
    img = bpy.data.images.load(str(image_path), check_existing=True)
    t = nt.nodes.new("ShaderNodeTexImage")
    t.image = img
    nt.links.new(t.outputs["Color"], bsdf.inputs["Base Color"])
    if alpha_blend:
        nt.links.new(t.outputs["Alpha"], bsdf.inputs["Alpha"])
        try:
            m.surface_render_method = "BLENDED"
        except Exception:
            pass
    if emission_strength:
        nt.links.new(t.outputs["Color"], bsdf.inputs["Emission Color"])
        bsdf.inputs["Emission Strength"].default_value = emission_strength
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal
    _mat_cache[name] = m
    return m


def clear_caches():
    _mat_cache.clear()
    _img_cache.clear()


# ----------------------------------------------------------------------------- mesh creation
def _obj_from_bm(bm, name, material=None, loc=(0, 0, 0), rot=(0, 0, 0)):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    ob.location = loc
    ob.rotation_euler = rot
    if material:
        me.materials.append(material)
    link(ob)
    return ob


def _finish(ob, bevel=0.0, segments=2, smooth_angle=35, harden=True):
    if bevel > 0:
        md = ob.modifiers.new("bevel", "BEVEL")
        md.width = bevel
        md.segments = segments
        md.limit_method = "ANGLE"
        md.angle_limit = math.radians(30)
        md.harden_normals = False
        apply_modifiers(ob)
    shade(ob, smooth_angle)
    return ob


def shade(ob, angle=35):
    me = ob.data
    for p in me.polygons:
        p.use_smooth = True
    try:
        me.set_sharp_from_angle(angle=math.radians(angle))
    except Exception:
        pass


def apply_modifiers(ob):
    dg = bpy.context.evaluated_depsgraph_get()
    ev = ob.evaluated_get(dg)
    me = bpy.data.meshes.new_from_object(ev)
    old = ob.data
    ob.modifiers.clear()
    ob.data = me
    if old.users == 0:
        bpy.data.meshes.remove(old)


def box(name, size, loc=(0, 0, 0), material=None, bevel=0.002, rot=(0, 0, 0), segments=2, origin="center"):
    """Axis-aligned box. size=(x,y,z). origin: 'center' or 'bottom' (loc = bottom centre)."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=Vector(size), verts=bm.verts)
    if origin == "bottom":
        bmesh.ops.translate(bm, vec=Vector((0, 0, size[2] / 2)), verts=bm.verts)
    ob = _obj_from_bm(bm, name, material, loc, rot)
    return _finish(ob, min(bevel, min(size) * 0.45), segments)


def cyl(name, r, depth, loc=(0, 0, 0), material=None, verts=32, bevel=0.001, rot=(0, 0, 0), r2=None,
        segments=2, origin="center", smooth=True):
    """Cylinder along local Z. r2 makes a cone/frustum."""
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=verts, radius1=r,
                          radius2=r if r2 is None else r2, depth=depth)
    if origin == "bottom":
        bmesh.ops.translate(bm, vec=Vector((0, 0, depth / 2)), verts=bm.verts)
    ob = _obj_from_bm(bm, name, material, loc, rot)
    return _finish(ob, min(bevel, r * 0.4, depth * 0.4), segments, smooth_angle=60 if smooth else 20)


def torus(name, R, r, loc=(0, 0, 0), material=None, rot=(0, 0, 0), major=32, minor=12):
    bm = bmesh.new()
    for i in range(major):
        a = 2 * math.pi * i / major
        for j in range(minor):
            b = 2 * math.pi * j / minor
            bm.verts.new(((R + r * math.cos(b)) * math.cos(a), (R + r * math.cos(b)) * math.sin(a), r * math.sin(b)))
    bm.verts.ensure_lookup_table()
    for i in range(major):
        for j in range(minor):
            a = i * minor + j
            b = ((i + 1) % major) * minor + j
            c = ((i + 1) % major) * minor + (j + 1) % minor
            d = i * minor + (j + 1) % minor
            bm.faces.new((bm.verts[a], bm.verts[b], bm.verts[c], bm.verts[d]))
    ob = _obj_from_bm(bm, name, material, loc, rot)
    shade(ob, 80)
    return ob


def prism(name, pts2d, depth, loc=(0, 0, 0), material=None, bevel=0.001, rot=(0, 0, 0), segments=2, axis="z"):
    """Extrude a closed 2D polygon (x,y) by depth along +axis. Concave OK (uses triangle fill)."""
    bm = bmesh.new()
    vs = [bm.verts.new((x, y, 0)) for x, y in pts2d]
    f = bm.faces.new(vs)
    if f.normal.z < 0:
        f.normal_flip()
    r = bmesh.ops.extrude_face_region(bm, geom=[f])
    top = [v for v in r["geom"] if isinstance(v, bmesh.types.BMVert)]
    bmesh.ops.translate(bm, vec=Vector((0, 0, depth)), verts=top)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    if axis == "x":  # 2D x → world Y, 2D y → world Z, extrude along +X
        bmesh.ops.transform(bm, verts=bm.verts, matrix=Matrix(((0, 0, 1, 0), (1, 0, 0, 0), (0, 1, 0, 0), (0, 0, 0, 1))))
    elif axis == "y":  # 2D x → world X, 2D y → world Z, extrude along -Y
        bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(math.radians(90), 3, "X"))
    ob = _obj_from_bm(bm, name, material, loc, rot)
    return _finish(ob, bevel, segments)


def rounded_rect(w, h, r, n=6):
    """2D rounded rectangle points centred at origin."""
    pts = []
    r = min(r, w / 2 - 1e-4, h / 2 - 1e-4)
    for cx, cy, a0 in ((w / 2 - r, h / 2 - r, 0), (-w / 2 + r, h / 2 - r, 90), (-w / 2 + r, -h / 2 + r, 180),
                       (w / 2 - r, -h / 2 + r, 270)):
        for i in range(n + 1):
            a = math.radians(a0 + 90 * i / n)
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts


def lathe(name, profile, loc=(0, 0, 0), material=None, verts=48, rot=(0, 0, 0), smooth_angle=60, cap=True):
    """Revolve (r, z) profile points around Z."""
    bm = bmesh.new()
    rings = []
    for i in range(verts):
        a = 2 * math.pi * i / verts
        rings.append([bm.verts.new((r * math.cos(a), r * math.sin(a), z)) for r, z in profile])
    for i in range(verts):
        A, B = rings[i], rings[(i + 1) % verts]
        for j in range(len(profile) - 1):
            if profile[j][0] < 1e-6 and profile[j + 1][0] < 1e-6:
                continue
            try:
                bm.faces.new((A[j], B[j], B[j + 1], A[j + 1]))
            except ValueError:
                pass
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ob = _obj_from_bm(bm, name, material, loc, rot)
    shade(ob, smooth_angle)
    return ob


def tube_path(name, points, radius, material=None, res=8, closed=False, loc=(0, 0, 0)):
    """A cable/hose/rod following a poly-line (smoothed with a NURBS-like bezier)."""
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "3D"
    cu.bevel_depth = radius
    cu.bevel_resolution = max(1, res // 4)
    cu.resolution_u = 10
    sp = cu.splines.new("BEZIER")
    sp.bezier_points.add(len(points) - 1)
    for bp, p in zip(sp.bezier_points, points):
        bp.co = p
        bp.handle_left_type = bp.handle_right_type = "AUTO"
    sp.use_cyclic_u = closed
    cu.use_fill_caps = True
    ob = bpy.data.objects.new(name, cu)
    ob.location = loc
    link(ob)
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(bpy.context.evaluated_depsgraph_get()))
    mo = bpy.data.objects.new(name, me)
    mo.location = loc
    bpy.data.objects.remove(ob)
    link(mo)
    if material:
        me.materials.clear()
        me.materials.append(material)
    shade(mo, 70)
    return mo


def text(name, body, size=0.02, depth=0.0005, loc=(0, 0, 0), rot=(0, 0, 0), material=None, align="CENTER",
         bold=False):
    cu = bpy.data.curves.new(name, "FONT")
    cu.body = body
    cu.size = size
    cu.extrude = depth
    cu.align_x = align
    cu.align_y = "CENTER"
    ob = bpy.data.objects.new(name, cu)
    link(ob)
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(bpy.context.evaluated_depsgraph_get()))
    bpy.data.objects.remove(ob)
    mo = bpy.data.objects.new(name, me)
    mo.location = loc
    mo.rotation_euler = rot
    link(mo)
    if material:
        me.materials.append(material)
    return mo


def array(ob, count, offset, name=None):
    """Return [ob, copies...] offset by vector each step."""
    out = [ob]
    for i in range(1, count):
        c = ob.copy()
        c.data = ob.data  # linked data, joined later
        c.location = Vector(ob.location) + Vector(offset) * i
        link(c)
        out.append(c)
    return out


def vslot_2020(name, length, loc, material, axis="z", w=0.02, h=0.02):
    """Aluminium V-slot extrusion with slot grooves (outer profile, centred)."""
    s = 0.0031  # slot half width
    d = 0.0035  # slot depth
    pts = []
    hw, hh = w / 2, h / 2
    # build outline with one slot per 20 mm segment on each face
    def edge(p0, p1, inward):
        seg = int(round((p1 - p0).length / 0.02))
        out = []
        for k in range(seg):
            a = p0 + (p1 - p0) * (k / seg)
            b = p0 + (p1 - p0) * ((k + 1) / seg)
            mid = (a + b) / 2
            t = (b - a).normalized()
            out += [a, mid - t * s, mid - t * (s * 0.6) + inward * d, mid + t * (s * 0.6) + inward * d, mid + t * s]
        return out
    c = [Vector((-hw, -hh)), Vector((hw, -hh)), Vector((hw, hh)), Vector((-hw, hh))]
    inw = [Vector((0, 1)), Vector((-1, 0)), Vector((0, -1)), Vector((1, 0))]
    for i in range(4):
        pts += edge(c[i], c[(i + 1) % 4], inw[i])
    ob = prism(name, [(p.x, p.y) for p in pts], length, (0, 0, 0), material, bevel=0.0004, segments=1)
    # prism extrudes along +z from 0 → centre it
    for v in ob.data.vertices:
        v.co.z -= length / 2
    if axis == "x":
        ob.rotation_euler = (0, math.radians(90), 0)
    elif axis == "y":
        ob.rotation_euler = (math.radians(90), 0, 0)
    ob.location = loc
    return ob


# ----------------------------------------------------------------------------- grouping
def join(objs, name, parent=None):
    """Join mesh objects (applying transforms) into one object with world-space transform baked."""
    objs = [o for o in objs if o and o.type == "MESH"]
    if not objs:
        return None
    sync()
    for o in objs:
        # make single-user data so transforms can be applied independently
        if o.data.users > 1:
            o.data = o.data.copy()
        o.data.transform(o.matrix_world)
        o.matrix_world = Matrix.Identity(4)
    base = objs[0]
    with bpy.context.temp_override(active_object=base, selected_editable_objects=objs, selected_objects=objs):
        bpy.ops.object.join()
    base.name = name
    base.data.name = name
    if parent:
        # convert to parent-local
        sync()
        base.data.transform(parent.matrix_world.inverted())
        base.parent = parent
        base.matrix_world = parent.matrix_world.copy()
    return base


def collect(prefix_objs):
    return list(prefix_objs)


# ----------------------------------------------------------------------------- UVs
def box_uv(ob, scale=1.0):
    """World-scale box projection into UVMap (scale = metres per UV unit)."""
    me = ob.data
    if not me.uv_layers:
        me.uv_layers.new(name="UVMap")
    bm = bmesh.new()
    bm.from_mesh(me)
    uvl = bm.loops.layers.uv.active or bm.loops.layers.uv.new("UVMap")
    sync()
    mw = ob.matrix_world
    rot = mw.to_3x3()
    for f in bm.faces:
        n = (rot @ f.normal).normalized()
        ax = max(range(3), key=lambda i: abs(n[i]))
        for l in f.loops:
            co = mw @ l.vert.co
            if ax == 0:
                u, v = co.y * (1 if n.x > 0 else -1), co.z
            elif ax == 1:
                u, v = co.x * (-1 if n.y > 0 else 1), co.z
            else:
                u, v = co.x, co.y * (1 if n.z > 0 else -1)
            l[uvl].uv = (u / scale, v / scale)
    bm.to_mesh(me)
    bm.free()


def uv_all(objs, scale=1.0):
    for o in objs:
        if o.type == "MESH":
            box_uv(o, scale)


# ----------------------------------------------------------------------------- export & preview
def descendants(root):
    out = [root]
    for c in root.children:
        out += descendants(c)
    return out


def tri_count(root):
    n = 0
    for o in descendants(root):
        if o.type == "MESH":
            for p in o.data.polygons:
                n += len(p.vertices) - 2
    return n


def export_glb(root, name):
    MODELS.mkdir(parents=True, exist_ok=True)
    for o in bpy.context.scene.objects:
        o.select_set(False)
    for o in descendants(root):
        o.select_set(True)
        if o.type == "MESH" and not o.data.uv_layers:
            box_uv(o, 1.0)
    path = MODELS / f"{name}.glb"
    bpy.ops.export_scene.gltf(filepath=str(path), use_selection=True, export_format="GLB", export_extras=True,
                              export_apply=True, export_yup=True, export_image_format="AUTO",
                              export_materials="EXPORT", export_cameras=False, export_lights=False)
    kb = path.stat().st_size / 1024
    print(f"[export] {name}.glb  {kb:.0f} KB  {tri_count(root)} tris")
    return path


def preview(root, name, res=(960, 720), samples=48, angle=35, elev=22, dist_mul=1.0, extra_objs=()):
    """Cycles studio render for QA → docs/qa/assets/<name>.png"""
    QA.mkdir(parents=True, exist_ok=True)
    sc = bpy.context.scene
    # bounds
    pts = []
    for o in descendants(root):
        if o.type == "MESH":
            pts += [o.matrix_world @ Vector(c) for c in o.bound_box]
    mn = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    mx = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    ctr = (mn + mx) / 2
    size = (mx - mn).length
    # floor
    bpy.ops.mesh.primitive_plane_add(size=size * 20, location=(ctr.x, ctr.y, mn.z))
    fl = bpy.context.object
    fl.data.materials.append(mat("_qa_floor", (0.42, 0.43, 0.45), 0, 0.6))
    # world
    w = bpy.data.worlds.new("qa")
    w.use_nodes = True
    w.node_tree.nodes["Background"].inputs["Color"].default_value = (0.30, 0.32, 0.36, 1)
    w.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.6
    sc.world = w
    # lights
    def area(loc, energy, sz):
        ld = bpy.data.lights.new("qa_l", "AREA")
        ld.energy = energy * size * size
        ld.size = sz * size
        lo = bpy.data.objects.new("qa_l", ld)
        lo.location = loc
        link(lo)
        c = lo.constraints.new("TRACK_TO")
        c.target = fl
        t = empty("qa_t", ctr)
        c.target = t
        return lo
    area(ctr + Vector((-1.2, -1.4, 1.6)) * size, 260, 0.8)
    area(ctr + Vector((1.6, -0.6, 0.9)) * size, 90, 0.6)
    area(ctr + Vector((0.3, 1.8, 1.4)) * size, 140, 0.6)
    # camera
    cd = bpy.data.cameras.new("qa_cam")
    cd.lens = 50
    cam = bpy.data.objects.new("qa_cam", cd)
    link(cam)
    a, e = math.radians(angle), math.radians(elev)
    dist = size * 1.55 * dist_mul
    cam.location = ctr + Vector((math.sin(a) * math.cos(e), -math.cos(a) * math.cos(e), math.sin(e))) * dist
    tgt = empty("qa_cam_t", ctr)
    c = cam.constraints.new("TRACK_TO")
    c.target = tgt
    sc.camera = cam
    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"
    sc.cycles.samples = samples
    sc.cycles.use_denoising = True
    sc.render.resolution_x, sc.render.resolution_y = res
    sc.view_settings.view_transform = "AgX"
    sc.render.filepath = str(QA / f"{name}.png")
    bpy.ops.render.render(write_still=True)
    print(f"[preview] docs/qa/assets/{name}.png")


def decal(name, w, h, loc, rot, image_name, rough=0.6, emission=0.0, alpha=False):
    """A flat quad (w x h) with 0..1 UVs showing assets_src/textures/<image_name>. Faces local +Z."""
    bm = bmesh.new()
    vs = [bm.verts.new(p) for p in ((-w / 2, -h / 2, 0), (w / 2, -h / 2, 0), (w / 2, h / 2, 0), (-w / 2, h / 2, 0))]
    f = bm.faces.new(vs)
    uvl = bm.loops.layers.uv.new("UVMap")
    for l, uv in zip(f.loops, ((0, 0), (1, 0), (1, 1), (0, 1))):
        l[uvl].uv = uv
    m = image_mat("Decal_" + image_name, TEX / image_name, rough=rough, emission_strength=emission, alpha_blend=alpha)
    return _obj_from_bm(bm, name, m, loc, rot)


def offset_mesh(ob, offset):
    """Move mesh data relative to the object origin (use to build around a pivot/hinge)."""
    ob.data.transform(Matrix.Translation(Vector(offset)))
    return ob


# ----------------------------------------------------------------------------- baked ambient occlusion (M1.1)
AO_DIR = ROOT / "tools/blender/out/ao"


def _gltf_output_group():
    """Node group the glTF exporter recognises for the occlusion texture."""
    ng = bpy.data.node_groups.get("glTF Material Output")
    if ng is None:
        ng = bpy.data.node_groups.new("glTF Material Output", "ShaderNodeTree")
        ng.interface.new_socket("Occlusion", in_out="INPUT", socket_type="NodeSocketFloat")
        ng.interface.new_socket("Thickness", in_out="INPUT", socket_type="NodeSocketFloat")
    return ng


def _second_uv(meshes, name, margin=0.004):
    """Give every mesh a non-overlapping second UV layer packed into one shared 0..1 space."""
    for o in meshes:
        me = o.data
        if not me.uv_layers:
            box_uv(o, 1.0)
        if name not in me.uv_layers:
            me.uv_layers.new(name=name)
        me.uv_layers[name].active = True
    for o in bpy.context.scene.objects:
        o.select_set(False)
    for o in meshes:
        o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=margin, area_weight=0.0, scale_to_bounds=False)
    bpy.ops.uv.pack_islands(udim_source="CLOSEST_UDIM", rotate=True, margin=margin)
    bpy.ops.object.mode_set(mode="OBJECT")


def _unique_materials(meshes, suffix):
    """Copy materials shared with meshes outside this set (each AO atlas needs its own material)."""
    mine = set(meshes)
    for o in meshes:
        for slot in o.material_slots:
            m = slot.material
            if m is None:
                continue
            users = [x for x in bpy.context.scene.objects if x.type == "MESH" and any(s.material == m for s in x.material_slots)]
            if any(u not in mine for u in users):
                slot.material = m.copy()
                slot.material.name = f"{m.name}__{suffix}"


def bake_ao(root, name, size=1024, samples=40, distance=0.12):
    """Bake ambient occlusion for every mesh under root into one atlas and wire it as glTF occlusion."""
    meshes = [o for o in descendants(root) if o.type == "MESH" and len(o.data.polygons) > 0]
    if not meshes:
        return
    sync()
    _unique_materials(meshes, name)
    _second_uv(meshes, "AOUV")
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"
    sc.cycles.samples = samples
    if sc.world is None:
        sc.world = bpy.data.worlds.new("bake")
    sc.world.light_settings.distance = distance
    img = bpy.data.images.new(f"{name}_ao", size, size, alpha=False)
    img.generated_color = (1, 1, 1, 1)
    mats = {s.material for o in meshes for s in o.material_slots if s.material}
    bake_nodes = []
    for m in mats:
        m.use_nodes = True
        nt = m.node_tree
        tex = nt.nodes.new("ShaderNodeTexImage")
        tex.image = img
        tex.name = "AO_BAKE"
        nt.nodes.active = tex
        bake_nodes.append((m, tex))
    for o in sc.objects:
        o.select_set(o in meshes)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.bake(type="AO", margin=3, use_clear=True, target="IMAGE_TEXTURES")
    # denoise-ish: gentle blur of the AO (it is low-frequency), then lift so the AO is never pure black
    import numpy as np
    px = np.array(img.pixels[:], dtype=np.float32).reshape(size, size, 4)
    try:
        from scipy import ndimage  # noqa: F401 (available in the bpy venv only if installed)
        px[..., :3] = ndimage.gaussian_filter(px[..., :3], (1.0, 1.0, 0))
    except Exception:
        k = px[..., :3]
        px[..., :3] = (k + np.roll(k, 1, 0) + np.roll(k, -1, 0) + np.roll(k, 1, 1) + np.roll(k, -1, 1)) / 5
    px[..., :3] = 0.18 + 0.82 * np.clip(px[..., :3], 0, 1) ** 0.9
    img.pixels = px.ravel().tolist()
    AO_DIR.mkdir(parents=True, exist_ok=True)
    img.filepath_raw = str(AO_DIR / f"{name}_ao.png")
    img.file_format = "PNG"
    img.save()
    grp = _gltf_output_group()
    for m, tex in bake_nodes:
        nt = m.node_tree
        uv = nt.nodes.new("ShaderNodeUVMap")
        uv.uv_map = "AOUV"
        nt.links.new(uv.outputs["UV"], tex.inputs["Vector"])
        sep = nt.nodes.new("ShaderNodeSeparateColor")
        nt.links.new(tex.outputs["Color"], sep.inputs["Color"])
        g = nt.nodes.new("ShaderNodeGroup")
        g.node_tree = grp
        nt.links.new(sep.outputs["Red"], g.inputs["Occlusion"])
    # make UVMap (index 0) the render/active layer again for export
    for o in meshes:
        o.data.uv_layers["UVMap"].active = True if "UVMap" in o.data.uv_layers else False
    print(f"[ao] {name}: {len(meshes)} meshes, {len(mats)} materials, {size}px")


def cull_faces(ob, keep):
    """Delete faces for which keep(world_normal, world_center) is False (hidden faces waste lightmap space)."""
    sync()
    mw = ob.matrix_world
    rot = mw.to_3x3()
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    dead = [f for f in bm.faces if not keep((rot @ f.normal).normalized(), mw @ f.calc_center_median())]
    bmesh.ops.delete(bm, geom=dead, context="FACES")
    bm.to_mesh(ob.data)
    bm.free()
    return ob
