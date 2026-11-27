"""QA: render each print product individually (orange filament) → docs/qa/assets/products_sheet.png"""
import subprocess, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent)); sys.path.insert(0, str(Path(__file__).parent / "assets"))
import lib as L
import products
names = ["benchy", "clips", "phone_stand", "gear", "vase", "dragon", "suzanne", "planter", "helmet"]
files = []
for n in names:
    L.reset(); L.clear_caches()
    root = getattr(products, {"phone_stand": "phone_stand"}.get(n, n))(0)
    root.location.x = 0
    m = L.bpy.data.materials["Filament"]
    m.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.9, 0.25, 0.03, 1)
    L.preview(root, f"_p_{n}", res=(360, 300), samples=24, angle=30, elev=28, dist_mul=0.9)
    files.append(str(L.QA / f"_p_{n}.png"))
subprocess.run(["montage", *files, "-tile", "5x2", "-geometry", "360x300+2+2", "-background", "#222", str(L.QA / "products_sheet.png")])
for f in files: Path(f).unlink()
print("sheet ok")
