# UI/UX brief

## Style guide
- **Mood:** a modern, clean simulator UI (Supermarket Simulator / PC Building Simulator), glassy dark panels,
  one strong accent colour.
- **Tokens:** bg `#0d1014`, panel `rgba(18,22,28,.86)`, stroke `#2a313b`, text `#e8edf3`, muted `#8d98a6`,
  **accent `#ff7a1a`** (molten-filament orange), ok `#3ddc84`, warn `#ffc53d`, danger `#ff4d4f`, info `#4aa8ff`.
- **Type:** *Rajdhani* (display: headings, numbers, HUD), *Inter* (body), *JetBrains Mono* (printer screens, logs).
- **Motion:** 150–250 ms ease-out; panels slide and fade; money counts up; toasts slide in from the right.
- **Sound:** every button has hover and click sounds (AUDIO brief).

## Screens
1. **Boot/loading:** logo, an asset progress bar, rotating tips.
2. **Main menu:** a live 3D garage behind a slow camera drift; Continue · New Game · Settings · Credits.
3. **HUD (in game):**
   - Top left: **day and clock** (e.g. `TUE · DAY 3 · 14:25`), a fast-forward indicator, courier countdown.
   - Top right: **money** (animated on change), **reputation** stars.
   - Left: the **goals tracker** (tutorial/objectives with checkmarks).
   - Centre: crosshair dot → turns into a ring over interactables; **prompt** with key-cap glyphs; hold progress ring.
   - Bottom right: **held item** card; toasts (new email, print finished, failure!).
4. **Laptop "LayerOS":** a full-screen desktop that fades in when you use the laptop:
   - Taskbar: the app icons, clock, notifications.
   - **Mail:** inbox/thread view, reply choices as buttons, unread badges.
   - **Orders:** a table with status chips (New → Printing → Printed → Packed → Shipped), deadlines, filters.
   - **Slicer:** pick an order → printer → quality; a 3D preview of the model; time/grams/cost estimate; **Send** (Wi-Fi) or **Save to USB**.
   - **Farm:** printer cards (status, progress bar, ETA, filament loaded, alerts); live camera for the P1S.
   - **Shop:** suppliers for filament, boxes and printers; a cart; next-morning delivery.
   - **Bank:** balance, today's ledger, a 7-day chart.
5. **Printer screen menu (F on a printer):** a close-up overlay in the printer's own UI style: status, pause, resume, stop, unload/load filament.
6. **Packing station:** a step-by-step flow (QC → Box → Fill → Tape → Label), with the 3D box visible and big clear buttons.
7. **Pause menu:** Resume · Save · Settings · Main menu.
8. **Settings:** tabs for Graphics (preset, shadows, SSAO, bloom, resolution scale, FPS counter), Audio (master, music,
   sfx, ambience, UI), Controls (sensitivity, invert Y, FOV, head bob, key bindings), Gameplay (tutorial hints).
9. **End-of-day report:** shipped, revenue, costs breakdown, reputation delta, reviews; "Start day N+1".

## Acceptance criteria
- [ ] Every screen is reachable with the mouse; Esc always backs out one level.
- [ ] No text overflows at 1280×720 or at 1920×1080.
- [ ] Every UI action gives visual and audio feedback.
- [ ] Numbers use consistent formats ($1,234.50, 14:25, 2h 15m).
