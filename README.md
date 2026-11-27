# PrintFarm Tycoon

A **3D-print farm simulator** for the web, played entirely with the mouse. You start with one printer in your garage and grow into a
warehouse. You never see a customer: they reach you only through **email and web-shop orders** on your in-game laptop.

> **Read first:** [`docs/PLAN.md`](docs/PLAN.md) (production plan, decisions, gates) ·
> [`docs/TRACKER.md`](docs/TRACKER.md) (task board + evidence) · [`docs/GDD.md`](docs/GDD.md) (game design) ·
> briefs in [`docs/specs/`](docs/specs) · QA evidence in [`docs/qa/`](docs/qa)

## Status: M2 "Running a real farm" (awaiting director gate review)

M2 (plan: [`docs/M2_PLAN.md`](docs/M2_PLAN.md)):
- **No avatar.** You never see your character, so the first-person mode, walking, footsteps and the floating held item
  are gone. The game is pure Point & Click: orbit camera, click objects, toolbar. "Go to bed" is now **End day**.
- **4 new printers modelled on real machines:** Bambu Lab **A1 with AMS lite** (4 colours), **Snapmaker U1**
  (4-toolhead toolchanger), **Creality K1** (enclosed CoreXY) and **Prusa XL 5T** (5 toolheads, 360 mm). They are
  sold under parody names (decision D3). The garage has slots by size: back bench 4 × M, a new print table 3 × L,
  an XL cart.
- **Multicolour printing:** multicolour products (Benchy, keychains, rainbow dragon), a Slicer that maps colours to
  AMS slots / toolheads, purge time and waste, a multicolour print shader, and an XL-only chest armour.
- **Filament drying:** spools come vacuum-sealed, absorb moisture once opened (more on humid days), and wet filament
  causes stringing, lower grades and failures. There is a filament dryer on the fridge (2 spools, 55 °C), and you can buy 2 more.
- **Printer errors and maintenance:** thermal runaway, heatbed fault, AMS tangle, toolchange failure, MCU crash, fan
  failure (needs a spare part), each fixed by clicking the printer. There is also nozzle, belt and build-plate wear,
  with maintenance actions, spare parts and firmware updates.
- **Daily incidents** from day 2: **power outage** (the lights go out, printers stop, those without power-loss
  recovery lose the print; a UPS upgrade bridges 60 min), **internet outage** (no orders or email, the Shop is offline,
  Wi-Fi printers need USB), humid day (with rain), heat wave, courier late, supplier delay, viral product.
- New sounds: power down/up, dryer hum, AMS feed, toolchange, error alarm, rain. The garage lightmaps were re-baked for the new layout.

### M1.1 (approved)

- **Realism pass:** Cycles-baked indirect lightmaps, baked AO on every model, texture set v2, weathering shader,
  AgX + grain + depth of field, practical lights, set dressing, printer stickers and cables.
- **Point & Click mode:** the whole game playable with the mouse (the only mode since M2).

### M1 (approved with changes)

- **3 printers modelled on real machines** (Creality Ender-3 V3 SE, Prusa MK4, Bambu Lab P1S) at real dimensions,
  with working rigs: bed-slinging, Z gantries, CoreXY, the P1S door, live screens, status LEDs, spools and a filament path.
- **A furnished garage**: block walls, a sectional door, a window with daylight, workbench, shelving, desk, packing
  station, outbox and tools.
- **The full gameplay loop**: email and shop orders → Slicer (USB or Wi-Fi) → live layer-by-layer printing → failures
  (spaghetti, clogs, layer shifts, runouts) → remove the print → a 6-step packing station → Outbox → the courier at
  17:00 → reviews and reputation → the shop for filament, supplies and printers → next-day deliveries → the day cycle and sleep.
- **The LayerOS laptop**: Mail (reply choices), Orders, Slicer (3D layer preview, time/cost/risk estimates), Farm (live
  chamber camera on the P1S), Shop (cart), Bank (ledger and chart).
- **An AAA-style UI**: boot/loading, main menu over the live 3D scene, HUD, tutorial goals, prompts with hold rings,
  toasts, pause, settings (graphics presets, audio buses, FOV, sensitivity, key rebinding), an end-of-day report.
- **Audio**: 33 synthesised sounds, 3D positional printer audio, a lo-fi radio, room tone, a 4-bus mixer.

## Run it

```bash
npm install
npm run dev          # http://localhost:5173
```

Click to start, then **New game**. Everything is done with the mouse:
drag to look around, wheel to zoom, double-click the floor to move the view, **click objects** for their actions
(timed actions show a progress ring). The toolbar at the bottom has the Laptop, Pause / 1× / 8×, Reset view, End day
and the Menu. Optional keys: **WASD** pan · **T** fast-forward · **G** drop the carried item · **Esc** pause · **F5** quick save.

For the full look, play in a **browser with GPU acceleration** (Settings → Graphics → High/Ultra). Without a GPU
(e.g. a VM) use **Low** (`http://localhost:5173/?quality=low`).

## Commands

| Command | What it does |
|---|---|
| `npm run dev` / `build` / `preview` | Dev server / production build / serve the build |
| `npm test` / `npm run test:unit` | Unit tests: the simulation (Vitest, 36 tests, ~2 s). `npm run test:watch` re-runs on save |
| `npm run test:e2e` | End-to-end test: a full in-game day played with the mouse in headless Chromium (53 checks, zero key presses, no console errors) → `docs/qa/playthrough_click/`. Starts the dev server if none is running. ~20 min in software rendering |
| `npm run test:all` | Lint + unit tests + production build + end-to-end test |
| `npm run lint` | oxlint |
| `npm run qa:beauty` | Art-review screenshots on the High preset → `docs/qa/beauty/` (~20 min) |
| `npm run assets:models` | Full asset rebuild: textures → every model with Blender 5 (bpy) + baked AO → Cycles lightmaps for the garage → optimise (meshopt + WebP) (~2 h on 4 CPU cores) |
| `npm run assets:textures` | Rebuild the procedural PBR textures and decals |
| `npm run assets:audio` | Re-synthesise every sound (+ spectrogram QA sheet) |

End-to-end tests need Python 3 with Playwright: `pip install playwright && playwright install chromium`.
Optional env: `PFT_PORT` (default 5173) or `PFT_URL` (test an already running server), `PYTHON` (interpreter).

Asset tools need Python 3 with numpy/scipy/Pillow/matplotlib and ffmpeg. The Blender models need the `bpy` wheel:
`uv venv -p 3.11 ~/.venvs/blender && uv pip install -p ~/.venvs/blender/bin/python bpy==5.0.1`.

## Project layout

```
docs/             plan, GDD, briefs (ART/UI/CONTROLS/AUDIO), tracker, QA evidence
tools/blender/    asset scripts: lib.py (mesh/material/UV helpers), parts.py (printer parts), assets/*.py
tools/textures/   procedural PBR textures + decals (numpy/PIL) → assets_src/textures/ (Blender bake inputs)
tools/audio/      procedural sound synthesis (numpy/scipy → ogg)
tools/qa/         playthrough + beauty-shot automation (Playwright)
public/assets/    built models (.glb), textures, audio
src/sim/          pure TypeScript simulation (no React/Three), unit-tested
src/data/         content as data: printers, garage slots, filaments, products, errors, incidents, economy, emails, goals
src/game/         store (Zustand), input, audio engine, settings, runtime, QA hooks
src/world/        React Three Fiber world: level, printer rigs, print shader, camera + picking, dryers, post-FX
src/ui/           design system, HUD, menus, LayerOS laptop apps, stations
```

## Naming

The printers are visually modelled on real machines, but use parody names (decision D3 in the plan). To use the real
names, edit `name`/`brand` in `src/data/printers.ts`.
