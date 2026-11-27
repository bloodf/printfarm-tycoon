# QA report

## M2 "Running a real farm"
| Evidence | Where |
|---|---|
| **Mouse-only playthrough v2**: a full day plus the M2 systems. No avatar/FPS mode in the build; printer error E302 → spare part → timed fix → print resumes; damp spool → dryer → dried → shelf; **lights-out** power outage (banner, dimmed room) and recovery; **internet outage** (Shop offline); courier, End day, day 2, delivery. Page keydown counter must stay 0 | [`playthrough_click/`](playthrough_click) + `results.json` (**53/53**) |
| **Beauty shots (High preset)** of the M2 garage: 7 printers mid-production, A1 + AMS lite, U1 toolchanger, Prusa XL with the XL-only chest armour, K1, dryers with spools, gameplay HUD, Farm app, an AMS-tangle error, the Slicer with a 3-colour job, lights-out | [`beauty/`](beauty) |
| Asset previews (Cycles): A1, U1, K1, XL, the new dryer, keychains, chest armour | [`assets/`](assets) `printer_a1/u1/k1/xl.png`, `filament_dryer.png`, `products_keychains.png`, `products_chestplate.png` |
| Unit tests (slots/capacity, multi-tool jobs, AMS purge, moisture + dryers, errors + fixes + parts, build-plate wear + cleaning, firmware, incidents: outage + UPS + power-loss recovery, internet + missed orders, courier late, save v1 → v2 migration) | `npm test`: **36/36** |
| Audio: 7 new sounds (power down/up, dryer hum, AMS feed, toolchange, error alarm, rain); the build checks peaks and loop seams | [`audio_sheet.png`](audio_sheet.png) |
| Lightmaps re-baked for the new layout (print table, XL cart, dryers) | `public/assets/lightmaps/` (180 samples, ~90 min on 4 cores) |
| Type check, lint, production build | `npm run build` passes; `npm run lint`: 0 errors |

M2 issues found and fixed during QA:
| Issue | Found by | Fix |
|---|---|---|
| Printers on the new print table / XL cart never appeared: Blender renamed the duplicate slot empties to `Slot_0.001` (GLTFLoader → `Slot_0001`) | beauty shots | `findNode` accepts Blender's 3-digit duplicate suffix inside a prop subtree; the optimiser now lists such names |
| Same root cause, latent since M1: medium/large boxes' packing-stage nodes (`BoxClosed.001`…) were not found, so every stage could show at once | name audit after the fix above | same `findNode` fix |
| A first version of that alias also matched `SpoolMount_0` for `SpoolMount`, so multi-spool printers showed only one spool | beauty shots | alias limited to the exact 3-digit form |
| Toolhead colour rings (U1, XL) all white: gltf-transform's dedup merged the identical `ToolColor_0..4` materials | beauty shots | the optimiser keeps recoloured materials apart, and lost critical materials now fail the build |
| Filament dryer was a solid box: the spools were hidden, overlapped and poked through the walls, and it read as a microwave | playthrough screenshot | remodelled (hollow shell, window, smoked lid, rollers, spools across the width) |
| Printer, dryer and laptop screens could stay blank in dev: the canvas texture was attached to the material inside a `useMemo`, and React 19 StrictMode keeps the first memo result but the second call's side effect | dryer LCD debugging (canvas never painted) | texture in the memo, material hookup in a `useEffect` (printers, dryers, laptop) |
| A missing prop in a stale `props.glb` crashed the scene (dryer) | smoke test | dryers are skipped with a warning, like other props |
| Lights-out barely visible at noon: the baked lightmaps (which include the ceiling lights) stayed at full strength | playthrough screenshot | lightmaps + environment dim with the power; only the window's share remains |
| "Power outage" chip stayed after the power came back | playthrough screenshot | Today strip shows active outages in red and finished ones struck through |
| Error toast said "spare part" twice; laptop Wi-Fi icon ignored outages; Farm badge ignored errors | playthrough screenshot | fixed |

Render budget (establishing view, 7 printers + 3 dryers): **High 1,652 draw calls / 1.79 M triangles** (incl. 2 shadow
passes), **Low 584 / 0.64 M**. M1 High was ~620 draw calls, so the M4 instancing/merging work matters more now.

Not verified here: real-GPU frame rate (this VM has no GPU; everything renders in SwiftShader at 1–2 fps), and how the sounds sound (no speakers).

---

## M1.1 "Look & Feel + Point & Click"
| Evidence | Where |
|---|---|
| **Before/after** from identical camera views (M1 vs M1.1, High preset) | [`before_after/comparison.jpg`](before_after/comparison.jpg) |
| Full beauty set (M1.1) | [`beauty/`](beauty) |
| **Mouse-only playthrough**: a full day in Point & Click mode, the page's keydown counter must stay at 0 | [`playthrough_click/`](playthrough_click) + `results.json` |
| First-person playthrough (regression) | removed in M2 together with first-person mode |
| Unit tests | `npm test`: 19/19 |
| Texture sheets | [`assets/textures_sheet.jpg`](assets) (v1). v2 maps are in `public/assets/textures/` |

M1.1 issues found and fixed during QA:
| Issue | Found by | Fix |
|---|---|---|
| New layout crashed the level when `props.glb` was older than the layout | mouse-only playthrough | missing props are skipped with a warning |
| First click on the boot screen ignored while lightmaps/grunge were still loading | mouse-only playthrough | "ready" latch |
| Over-exposed, flat first lighting pass (walls near white) | beauty review | lower real-time intensities, lightmap gain, a warm light-grey paint tint |
| Film grain too strong ("snow") | beauty review | overlay grain at 6% |
| OSB too contrasty / cartoonish | beauty review | OSB v3 (three strand layers, muted tones, fibre grain), hot-swapped with the retexture tool |
| Flat cartoon view through the window | beauty review | noise-based foliage, clouds, lens defocus, brighter emission |
| The desktop Chrome tab rendering the game starved the bake of CPU | bake monitoring | game tab backgrounded during bakes |

---

# M1: Garage vertical slice

Everything here can be reproduced with the commands in the project README.

## 1. Automated tests
| Suite | Result | Command |
|---|---|---|
| Simulation unit tests (order loop, USB/Wi-Fi, runout, spaghetti, clog, cancel, shop/deliveries, mail replies, day cycle, forced day end, tutorial grace, frame-rate independence, determinism, save round-trip) | **19/19 pass** | `npm test` |
| Type check + production build | pass | `npm run build` |
| Lint (oxlint) | 0 errors | `npm run lint` |

## 2. Scripted playthrough (`tools/qa/playthrough.py`, first-person; removed in M2)
A full in-game day through the **real input and interaction code** (key presses, raycasts, hold actions, UI clicks).
Screenshots for every step are in [`playthrough/`](playthrough), and the machine-readable results in
[`playthrough/results.json`](playthrough/results.json).

Steps covered: boot → menu → new game → audio running → look at the laptop → Mail (goal 1) → Orders → Slicer → Save to USB → Shop/Farm/Bank → Esc →
printer → start from USB → printing → printer screen (F) → print finished → hold E to remove → packing table →
6-step packing station → pick up the parcel → Outbox → courier at 17:00 ships and pays → house door → end-of-day report →
sleep → day 2 → autosave → delivery at 08:30 → reviews → unbox the delivery → no console errors.

## 3. Art review
- **Asset previews** (Cycles renders straight out of the pipeline): [`assets/`](assets): every printer, the open P1S,
  the spool, the boxes, the props, the products sheet and the textures sheet.
- **In-game beauty shots** (High preset): [`beauty/`](beauty): establishing shot, workbench with all three printers
  mid-print, per-printer close-ups, a spaghetti failure, the shelf, the desk and window, the gameplay HUD, the Farm app with the live chamber camera.

## 4. Audio
- 33 sounds, 860 KB, built by `tools/audio/build_audio.py`. The build checks peaks (no clipping) and loop seams.
- Spectrogram sheet: [`audio_sheet.png`](audio_sheet.png).
- At runtime the playthrough confirms the mixer is `running` with 33 buffers decoded and no pending loops.
- ⚠ No human has listened to these yet. Please judge them by ear during the gate review.

## 5. Render budget (measured with `gl.info` in the garage)
| Preset | Draw calls | Triangles | Notes |
|---|---|---|---|
| Low | ~140–260 | ~120–280k | no shadows, no SSAO/bloom, 0.75 resolution |
| High | ~620 | ~620k | 2 shadow-casting lights (2048²), N8AO, bloom, SMAA, outline |

FPS could not be measured: this VM has no GPU, so Chromium renders in software (SwiftShader) at 1–2 fps whatever the settings.
On a real GPU this budget is modest. Turn on **Settings → Graphics → Show FPS counter** to check it on your machine.

## 6. Bugs found by QA and fixed during M1
| Bug | Found by | Fix |
|---|---|---|
| Meshopt quantisation scale overwritten at runtime → giant spools | menu screenshot | `setRelScale()` keeps the authored node scale |
| GLB optimiser pruned empty rig/slot nodes | optimiser name check | `--prune false` + a verification step in `optimize_models.mjs` |
| `prism(axis='y')` built upside down → MK4 frame under the floor | asset preview | axis mapping fixed in `lib.py` |
| Blender `matrix_world` stale → rig empties reset to the origin | asset preview | `sync()` before parenting/joining |
| Laptop hitbox offset (mesh-node origin ≠ visual centre) | playthrough | world bounding-box centre |
| Closing the laptop with Esc also opened the pause menu | playthrough | input queue ignores keys pressed while UI is open |
| Furniture hitbox shadowed items on it (spools, parcel) | playthrough | interactable priorities within a 0.6 m depth window |
| React StrictMode double-attached spools → wrong spool colour | beauty shot | side effects moved from `useMemo` to `useEffect` |
| Delivery crates re-cloned every render | code review | memoised `CrateModel` |
| Audio loops created before the first click never started | code review | loops queued until the audio unlock |
| Finished parcel drawn over the open box at the packing station | playthrough | packing stage hidden on "done" |
| First tutorial print could fail (frustrating) | playthrough | tutorial grace: the first job never fails |
| Order spawning depended on frame rate (non-deterministic) | playthrough | per-minute events fire on whole-minute boundaries, separate failure RNG |
