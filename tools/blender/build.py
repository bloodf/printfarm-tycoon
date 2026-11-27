"""Asset build runner.

Usage (from the project root):
    ~/.venvs/blender/bin/python tools/blender/build.py printer_ender3v3 [more...] [--no-preview] [--fast]
    ~/.venvs/blender/bin/python tools/blender/build.py all

Each module in tools/blender/assets/ defines build() -> root object, plus optional PREVIEW dict
(kwargs for lib.preview). Output: public/assets/models/<name>.glb and docs/qa/assets/<name>.png
"""
import importlib
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE / "assets"))

import lib as L  # noqa: E402


def run(name, preview=True, fast=False):
    t = time.time()
    L.reset()
    L.clear_caches()
    mod = importlib.import_module(name)
    root = mod.build()
    if "--no-ao" not in sys.argv and hasattr(mod, "AO"):
        # AO = dict(size=..) bakes the whole asset; AO = "children" bakes one atlas per child root (multi-asset GLBs)
        ao = mod.AO
        if ao == "children" or (isinstance(ao, dict) and ao.get("children")):
            opts = ao if isinstance(ao, dict) else {}
            for child in list(root.children):
                L.bake_ao(child, child.name, size=opts.get("size", 512), samples=opts.get("samples", 32))
        else:
            L.bake_ao(root, name, **ao)
    L.export_glb(root, getattr(mod, "EXPORT_NAME", name))
    if preview:
        if hasattr(mod, "preview_extras"):
            extra = mod.preview_extras(root)
            if extra is not None:
                extra.parent = root  # include in framing
        kw = dict(getattr(mod, "PREVIEW", {}))
        if fast:
            kw["samples"] = 16
            kw["res"] = (640, 480)
        L.preview(root, name, **kw)
    print(f"[done] {name} in {time.time() - t:.1f}s")


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if args == ["all"]:
        args = sorted(p.stem for p in (HERE / "assets").glob("*.py") if not p.stem.startswith("_"))
        args = [a for a in args if not getattr(importlib.import_module(a), "LIGHTMAPPED", False)]  # see bake_lightmaps.py
    for a in args:
        run(a, preview="--no-preview" not in sys.argv, fast="--fast" in sys.argv)
