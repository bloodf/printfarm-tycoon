# AUDIO brief

All sounds are **synthesised by code** (`tools/audio/build_audio.py`, numpy/scipy → ffmpeg → `.ogg`) and can be
replaced later by recorded files with the same names. Loudness: SFX peaks ≤ −1 dBFS, loops seamless.

## Mixer buses
`master` → `music`, `sfx`, `ambience`, `ui`. All are adjustable in Settings. Printer sounds are **3D positional**
(they get louder as you walk towards them).

## Sound list (M1)
| File | Type | Description |
|---|---|---|
| `printer_steppers_loop` | 3D loop | Stepper-motor "singing", the characteristic whine of a printer (several pitch voices, randomised moves) |
| `printer_fan_loop` | 3D loop | Hotend and part-cooling fan hiss |
| `printer_home` | 3D one-shot | Homing buzz plus the end-stop click |
| `printer_done` | 3D one-shot | A 3-tone completion melody |
| `printer_alarm` | 3D one-shot | A repeating error beep (runout/failure) |
| `bed_flex_pop` | 3D one-shot | A print popping off the flexed steel sheet |
| `spaghetti_rip` | 3D one-shot | Crackly plastic tearing |
| `spool_swap` | 3D one-shot | A plastic spool clack and rattle |
| `footstep_concrete_1..4` | one-shot | Shoe steps on concrete |
| `box_fold`, `tape_rip`, `paper_crinkle`, `label_print` | one-shot | Packing station |
| `box_place`, `item_pickup`, `item_place` | one-shot | Handling |
| `door_open`, `garage_rumble` | one-shot | Doors |
| `courier_van` | one-shot | A van arrives, honks, the door slams |
| `ui_hover`, `ui_click`, `ui_back`, `ui_toggle` | UI | Crisp, short |
| `notif_mail`, `notif_order`, `cash` | UI | Soft chime, bright ping, cash register |
| `laptop_open` | UI | A soft whoosh |
| `room_tone_loop` | ambience | Garage room tone, faint fridge hum, far-away traffic |
| `music_lofi_loop` | music | A mellow lo-fi loop from the radio (3D, can be turned off) |

## Acceptance criteria
- [ ] No clicks at loop points (crossfaded loops).
- [ ] No clipping (peak check in the build script log).
- [ ] The volume sliders work on every bus, live.
- [ ] Printer sounds get quieter with distance, and stop when the printer is idle.
