# M2 plan: "Running a real farm": more printers, filament care, breakdowns, daily incidents

**Director request (after M1.1):**
> "We will never see our character, so we can remove the human avatar. We need more printers: Bambu A1 with AMS,
> Snapmaker U1, Creality K1, Prusa XL. We need to put filament to dry, have printers giving errors and problems,
> and daily problems like lights out, no internet and so on."

Decisions:
- **D11: no avatar.** The game is pure Point & Click (you are the farm manager's hands and eyes). First-person mode,
  WASD walking, footsteps, head bob, colliders and the floating held item are removed. The carried item shows as a
  cursor badge plus a HUD card. "Go to bed" becomes **End day** (toolbar + house door).
- **D12: garage capacity by size class.** Printers have a footprint class: **M** (fits any slot), **L** (needs a wide
  slot), **XL** (needs the floor cart). Garage: back bench 4 × M, new island print table 3 × L, XL cart 1 × XL = 8 printers.

---

## 1. New printers (modelled after the real machines, parody names as per D3)

| Id | In-game name | Real reference | Price | Speed× | Fail % | Tools | Build (mm) | Size | Notes |
|---|---|---|---|---|---|---|---|---|---|
| `a1` | Bamboo Lab A1 + AMS lite | Bambu Lab A1 Combo | $559 | 0.60 | 5 | 4 (AMS) | 256³ | L | Cantilever bed-slinger, camera, AMS lite beside it; colour changes purge (time + waste) |
| `u1` | Snapmakr U1 | Snapmaker U1 | $999 | 0.65 | 6 | 4 (toolchanger) | 270³ | L | 4 parked toolheads, fast swaps, almost no purge waste |
| `k1` | Kreality K1 | Creality K1 | $399 | 0.55 | 9 | 1 | 220³ | M | Enclosed CoreXY, fast but temperamental |
| `xl` | Prusla XL 5T | Prusa XL 5-toolhead | $3,499 | 0.85 | 3 | 5 (toolchanger) | 360³ | XL | Huge and reliable; the only machine for XL parts |

Existing: Endr-3 (USB only, **no power-loss recovery**), MK4, P1S. Every printer except the Endr-3 has power-loss recovery.

**Multicolour orders** (new products): Multicolour Benchy (3 colours), Logo Keychains ×20 (2), Rainbow Dragon (4), plus
an XL-only **Cosplay Chest Armor** (900 g, 18 h, needs 340 mm). The Slicer checks the tool count and build size.
AMS colour changes add +25% time and 15 g of purge per extra colour; toolchangers add +5% and 2 g.

## 2. Filament moisture and drying
- Spools arrive **sealed** (vacuum bag). They open on the first load and then absorb moisture every hour:
  PLA 0.4%/h, ABS 0.6%/h, PETG 0.8%/h, TPU 1.5%/h (× the day's humidity).
- Effects at print start: moisture > 30% → +failure chance; > 35% → grade capped at **B**; > 60% → grade **C** with
  *stringing*, and more clogs.
- **Filament dryer** (2 spools, 55 °C): −12%/h. One dryer on the fridge; buy up to 2 more (on the tool chest and the wall shelf).
- The UI shows moisture everywhere: spool tooltip, Slicer warnings, Farm cards, the dryer's screen.

## 3. Breakdowns, errors and maintenance
Random **errors** during jobs (chance scales with the printer's reliability and wear):

| Code | Error | Printers | Effect | Fix (click the printer) |
|---|---|---|---|---|
| E101 | Thermal runaway | all | job aborted | Reseat the thermistor (6 s) |
| E102 | Heatbed fault | all | job aborted | Check the bed connector (5 s) |
| E201 | AMS filament tangle | A1 | paused | Untangle the AMS (8 s) → resume |
| E202 | Toolchange failed | U1, XL | paused | Recalibrate the tool offsets (10 s) → resume |
| E301 | MCU / firmware crash | all | job aborted | Power-cycle (4 s) |
| E302 | Part-cooling fan failure | all | paused | Replace the fan (**needs a spare fan**) → resume |

**Wear:** nozzle (worn after 250 print-hours → grade cap B, more clogs → *replace nozzle*, uses a spare nozzle);
belts (400 h → more layer shifts → *tension belts*); build plate (dirty after 8 prints → more spaghetti → *clean with IPA*).
Spare parts and consumables: nozzles, fans, IPA, all from the Shop.

## 4. Daily incidents (from day 2; 0–2 per day, announced or surprise)
| Incident | Effect | Counter-play |
|---|---|---|
| ⚡ **Power outage** (1–3 h, surprise) | **Lights go out.** Printers stop; on return, printers with power-loss recovery resume, the others fail; dryers stop | Buy a **UPS** (rides through the first 60 min) |
| 📶 **Internet outage** (2–6 h) | No new orders or emails (they arrive later); Wi-Fi jobs can't be sent; Shop offline; Farm cameras offline | Print from **USB** (every printer accepts USB during an outage) |
| 💧 **Humid day** | Moisture gain ×3 | Dry spools, keep the dryers busy |
| 🌡 **Heat wave** | Clogs ×2 | Maintenance, slower prints |
| 🚚 **Courier late** | Pickup at 19:00 | More time to pack |
| 📦 **Supplier delay** | Today's deliveries arrive a day late | Keep stock |
| 🔥 **Viral product** | One product ×5 demand, +20% price | Print it! |
| ⬆ **Firmware update** | A Wi-Fi printer asks to update (15 min); skipping → +5% errors | Update when it's idle |

The HUD gets a **"Today"** strip (conditions + active outages). During a power outage the real-time lights and printer
screens go dark; only daylight from the window and the screens of printers on the UPS stay on.

## 5. Production tasks
| ID | Workstream | Task |
|---|---|---|
| M2-1 | Controls/UI | Remove the avatar: FPS mode, player controller, colliders, footsteps, floating held item → cursor badge; End-day button |
| M2-2 | Gameplay | Sim v3: slot classes, multi-tool printers + multicolour jobs, moisture + dryers, errors + wear + parts, incidents, UPS, save v2 migration |
| M2-3 | Gameplay | Unit tests for every new system |
| M2-4 | Art | Blender: A1 + AMS lite, U1, K1, XL 5T; print table, XL cart, filament dryer prop; keychain + chest-armor products; AO bakes |
| M2-5 | World | Slots/benches, multi-spool + AMS rendering, toolheads, multicolour print shader, dryers, lights-out, error LEDs/screens |
| M2-6 | UI | Slicer (tools, colours, build size, moisture), Farm (tools, errors, offline), printer popovers (fixes, maintenance, tools), dryer popover, Shop (new printers, parts & upgrades), Today strip, outage banners |
| M2-7 | Audio | Power down/up, dryer hum, AMS feed, toolchange clack, error alarm, rain for humid days |
| M2-8 | Art | Re-bake the garage lightmaps with the new layout |
| M2-9 | QA | Mouse-only playthrough v2 (drying, an error fix, a power outage, multicolour), beauty shots of the new printers, zip |
