import type { SizeClass } from './printers'
import layout from './layout.json'

/** Printer slots in the garage (decision D12). `prop` + `node` locate the slot in the level. */
export interface SlotDef {
  id: string
  prop: string
  node: string
  size: SizeClass
}

export const SLOTS: SlotDef[] = [
  ...[0, 1, 2, 3].map((i) => ({ id: `A${i}`, prop: 'workbench', node: `Slot_${i}`, size: 'm' as const })),
  ...[0, 1, 2].map((i) => ({ id: `B${i}`, prop: 'print_table', node: `Slot_${i}`, size: 'l' as const })),
  { id: 'X0', prop: 'xl_cart', node: 'Slot_0', size: 'xl' as const },
]

const RANK: Record<SizeClass, number> = { m: 0, l: 1, xl: 2 }
/** Can a printer of size `p` stand in a slot of size `slot`? (XL only fits the XL cart.) */
export const fits = (p: SizeClass, slot: SizeClass) => (p === 'xl' ? slot === 'xl' : RANK[slot] >= RANK[p] && slot !== 'xl')

/** Where filament dryers stand: [x, y, z, rotY] (three.js). Index 0 is the one you start with. */
export const DRYER_SPOTS = layout.dryerSpots as [number, number, number, number][]
export const MAX_DRYERS = DRYER_SPOTS.length
