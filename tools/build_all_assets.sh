#!/bin/bash
# Full asset rebuild: textures → models (+AO) → lightmapped garage → optimise. Logs to .shots/assets.log
set -e
cd "$(dirname "$0")/.."
BPY="$HOME/.venvs/blender/bin/python"
echo "== textures" ; python3 tools/textures/build_textures.py ; python3 tools/textures/build_decals.py
echo "== models + AO" ; nice -n 5 "$BPY" -u tools/blender/build.py all --fast
echo "== lightmaps" ; nice -n 5 "$BPY" -u tools/blender/bake_lightmaps.py --samples=200
echo "== optimise" ; node tools/optimize_models.mjs
echo "ALL ASSETS DONE"
