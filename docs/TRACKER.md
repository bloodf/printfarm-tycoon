# Tracker

## M2: Running a real farm (see `docs/M2_PLAN.md`)
| ID | Task | Status | Evidence |
|---|---|---|---|
| M2-0 | Plan | ✅ | `docs/M2_PLAN.md` |
| M2-1 | Remove the avatar (pure Point & Click) | ✅ | Player/Interaction/HeldItem/colliders + FPS QA removed; cursor badge, End day; playthrough check "no avatar / first-person mode" |
| M2-2 | Sim v3 (slots, multi-tool, moisture/dryers, errors/wear/parts, incidents, UPS, save v2) | ✅ | `src/sim/sim.ts`, `src/data/{garage,errors,incidents}.ts`, save v1 → v2 migration |
| M2-3 | Unit tests for the new systems | ✅ | `npm test`: 36/36 (19 new) |
| M2-4 | New models: A1+AMS, U1, K1, XL, print table, XL cart, dryer, new products | ✅ | `docs/qa/assets/printer_{a1,u1,k1,xl}.png`, `filament_dryer.png` (remodelled after QA), `products_{keychains,chestplate}.png` |
| M2-5 | World integration (slots, AMS/toolheads, multicolour shader, dryers, lights-out, errors) | ✅ | `docs/qa/beauty/03`–`08`, `11`, `13` |
| M2-6 | UI (Slicer, Farm, popovers, dryer, Shop, Today strip, outages) | ✅ | `docs/qa/beauty/09`, `10`, `12`; `playthrough_click/05`, `06`, `12`, `14` |
| M2-7 | Audio (outage, dryer, AMS, toolchange, alarm, rain) | ✅ | `tools/audio/build_audio.py`, `docs/qa/audio_sheet.png` (no clipping, loop seams < 0.05); footsteps removed |
| M2-8 | Lightmap re-bake with the new layout | ✅ | `public/assets/lightmaps/` (new print table/XL cart contact shadows), lightmaps dim during outages |
| M2-9 | QA + zip | ✅ | `docs/qa/README.md` (M2 section: 11 issues found and fixed), `playthrough_click/results.json` 53/53, `../printfarm-tycoon-M2.zip` |

Known limits / next:
- Real-GPU frame rate not measured (no GPU in this VM). Render budget with 7 printers + 3 dryers (establishing view): High 1,652 draw calls / 1.79 M triangles (incl. 2 shadow passes), Low 584 / 0.64 M, vs ~620 on High in M1. Needs a check on a real GPU (Settings → Show FPS). Instancing/merging is planned for M4.
- Sounds are synthesised and have not been listened to by a human.
- Models are procedural (Blender scripts). They follow the real machines' proportions and details, but are not CAD-accurate.
- Balance (error rates, moisture rates, incident odds) comes from first-pass numbers. It needs playtesting and headless sim runs (M2b).

## M1.1: Look & Feel + Point & Click (change request from the M1 gate)
| ID | Task | Status | Evidence |
|---|---|---|---|
| R-0 | Change request, diagnosis, plan | ✅ | `docs/M1.1_CHANGE_REQUEST.md` |
| R-1 | Texture set v2: 2K, layered (concrete, painted block, OSB, plywood, butcher block, metals, powder coat, moulded plastic, rubber, cardboard) | ✅ | `tools/textures/build_textures.py`; OSB iterated twice after review |
| R-2 | Per-asset baked AO (second UV + glTF occlusion) for all GLBs | ✅ | `lib.bake_ao()`: printers 2K atlases, 24 props 1K each, spool. Boxes excluded (overlapping stage rigs) |
| R-3 | Baked indirect lightmaps for the garage shell (shared layout JSON Blender ↔ game) | ✅ | `tools/blender/bake_lightmaps.py`, `src/data/layout.json`, 9 lightmaps (200 samples) |
| R-4 | Set dressing: ≥8 new props + printer cables | ✅ | 10 new: OSB cladding, tool chest, wall shelf, floor mat, rug, broom, stepladder, box stack, mini-fridge + dryer, Benchy poster, bench clutter; power cables |
| R-5 | Printer detail pass: decals/stickers, PEI wear | ✅ | warning stickers, serial plates, worn PEI textures |
| R-6 | Engine weathering shader (breakup, floor grime, AO dirt) | ✅ | `src/world/weathering.ts` |
| R-7 | Lighting + grade: practicals, AgX, grain, DOF on UI focus | ✅ | desk lamp, P1S chamber light, AgX + grade + subtle grain, DOF on station close-ups, paint tint, new window view |
| R-8 | Point & Click: control mode setting + New Game choice + HUD toggle | ✅ | main menu, Settings → Controls, toolbar |
| R-9 | Point & Click: orbit/pan/zoom camera in the room, click-to-frame | ✅ | `src/world/ClickControls.tsx` |
| R-10 | Point & Click: mouse picking, cursor tooltip, action popover, timed hold buttons, held-item actions | ✅ | `src/ui/hud/ClickUi.tsx` |
| R-11 | HUD toolbar (laptop, time, camera, mode, menu) + mode-aware hints | ✅ | toolbar in both modes, `hintClick` in goals |
| R-12 | QA: before/after sheet, mouse-only playthrough, FPS playthrough, unit tests | ✅ | `docs/qa/before_after/comparison.jpg`, `docs/qa/playthrough_click/results.json`, `docs/qa/playthrough/results.json` |
| R-13 | M1.1 zip | ✅ | `../printfarm-tycoon-M1.1.zip` |
| R-14 | *(extra)* Retexture tool: swap textures in built GLBs without re-baking | ✅ | `tools/retexture.mjs`, `npm run assets:retexture` |
| R-15 | *(extra)* Boot "ready" latch (late texture loads blocked the first click) | ✅ | found by the mouse-only playthrough |

# M1: Garage vertical slice (approved with changes)

Status: ⬜ todo · 🟨 in progress · ✅ done (evidence linked) · ⏸ deferred (reason given)

## Production
| ID | Task | Status | Evidence |
|---|---|---|---|
| P-1 | Rewrite the plan: decisions, studio roles, gates | ✅ | `docs/PLAN.md` |
| P-2 | GDD with M1 numbers | ✅ | `docs/GDD.md` |
| P-3 | Briefs: ART, CONTROLS, UI, AUDIO | ✅ | `docs/specs/` |
| P-4 | M1 gate zip (without node_modules/dist) | ✅ | `../printfarm-tycoon-M1.zip` |

## ART
| ID | Task | Status | Evidence |
|---|---|---|---|
| A-1 | Blender 5 headless pipeline (bpy), shared helpers, preview renderer, GLB optimiser with node-name verification | ✅ | `tools/blender/lib.py`, `tools/optimize_models.mjs` (46 MB → 12 MB, all rig nodes verified) |
| A-2 | Procedural PBR textures (10 sets) + decals | ✅ | `docs/qa/assets/textures_sheet.jpg` |
| A-3 | Printer: Ender-3 V3 SE reference model + rig | ✅ | `docs/qa/assets/printer_ender3v3.png`, `docs/qa/beauty/02_workbench.jpg` |
| A-4 | Printer: Prusa MK4 reference model + rig | ✅ | `docs/qa/assets/printer_mk4.png`, `docs/qa/beauty/04_mk4_closeup.jpg` |
| A-5 | Printer: Bambu P1S reference model + rig (door, CoreXY, Z-bed) | ✅ | `docs/qa/assets/printer_p1s.png`, `printer_p1s_open.png`, `docs/qa/beauty/03_p1s_closeup.jpg` |
| A-6 | Garage environment | ✅ | `docs/qa/beauty/01_establishing.jpg` |
| A-7 | Furniture and props (14) | ✅ | `docs/qa/assets/props.png`, beauty shots |
| A-8 | Print products ×9 | ✅ | `docs/qa/assets/products_sheet.png` |
| A-9 | Spool, boxes (packing-stage rigs), supplies | ✅ | `docs/qa/assets/spool.png`, `boxes.png` |

## AUDIO
| ID | Task | Status | Evidence |
|---|---|---|---|
| S-1 | Synth toolkit + build script + peak/loop checks | ✅ | `tools/audio/build_audio.py` (no clipping, loop seams < 0.05) |
| S-2 | Full M1 sound list (33 files, 860 KB) | ✅ | `docs/qa/audio_sheet.png` (spectrograms) |
| S-3 | Runtime mixer (4 buses), 3D HRTF printer audio, radio, loops deferred until audio unlock | ✅ | `src/game/audio.ts`, playthrough check "audio mixer running" |

## CONTROLS
| ID | Task | Status | Evidence |
|---|---|---|---|
| C-1 | First-person controller, collisions, head bob, crouch, sprint, FOV kick, footsteps | ✅ | `src/world/Player.tsx` |
| C-2 | Interaction raycast with priorities, outline, prompts, hold actions (cancel on look-away/release) | ✅ | `src/world/Interaction.tsx`, playthrough checks |
| C-3 | Carry system (spools, prints, parcels, drop to floor) | ✅ | playthrough `17_holding_print`, `24_holding_parcel` |
| C-4 | Rebindable input + settings persistence, drag-to-look fallback | ✅ | Settings → Controls |

## GAMEPLAY
| ID | Task | Status | Evidence |
|---|---|---|---|
| G-1 | Sim v2: clock, day cycle, printers, filament, jobs | ✅ | `src/sim/sim.ts`, 17 unit tests |
| G-2 | Orders, emails with replies, counter-offers, reputation, reviews, complaints, refunds | ✅ | unit tests |
| G-3 | Failures: spaghetti, runout, clog, layer shift, warp | ✅ | unit tests, `docs/qa/beauty/05_ender_spaghetti.jpg` |
| G-4 | Packing, outbox, courier, supplies shop, deliveries | ✅ | playthrough |
| G-5 | Tutorial goals, end-of-day report, save/load (autosave) | ✅ | playthrough `day_report`, `autosave written` |

## UI
| ID | Task | Status | Evidence |
|---|---|---|---|
| U-1 | Design system (tokens, fonts, components) | ✅ | `src/ui/styles/`, `src/ui/components/ui.tsx` |
| U-2 | Loading, main menu, pause, settings, credits | ✅ | playthrough `01_boot`, `02_menu` |
| U-3 | HUD: clock, courier countdown, money (animated), rep, goals, prompts, hold ring, toasts, held item, FPS | ✅ | playthrough shots |
| U-4 | LayerOS laptop: Mail, Orders, Slicer (3D layer preview), Farm (live camera), Shop, Bank | ✅ | playthrough `05`–`12`, `docs/qa/beauty/09_farm_live_cam.jpg` |
| U-5 | Printer screen menu, packing station (6 steps), end-of-day report | ✅ | playthrough `15`, `18`–`23`, `27` |

## WORLD / RENDERING
| ID | Task | Status | Evidence |
|---|---|---|---|
| W-1 | Level assembly, lighting (rect battens, spot, time-of-day sun), env map, post-FX (N8AO, bloom, ACES, SMAA, outline), quality presets | ✅ | beauty shots |
| W-2 | Printer rig animation (toolpaths), print reveal shader (layer lines, hot layer, layer shift), spaghetti growth, live screens, filament strand | ✅ | beauty shots |

## QA
| ID | Task | Status | Evidence |
|---|---|---|---|
| Q-1 | Sim unit tests | ✅ | `npm test`: 17/17 |
| Q-2 | Scripted playthrough with screenshots | ✅ | `tools/qa/playthrough.py`, `docs/qa/playthrough/results.json` |
| Q-3 | Performance check | 🟨 | Render budget measured (see QA report). Real-GPU FPS can't be measured here (no GPU in this VM): needs your machine, with Settings → Show FPS |

## Known issues / next (goes to the M2 backlog after the gate review)
- FPS has only been measured with software rendering (no GPU available here). To confirm on a real GPU, enable **Settings → Show FPS counter**.
- Static-mesh merging (fewer draw calls) and instancing belong to the M4 performance work.
- No first-person hands yet; held items float in front of the camera (common in the genre, but hands are planned).
- Models and sounds are generated by code, which is good for iteration. For a true "AAA" finish, the next step is hand-tuned
  hero assets (or scanned materials) using the same file names and rig contract, so nothing in the code changes.
