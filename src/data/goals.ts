import type { SimState } from '../sim/types'

export interface Goal {
  id: string
  title: string
  hint: string
  /** Tutorial goals are shown one at a time, in order. */
  tutorial: boolean
  done: (s: SimState) => boolean
}

export const GOALS: Goal[] = [
  { id: 'read_mail', tutorial: true, title: 'Check your email', hint: 'Click the laptop on the desk (or the Laptop button below). Open Mail.', done: (s) => s.mail.some((m) => m.read) },
  { id: 'slice', tutorial: true, title: 'Slice the first order', hint: 'Open the laptop → Slicer, pick the order and save it to USB for the Endr-3.', done: (s) => s.orders.some((o) => o.status !== 'new' && o.status !== 'cancelled') },
  { id: 'start_usb', tutorial: true, title: 'Start the print at the printer', hint: 'Click the Endr-3 printer and choose "Start print from USB".', done: (s) => s.printers.some((p) => p.totalPrints > 0 || p.status === 'heating' || p.status === 'printing') },
  { id: 'wait', tutorial: true, title: 'Wait for the print to finish', hint: 'Use ▶▶ 8× on the toolbar to fast-forward. Keep an eye out for spaghetti!', done: (s) => s.items.some((i) => i.kind === 'print') },
  { id: 'remove', tutorial: true, title: 'Take the print off the bed', hint: 'Click the printer and choose "Remove print".', done: (s) => s.items.some((i) => i.kind === 'print' && i.loc.t !== 'bed') },
  { id: 'pack', tutorial: true, title: 'Pack the order', hint: 'Click the packing table to put the print down, then click it again to pack.', done: (s) => s.items.some((i) => i.kind === 'box') },
  { id: 'outbox', tutorial: true, title: 'Put the box in the Outbox', hint: 'Click the packing table to pick up the parcel, then click the OUTBOX shelf.', done: (s) => s.items.some((i) => i.kind === 'box' && (i.loc.t === 'outbox' || i.loc.t === 'gone')) },
  { id: 'ship', tutorial: true, title: 'Ship your first order', hint: 'The courier collects the Outbox at 17:00.', done: (s) => s.orders.some((o) => o.status === 'shipped') },
  { id: 'second_printer', tutorial: false, title: 'Buy a second printer', hint: 'Laptop → Shop → Printers.', done: (s) => s.printers.length >= 2 },
  { id: 'dry', tutorial: false, title: 'Dry a damp spool', hint: 'Click a spool, then the dryer on the fridge: put it in for a few hours.', done: (s) => s.spools.some((x) => x.loc.t === 'dryer' && x.moisture < 0.1) },
  { id: 'multicolour', tutorial: false, title: 'Ship a multicolour order', hint: 'Needs the A1 + AMS lite, the Snapmakr U1 or the Prusla XL.', done: (s) => s.orders.some((o) => o.status === 'shipped' && o.colors.length > 1) },
  { id: 'rep4', tutorial: false, title: 'Reach 4.0★ reputation', hint: 'Ship on time with good quality.', done: (s) => s.reputation >= 4 },
  { id: 'four_printers', tutorial: false, title: 'Run 4 printers', hint: 'More printers, more parallel jobs.', done: (s) => s.printers.length >= 4 },
  { id: 'ups', tutorial: false, title: 'Protect the farm with a UPS', hint: 'Power cuts happen. Shop → Upgrades.', done: (s) => s.upgrades.ups },
  { id: 'xl', tutorial: false, title: 'Get the big one: a Prusla XL', hint: 'The only printer for XL parts like the chest armour.', done: (s) => s.printers.some((p) => p.modelId === 'xl') },
  { id: 'money5k', tutorial: false, title: 'Save $5,000 for a rented unit', hint: 'The next location unlocks in a future update.', done: (s) => s.money >= 5000 },
]
