# ART brief: look, reference sheets, asset list

## 1. Art direction
- **Grounded realism.** Real-world scale (metres), real materials, real printer designs. Think
  *PowerWash Simulator* / *Supermarket Simulator* cleanliness, with more surface detail.
- **Lighting does the heavy lifting:** cool LED battens overhead, warm daylight from the
  window, a live reflection probe of the room, SSAO, subtle bloom on LEDs and screens, AgX tone mapping.
- **Every edge is bevelled** (real objects never have razor-sharp edges; that is what makes CG look fake).
- **Detail density:** screws, cables, vents, labels and decals. No bare boxes.
- **Palette:** a neutral grey/concrete environment, so the colourful filament and prints stand out.

## 1b. Art direction v2 (M1.1 "Look & Feel")
- **Lived-in maker garage**, not a showroom: OSB cladding, clutter, cables, a tool chest, paint cans, mats, a fridge with magnets.
- **Baked light:** Cycles indirect lightmaps for the room shell + baked AO for every asset (decision D10).
- **Layered materials:** texture set v2 (2K): concrete slab (aggregate, trowel swirls, cracks, oil drips), painted CMU with
  pores and scuffs, OSB, plywood, butcher block, scratched metal, powder coat, moulded plastic, rubber, worn PEI.
- **Engine weathering** on every material: smudges, dust, floor grime, AO dirt, macro variation (`src/world/weathering.ts`).
- **Film response:** AgX tone mapping, gentle contrast, subtle grain, depth of field on station close-ups.
- **Machine details:** warning stickers, serial plates, power cables to the wall outlets, a P1S chamber light.

## 2. Technical rules
| Rule | Value |
|---|---|
| Units | 1 Blender unit = 1 m, Z-up in Blender → Y-up glTF |
| Format | GLB, no Draco (fast local decode), textures embedded (JPG) or shared |
| Triangle budget | Printer ≤ 80k, large prop ≤ 15k, small prop ≤ 3k, print product ≤ 20k |
| Materials | Principled BSDF only (exports to glTF PBR): base colour, metallic, roughness, normal, emission, transmission |
| Names | Material names are stable: the game recolours `Filament`, drives `Screen`, `LED` |
| Pivot | At the bottom centre of the footprint, unless it is a rig node |
| QA | Every asset gets a Cycles preview render in `docs/qa/assets/` |

## 3. Printer rig contract (the game drives these named nodes)
| Node | Type | Meaning |
|---|---|---|
| `Bed` | group | Moves along **Y** (bed-slinger) or **Z down** (CoreXY) |
| `PrintOrigin` | empty (child of Bed) | Centre of the build surface; prints are spawned here |
| `GantryZ` | group | Bed-slingers: X-axis assembly moving up in Z |
| `GantryY` | group | CoreXY: X-rod assembly moving along Y |
| `CarriageX` | group | The toolhead carriage, moving along X |
| `Nozzle` | empty | The nozzle tip (source of the spaghetti) |
| `SpoolMount` | empty | Where the loaded spool is attached |
| `Screen` | mesh, material `Screen` | The game paints the live printer UI onto it |
| `Door` | group (P1S) | Pivot at the hinge |
| `StatusLED` | mesh, material `LED` | Status colour |
| root extras | `travel_x/y/z`, `bed_size` | Motion limits (metres) |

## 4. Reference sheets: printers

### 4.1 `ender3v3`: Creality Ender-3 V3 SE → "Kreality Endr-3 V3 SE"
- **Size:** 349 W × 364 D × 490 H mm. Build 220×220×250.
- **Base:** a low dark-graphite housing (≈ 349×364×~75 mm) with the PSU inside, vent slots and 4 rubber feet.
- **Y-axis:** a bed-slinger on **dual 8 mm linear rods**; the heated bed carries a **textured PEI spring-steel sheet** (black/gold speckle).
- **Frame:** two vertical **2040 V-slot** extrusions (dark anodised), a 2020 top bar; **dual Z lead screws** with motors at the bottom.
- **X-axis:** an extrusion with belt; the **"Sprite" direct-drive toolhead** (dark body, front fan cover with logo, side part-cooling duct).
- **UI:** a 3.2" colour screen with a rotary knob, angled, mounted at the **right front** of the base.
- **Extras:** a spool holder on top of the frame, a runout sensor, a ribbon cable to the toolhead, a drag chain on Y.

### 4.2 `mk4`: Prusa MK4 → "Prusla MK4"
- **Size:** ≈ 500 W × 550 D × 400 H mm (frame). Build 250×210×220.
- **Y-frame:** aluminium extrusions forming the base; 8 mm smooth rods; **heatbed** with a **magnetic spring-steel
  sheet** (satin/textured PEI, bronze-gold), the front tab with the Prusa-style notch.
- **Frame:** a single **black** upright metal frame with a large rectangular opening; **orange printed parts**
  (X-ends, motor mounts, cable covers); **Z lead screws** both sides.
- **X-axis:** two smooth rods; the **Nextruder** (black body, orange face plate, fan on the side).
- **UI:** a 3.5" LCD module at the **front left**, in an angled black housing, with an **orange knob**.
- **Extras:** the xBuddy electronics box on the right of the frame, a PSU at the back, a spool holder on top of the frame, textile cable sleeves.

### 4.3 `p1s`: Bambu Lab P1S → "Bamboo Lab P1S"
- **Size:** 389 W × 389 D × 458 H mm. Build 256×256×256.
- **Enclosure:** dark-grey shell, rounded vertical edges; a **transparent front glass door** with a vertical handle,
  hinged on the left; a **removable glass top lid**.
- **Front:** a small display (2.7") with buttons at the top left of the front bezel; a status LED strip.
- **Inside:** **CoreXY**: Y carbon rods at the left and right top, an X carbon rod across; the toolhead (light-grey front
  cover); a **textured PEI plate** (gold) on a heatbed that **moves down in Z** on 3 lead screws;
  an aux fan grille on the left wall; an LED bar on the ceiling; the chamber-exhaust vent at the back.
- **Back:** the spool holder on the rear panel; a PTFE tube entering the top back.

## 5. Asset list (M1)

### Printers
`printer_ender3v3.glb`, `printer_mk4.glb`, `printer_p1s.glb`

### Environment (`garage.glb`)
Shell 6.0 × 6.5 × 2.7 m · polished concrete floor with saw-cut joints · painted block walls ·
**4-panel sectional garage door** (top windows) · house door · window · 2 LED battens · garage-door opener
and rail · electrical panel · outlets and switches · skirting · ceiling.

### Furniture and props
| Asset | Notes |
|---|---|
| `workbench` | 2.4 × 0.75 × 0.9 m, steel frame, butcher-block top, lower shelf. 4 printer slots |
| `shelf_boltless` | 1.2 × 0.45 × 1.8 m, filament storage |
| `desk` + `office_chair` + `laptop` | Laptop screen material `Screen` |
| `packing_table` | 1.6 × 0.8 m, with a tape dispenser, paper-roll holder, label printer and scale |
| `outbox_shelf` | Wire shelf with an "OUTBOX" sign |
| `pegboard_tools` | Pliers, scraper, hex keys, flush cutters |
| `trash_bin`, `fire_extinguisher`, `wall_clock`, `radio`, `storage_bins`, `poster` | Set dressing |
| `spool` | 200 mm Ø × 68 mm, cardboard/plastic reel; material `Filament` recoloured at runtime |
| `box_s/m/l` | Open / taped / labelled variants |
| `box_flat_stack`, `paper_roll`, `delivery_box` | Supplies |

### Print products (real size, material `Filament`)
Benchy boat · cable clips · phone stand · fidget gear · spiral vase · articulated dragon · Suzanne bust · hex planter · cosplay helmet.
Printed look in the game: a layer-line shader, progressive layer-by-layer reveal, a hot top layer.

### Textures (procedural, `tools/textures`)
Concrete floor · painted block wall · butcher block · cardboard · textured PEI · carbon fibre · brushed
aluminium · powder coat · drywall ceiling · kraft paper · label decals.
