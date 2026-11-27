# CONTROLS brief

**M2 decision D11: there is no avatar.** You never see your character and there is no first-person walking mode any
more. The player is a camera in the garage that works with the mouse alone (M1.1's Point & Click is now the only
control scheme). The M1 first-person controller, its collision and its pointer-lock code were removed in M2-1.

## Mouse (everything can be done with the mouse only)
| Input | Action |
|---|---|
| Left-drag / right-drag | Orbit the view around the current focus point |
| Middle-drag or Shift + drag | Pan |
| Mouse wheel | Zoom (0.7–6 m) |
| Double-click the floor | Move the focus point there |
| Hover an object | Outline + tooltip (name, state, main action) |
| Click an object | Action popover with the object's actions; the camera glides to frame it |
| Timed actions | Buttons with a progress ring (remove print 1.1 s, scrape spaghetti 2.2 s, fix errors 4–10 s, cold pull 4 s…) |
| Carried item badge → Drop | Put the item on the floor |
| Toolbar | Laptop · Pause · 1× · 8× · Reset view · End day · Menu |

## Keyboard (optional, rebindable in Settings → Controls)
| Action | Default |
|---|---|
| Pan camera | W A S D |
| Drop carried item | G |
| Fast-forward time (×8) | T |
| Pause menu / close the popover | Esc |
| Quick save | F5 |

## Rules
- The camera stays inside the garage (clamped to the walls and between 0.35 m and the ceiling).
- Only one carried item at a time (spool, print, parcel). It is shown as a badge next to the cursor and in the HUD.
- When a UI opens (laptop, packing station, printer screen) the camera eases into a close-up pose for that station
  (printers are framed from the direction they face, using `runtime.printerFacing`).
- FOV 55° by default (40–80 in Settings).

## Acceptance criteria
- [x] A full day (and the M2 systems: drying, fixing an error, outages) can be played with **zero key presses**:
  `npm run test:e2e` (`tools/qa/playthrough_click.py`) counts keydown events.
- [x] Every interactable shows the right actions for its current state (printers with errors, empty AMS slots,
  dryers, maintenance).
- [x] Timed actions can be cancelled by closing the popover.
- [x] Rebinding a key persists after a reload.
- [x] No pointer lock anywhere.
