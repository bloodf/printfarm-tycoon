# Game Design Document: PrintFarm Tycoon

## 1. Fantasy
You quit your job to run a 3D-print business. You start with **one cheap printer in your
garage**. Customers are never seen: they exist as **web-shop orders and emails** on your
laptop. You print, fight failures, pack, ship and grow, eventually into a warehouse full of
humming machines.

## 2. Core loop (M1: garage)
```
Laptop: Orders / Mail ──► Slicer (pick order, printer, quality) ──► Printer
   ▲                                                                  │ prints (time, failures)
   │                                                                  ▼
 Money, reviews, reputation ◄── Courier 17:00 ◄── Outbox ◄── Pack ◄── Remove print (timed click)
   │
   └──► Shop app: buy filament, boxes, printers (delivered next morning)
```

## 3. Time
- The day runs from **08:00 to 23:00**. **1 real second = 1 game minute** (a full day ≈ 15 real minutes).
- **Fast-forward** (`T`): ×8 while held/toggled. It is disabled while a UI that needs attention is open.
- The **courier** collects the Outbox at **17:00** every day.
- **End day** (toolbar or house door, after 17:00, or forced at 23:00) skips to 08:00 the next day. Printers keep
  running overnight, and failures overnight are a real risk.
- **End-of-day report:** shipped orders, revenue, costs, reputation, reviews. The game autosaves here.

## 4. Printers (modelled on real machines, see ART.md)

| Id | In-game name | Real reference | Price | Speed × | Base fail % | Link | Enclosed | Build vol. (mm) |
|---|---|---|---|---|---|---|---|---|
| `ender3v3` | Kreality Endr-3 V3 SE | Creality Ender-3 V3 SE | $199 | 1.35 | 12 | **USB only** | no | 220×220×250 |
| `mk4` | Prusla MK4 | Prusa MK4 | $1,099 | 1.00 | 4 | Wi-Fi | no | 250×210×220 |
| `p1s` | Bamboo Lab P1S | Bambu Lab P1S | $699 | 0.55 | 6 | Wi-Fi + camera | yes | 256×256×256 |

- **USB printers:** the slicer writes the job to USB. You click the printer → **Start print from USB**.
- **Wi-Fi printers** start straight from the slicer, but only if the bed is clear and the right filament is loaded.
- **Camera:** the Farm app shows a live view (P1S only).
- Starting state: **one Endr-3**, $400, 3.0★ reputation. The garage has **4 printer slots** on the workbench.

## 5. Filament
- 1 kg spools: PLA $20, PETG $23, ABS $22, TPU $32. Colours: Black, White, Grey, Red, Blue, Orange, Green, Yellow.
- Each printer has one **loaded spool** (material, colour, grams left). You swap spools by hand:
  click the printer → **Unload** (the spool goes into your hands) → click the shelf to store it → click another spool → click the printer → **Load**.
- ABS on an open printer gives a +25% warp-failure chance.

## 6. Products (web shop "LayerGoods")

| Product | g | Hours* | Price | Box |
|---|---|---|---|---|
| Benchy Boat | 15 | 1.0 | $9 | S |
| Cable Clips ×10 | 12 | 0.8 | $7 | S |
| Phone Stand | 35 | 1.5 | $12 | S |
| Fidget Gear | 25 | 1.5 | $14 | S |
| Spiral Vase | 80 | 3.0 | $24 | M |
| Articulated Dragon | 60 | 4.0 | $29 | M |
| Suzanne Bust | 90 | 4.0 | $27 | M |
| Hex Planter | 110 | 5.0 | $32 | M |
| Cosplay Helmet | 300 | 10.0 | $85 | L |

\*On the reference printer (MK4) at Standard quality.

**Slicer quality profiles:** Draft (0.7× time, +4% fail, max grade B), Standard (1×), Fine (1.5× time, −2% fail, grade A+ possible).

## 7. Orders
- Shop orders arrive during the day: about `3 + reputation × 1.2` per day. Each one has a product, material,
  colour, price and **ship-by day**.
- **Email requests** (custom work) need a reply: *Accept quote / Counter-offer / Decline*.
- Late shipping → reputation penalty, and possibly a refund request email.

## 8. Failures

| Failure | Cause | What you see | Fix |
|---|---|---|---|
| Spaghetti | Bed adhesion | A tangle of filament grows; the printer keeps going | Click the printer → Scrape off the failed print (timed) |
| Filament runout | Spool empty | The printer pauses and beeps | Load the same material/colour → Resume |
| Nozzle clog | Random/maintenance | The head moves but nothing comes out | Click the printer → Cold pull (4 s), then reprint |
| Layer shift | Random | The print finishes with a visible offset | QC at packing: ship anyway (bad review) or scrap |
| Warping | ABS on an open printer | The corners lift, then it turns into spaghetti | As spaghetti |

The base fail % comes from the printer, then is adjusted for quality and material. The failure **type** is weighted.

## 9. Packing and shipping
1. Carry the print to the **packing table** → click → Place.
2. **Packing station** (click the table → Use packing station): QC inspect → choose a box (S/M/L; too small is impossible) → add paper fill → tape → print the label.
3. Carry the box to the **Outbox shelf** by the garage door. The courier collects it at 17:00.
4. Payment when shipped: the price minus a 5% platform fee, minus the label (S $4 / M $6 / L $9).

## 10. Economy (daily)
- Electricity: $0.05 per printer-hour of printing.
- Supplies: boxes S/M/L ($0.60/$0.90/$1.50 each, sold in packs of 10), paper fill (a roll covers 20 packs, $8).
- Deliveries from the Shop app arrive **next morning at 08:30** at the garage door.

## 11. Reputation and reviews
- 0–5★, starting at 3.0. Each shipped order produces a review the next day:
  on time + grade A/B → 4–5★; late → −1★; a defect shipped → 1–2★.
- Reputation drives the order rate and unlocks B2B requests (M2).

## 12. Tutorial goals (M1)
1. Read your email on the laptop
2. Slice the first order and send it to the Endr-3
3. Start the print from USB at the printer
4. Wait for it (tip: `T` fast-forward)
5. Remove the print from the bed
6. Pack it at the packing station
7. Put the box on the Outbox shelf before 17:00
8. *Long-term:* buy a second printer · have 4 printers · earn $5,000 (the unit unlocks in M3)


## 13. M2 additions (details and numbers: [`M2_PLAN.md`](M2_PLAN.md); data in `src/data/`)
- **No avatar** (D11): the player is a camera. All actions are clicks, and timed actions are progress-ring buttons.
- **Printers** (`printers.ts`): + Bamboo Lab A1 + AMS lite ($559, 4 colours, L), Snapmakr U1 ($999, 4-tool
  toolchanger, L), Kreality K1 ($399, enclosed CoreXY, M), Prusla XL 5T ($3,499, 5 tools, 360 mm, XL).
  Garage slots (`garage.ts`): bench A0–A3 (M), print table B0–B2 (L), XL cart X0 (XL).
- **Multicolour** products: Multicolour Benchy (3), Logo Keychains ×20 (2), Rainbow Dragon (4). Cosplay Chest Armor
  needs a 340 mm build (XL only). AMS: +25% time and 15 g purge per extra colour; toolchanger: +5% and 2 g.
- **Moisture** (`filaments.ts`): sealed spools don't absorb. Open ones gain PLA 0.4 %/h … TPU 1.5 %/h (×3 on humid
  days). Over 30% adds failure chance, over 35% caps the grade at B, over 60% gives C + stringing. Dryer: 2 spools, −12 %/h, max 3 dryers.
- **Errors** (`errors.ts`): E101/E102/E301 abort the job; E201 (AMS), E202 (toolchanger) and E302 (fan, needs a
  spare part) pause it until fixed. **Wear:** nozzle 250 h, belts 400 h, plate 8 prints → maintenance actions.
- **Incidents** (`incidents.ts`, from day 2, at most 2 a day): power outage (UPS bridges 60 min; printers without
  power-loss recovery lose the print), internet outage (orders queue up, Shop offline, USB only), humid day, heat
  wave, courier late (19:00), supplier delay, viral product, firmware update.
- **Save v2** (`SAVE_VERSION 2`) with automatic migration of M1 saves.
