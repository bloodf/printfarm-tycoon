"""Bake indirect-light lightmaps for the garage shell (M1.1, decision D10 "Baked Indirect").

Builds the garage + every static prop exactly where the game places them (src/data/layout.json), lets Cycles compute
bounce light from the ceiling battens, the garage-door windows and the sky through the window, and stores the INDIRECT
diffuse irradiance per shell surface. Direct light stays real-time in the game (so printers and moving items still get
live shadows); the lightmaps add what real-time lighting can't: colour bleeding, soft bounce and contact darkening
under the furniture.

    ~/.venvs/blender/bin/python tools/blender/bake_lightmaps.py [--samples 256] [--fast]
Outputs: tools/blender/out/garage.glb (with the LMUV second UV set), public/assets/lightmaps/<Object>.jpg + manifest.json
"""
import json
import math
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE / "assets"))

import lib as L  # noqa: E402
import bpy  # noqa: E402
import numpy as np  # noqa: E402
from mathutils import Euler, Matrix, Vector  # noqa: E402

FAST = "--fast" in sys.argv
SAMPLES = 48 if FAST else int(next((a.split("=")[1] for a in sys.argv if a.startswith("--samples=")), "256"))
LAYOUT = json.loads((L.ROOT / "src/data/layout.json").read_text())
OUT = L.ROOT / "public/assets/lightmaps"
OUT.mkdir(parents=True, exist_ok=True)

# shell objects that receive a lightmap → resolution
TARGETS = {"Floor": 2048, "Walls": 2048, "Ceiling": 1024, "OSBWall": 1024, "GarageDoor": 1024, "HouseDoorFrame": 512,
           "HouseDoorSlab": 512, "Window": 256, "Electrical": 256}
SCALE = 2.0  # stored value = (irradiance / SCALE) ^ (1/2.2); the game multiplies back


def three_to_blender(p):
    x, y, z = p
    return Vector((x, -z, y))


def main():
    t0 = time.time()
    L.reset()
    L.clear_caches()
    import garage
    import props
    groot = garage.build()
    # ------------------------------------------------------------------ place static props (occluders/bouncers)
    placed = {}
    fns = {f.__name__: f for f in props.PROPS}
    for pl in LAYOUT["placements"]:
        fn = fns.get(pl["prop"])
        if not fn:
            print("  ! unknown prop", pl["prop"])
            continue
        r = fn()
        L.sync()
        if pl.get("parent"):
            parent = placed[pl["parent"]]
            r.parent = parent
            r.location = three_to_blender(pl["pos"])
            r.rotation_euler = Euler((0, 0, pl["rotY"]))
        else:
            r.location = three_to_blender(pl["pos"])
            r.rotation_euler = Euler((0, 0, pl["rotY"]))
        placed[pl["prop"]] = r
    L.sync()
    # an Endr-3 always sits on slot 1 (the starter printer) — include a simple proxy box so the wall behind it gets its bounce shadow
    L.box("printer_proxy", (0.35, 0.36, 0.45), three_to_blender((-0.32, 0.9, -2.87)), L.mat("ProxyDark", (0.05, 0.05, 0.05), 0, 0.6), bevel=0, origin="bottom")

    # ------------------------------------------------------------------ lights: battens (area) + sky through the window
    for x in (-1.3, 1.3):
        ld = bpy.data.lights.new("batten", "AREA")
        ld.shape = "RECTANGLE"
        ld.size = 0.08
        ld.size_y = 1.18
        ld.energy = 90
        ld.color = (0.96, 0.97, 1.0)
        lo = bpy.data.objects.new("batten", ld)
        lo.location = (x, 0.3, 2.62)
        L.link(lo)
    sp = bpy.data.lights.new("ceiling_spot", "SPOT")
    sp.energy = 120
    sp.spot_size = math.radians(130)
    sp.spot_blend = 1.0
    so = bpy.data.objects.new("ceiling_spot", sp)
    so.location = (0, 0.6, 2.6)
    L.link(so)
    w = bpy.data.worlds.new("sky")
    w.use_nodes = True
    w.node_tree.nodes["Background"].inputs["Color"].default_value = (0.55, 0.68, 0.9, 1)
    w.node_tree.nodes["Background"].inputs["Strength"].default_value = 1.2
    bpy.context.scene.world = w

    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"
    sc.cycles.samples = SAMPLES
    sc.render.bake.use_pass_direct = False
    sc.render.bake.use_pass_indirect = True
    sc.render.bake.use_pass_color = False
    sc.render.bake.margin = 6

    manifest = {}
    objs = {o.name: o for o in L.descendants(groot)}
    for name, size in TARGETS.items():
        o = objs.get(name)
        if o is None or o.type != "MESH":
            print("  ! missing", name)
            continue
        t = time.time()
        me = o.data
        if not me.uv_layers:
            L.box_uv(o, 1.0)
        lm = me.uv_layers.new(name="LMUV")
        lm.active = True
        for x in sc.objects:
            x.select_set(False)
        o.select_set(True)
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.select_all(action="SELECT")
        bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.004, area_weight=0.0)
        bpy.ops.uv.pack_islands(rotate=True, margin=0.003)
        bpy.ops.object.mode_set(mode="OBJECT")
        img = bpy.data.images.new(f"LM_{name}", size, size, alpha=True, float_buffer=True)
        nodes = []
        for slot in o.material_slots:
            m = slot.material
            if not m:
                continue
            m = m.copy()  # shell materials may be shared → per-object copy so each bakes into its own image
            slot.material = m
            n = m.node_tree.nodes.new("ShaderNodeTexImage")
            n.image = img
            m.node_tree.nodes.active = n
            nodes.append((m, n))
        bpy.ops.object.bake(type="DIFFUSE", pass_filter={"INDIRECT"}, use_clear=True, margin=6, target="IMAGE_TEXTURES")
        for m, n in nodes:
            m.node_tree.nodes.remove(n)
        # coverage-aware blur (bake noise is high-frequency; indirect light is smooth) + encode
        px = np.array(img.pixels[:], dtype=np.float32).reshape(size, size, 4)
        rgb, a = px[..., :3], px[..., 3:4]
        try:
            from scipy import ndimage
            sig = max(1.0, size / 1024 * 1.6)
            num = ndimage.gaussian_filter(rgb * a, (sig, sig, 0))
            den = ndimage.gaussian_filter(a, (sig, sig, 0)) + 1e-6
            rgb = np.where(a > 0, num / den, rgb)
        except Exception as e:  # scipy not in the bpy venv: keep raw
            print("  (no scipy blur)", e)
        p99 = float(np.percentile(rgb[a[..., 0] > 0], 99)) if (a > 0).any() else 0
        enc = np.clip(rgb / SCALE, 0, 1) ** (1 / 2.2)
        from PIL import Image  # bpy venv has no PIL? fall back to bpy image save
        arr = (enc[::-1] * 255).astype(np.uint8)
        Image.fromarray(arr).save(OUT / f"{name}.jpg", quality=92)
        manifest[name] = {"file": f"/assets/lightmaps/{name}.jpg", "scale": SCALE, "p99": round(p99, 3)}
        me.uv_layers["UVMap"].active = True
        print(f"  [lightmap] {name:15s} {size}px  p99={p99:.3f}  {time.time() - t:.0f}s", flush=True)

    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=1))
    # ------------------------------------------------------------------ export the garage (with LMUV) for the game
    for name, o in list(objs.items()):
        pass
    # remove the props + proxies (they ship in props.glb) before exporting
    keep = set(L.descendants(groot))
    for o in list(sc.objects):
        if o not in keep:
            bpy.data.objects.remove(o, do_unlink=True)
    L.export_glb(groot, "garage")
    print(f"[done] lightmaps in {time.time() - t0:.0f}s")


main()
