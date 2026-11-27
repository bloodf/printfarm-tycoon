/**
 * PrintFarm Tycoon: pure game simulation (no React, no Three.js). Version 3 (M2).
 * All functions mutate the given state in place and return an ActionResult where relevant.
 * Deterministic for a given seed + action sequence → unit-testable and save-friendly.
 *
 * Systems: day cycle · shop orders & email requests · printers (slots by size class, multi-tool/AMS/toolchanger,
 * multicolour jobs) · print failures · machine errors + fixes + spare parts · wear & maintenance · filament moisture &
 * dryers · packing/outbox/courier · shop & deliveries (incl. upgrades) · daily incidents (power/internet outages,
 * humidity, heat, late courier, supplier delay, viral product, firmware update) · reviews & reputation · goals.
 */
import { COLOR_DEMAND, COLORS, MATERIALS, MOISTURE, SPOOL_GRAMS, type ColorId, type Material } from '../data/filaments'
import { BOX_SIZES, PRODUCTS, PRODUCT_LIST, boxFits, type BoxSize, type ProductId } from '../data/products'
import { PRINTERS, type PrinterModelId, type SizeClass } from '../data/printers'
import {
  COURIER_TIME, DAY_FORCED_END, DAY_START, DELIVERY_TIME, ELECTRICITY_PER_KWH, HEAT_MINUTES, OUTBOX_SLOTS,
  PLATFORM_FEE, QUALITY, SHELF_SPOOL_SLOTS, SHOP_CLOSE, SHOP_OPEN, SLEEP_ALLOWED, START_MONEY, START_REPUTATION,
  SUPPLIES, UPGRADES, type QualityId, type SupplyId, type UpgradeId,
} from '../data/economy'
import { CITIES, FIRST_NAMES, LAST_NAMES, REQUEST_TEMPLATES, REVIEW_TEXT } from '../data/content'
import { GOALS } from '../data/goals'
import { ERRORS, ERROR_LIST, WEAR, type ErrorCode } from '../data/errors'
import { INCIDENTS, INCIDENT_LIST, type IncidentType } from '../data/incidents'
import { SLOTS, fits, MAX_DRYERS } from '../data/garage'
import { nextRandom } from './rng'
import type {
  DayStats, DeliveryContent, FailureType, Grade, Incident, Item, Job, LedgerEntry, Mail, Order, Printer, SimEvent,
  SimState, Spool,
} from './types'

export const SAVE_VERSION = 2
export const UPS_MINUTES = 60
const DRYER_KW = 0.2

export interface ActionResult {
  ok: boolean
  error?: string
}
const OK: ActionResult = { ok: true }
const fail = (error: string): ActionResult => ({ ok: false, error })

// ============================================================================= helpers
export const dayOf = (t: number) => Math.floor(t / 1440) + 1
export const minuteOfDay = (t: number) => ((t % 1440) + 1440) % 1440
export const dayStartTime = (day: number) => (day - 1) * 1440 + DAY_START

export function rand(s: SimState): number {
  const [v, next] = nextRandom(s.seed)
  s.seed = next
  return v
}
function randFail(s: SimState): number {
  const [v, next] = nextRandom(s.failSeed)
  s.failSeed = next
  return v
}
const pick = <T,>(s: SimState, arr: T[]): T => arr[Math.floor(rand(s) * arr.length)]
function weighted<K extends string>(s: SimState, w: Record<K, number>, r = rand): K {
  const entries = (Object.entries(w) as [K, number][]).filter(([, v]) => v > 0)
  let x = r(s) * entries.reduce((a, [, v]) => a + v, 0)
  for (const [k, v] of entries) {
    if ((x -= v) <= 0) return k
  }
  return entries[0][0]
}
const id = (s: SimState, prefix: string) => `${prefix}${s.nextId++}`
const round2 = (n: number) => Math.round(n * 100) / 100
const emit = (s: SimState, e: SimEvent) => s.events.push(e)

function ledger(s: SimState, amount: number, category: LedgerEntry['category'], label: string) {
  s.money = round2(s.money + amount)
  s.ledger.push({ day: s.day, time: s.time, amount: round2(amount), category, label })
  if (s.ledger.length > 800) s.ledger.splice(0, s.ledger.length - 800)
}

export const getPrinter = (s: SimState, pid: string) => s.printers.find((p) => p.id === pid)
export const getOrder = (s: SimState, oid: string | null | undefined) => s.orders.find((o) => o.id === oid)
export const getItem = (s: SimState, iid: string | null | undefined) => s.items.find((i) => i.id === iid)
export const getSpool = (s: SimState, sid: string | null | undefined) => s.spools.find((x) => x.id === sid)
export const getDryer = (s: SimState, did: string) => s.dryers.find((d) => d.id === did)
export const heldSpool = (s: SimState) => (s.held?.kind === 'spool' ? getSpool(s, s.held.id) : undefined)
export const heldItem = (s: SimState) => (s.held?.kind === 'item' ? getItem(s, s.held.id) : undefined)
/** Loaded spools of a printer (per tool; undefined = empty tool) */
export const printerSpools = (s: SimState, p: Printer) => p.spools.map((sid) => getSpool(s, sid))
export const productColors = (pid: ProductId) => PRODUCTS[pid].colors ?? 1

export function activeIncident(s: SimState, type: IncidentType): Incident | undefined {
  return s.incidents.find((i) => i.type === type && i.start <= s.time && s.time < i.end)
}
export const todayIncidents = (s: SimState) => s.incidents.filter((i) => i.day === s.day)
const humidity = (s: SimState) => (activeIncident(s, 'humid_day') ? 3 : 1)

function freeShelfSlot(s: SimState): number {
  const used = new Set(s.spools.filter((x) => x.loc.t === 'shelf').map((x) => (x.loc as { slot: number }).slot))
  for (let i = 0; i < SHELF_SPOOL_SLOTS; i++) if (!used.has(i)) return i
  return -1
}
function freeOutboxSlot(s: SimState): number {
  const used = new Set(s.items.filter((i) => i.loc.t === 'outbox').map((i) => (i.loc as { slot: number }).slot))
  for (let i = 0; i < OUTBOX_SLOTS; i++) if (!used.has(i)) return i
  return -1
}
/** First free garage slot that fits a printer of this size class (null = garage full for that size). */
export function freePrinterSlot(s: SimState, size: SizeClass = 'm', taken: string[] = []): string | null {
  const used = new Set([...s.printers.map((p) => p.slot), ...taken])
  // prefer the smallest fitting slot so wide slots stay free for wide printers
  const order = ['m', 'l', 'xl']
  const cands = SLOTS.filter((sl) => fits(size, sl.size) && !used.has(sl.id)).sort((a, b) => order.indexOf(a.size) - order.indexOf(b.size))
  return cands[0]?.id ?? null
}

function newCustomer(s: SimState) {
  const first = pick(s, FIRST_NAMES)
  const last = pick(s, LAST_NAMES)
  return {
    customer: `${first} ${last}`,
    email: `${first}.${last}`.toLowerCase() + '@' + pick(s, ['mailbox.test', 'inbox.test', 'post.test']),
    city: pick(s, CITIES),
  }
}

function addMail(s: SimState, m: Omit<Mail, 'id' | 'time' | 'read'>): Mail {
  const mail: Mail = { ...m, id: id(s, 'm'), time: s.time, read: false }
  s.mail.unshift(mail)
  emit(s, { type: 'mail', mailId: mail.id })
  return mail
}

type NewOrder = Omit<Order, 'id' | 'number' | 'createdAt' | 'status' | 'attempts' | 'shippedDay' | 'late' | 'grade' | 'reviewed' | 'color' | 'colors'> & { colors: ColorId[] }
function addOrder(s: SimState, o: NewOrder): Order {
  const order: Order = {
    ...o, color: o.colors[0], id: id(s, 'o'), number: s.nextOrderNumber++, createdAt: s.time, status: 'new', attempts: 0,
    shippedDay: null, late: false, grade: null, reviewed: false,
  }
  s.orders.push(order)
  emit(s, { type: 'order', orderId: order.id })
  return order
}

function newSpool(s: SimState, material: Material, color: ColorId, grams = SPOOL_GRAMS, sealed = true, moisture = 0): Spool {
  const sp: Spool = { id: id(s, 's'), material, color, grams, moisture, sealed, loc: { t: 'shelf', slot: freeShelfSlot(s) } }
  s.spools.push(sp)
  return sp
}

function newPrinter(s: SimState, modelId: PrinterModelId, slot: string): Printer {
  const p: Printer = {
    id: id(s, 'p'), modelId, slot, status: 'idle', job: null, spools: Array(PRINTERS[modelId].tools).fill(null),
    bedItemId: null, needsMaintenance: false, error: null, wear: { nozzleH: 0, beltH: 0, plate: 0 }, fwPending: false,
    updateLeft: 0, resumeStatus: null, printMinutesToday: 0, totalPrints: 0,
  }
  s.printers.push(p)
  return p
}

function newDryer(s: SimState, spot: number) {
  s.dryers.push({ id: id(s, 'd'), spot, slots: [null, null] })
}

// ============================================================================= state creation
export function createInitialState(seed = 12345): SimState {
  const s: SimState = {
    version: SAVE_VERSION, time: dayStartTime(1), day: 1, money: START_MONEY, reputation: START_REPUTATION,
    seed: seed >>> 0 || 1, failSeed: ((seed >>> 0) ^ 0x5bd1e995) >>> 0 || 7, jobsCreated: 0, nextId: 1,
    nextOrderNumber: 1001, printers: [], spools: [], dryers: [], orders: [], items: [], mail: [], crates: [],
    supplies: { box_s: 10, box_m: 5, box_l: 2, paper: 10 }, parts: { nozzle: 1, fan: 0, ipa: 5 }, upgrades: { ups: false },
    incidents: [], power: true, internet: true, outageMin: 0, missedOrders: 0, courierTime: COURIER_TIME,
    held: null, ledger: [], reviews: [], stats: [], goalsDone: [], courierDoneDay: 0, dayEnded: false,
    electricityToday: 0, events: [],
  }
  const ender = newPrinter(s, 'ender3v3', 'A1')
  const black = newSpool(s, 'PLA', 'black', 740, false, 0.12)
  black.loc = { t: 'printer', printerId: ender.id, tool: 0 }
  ender.spools[0] = black.id
  newSpool(s, 'PLA', 'white', 1000, false, 0.08)
  newSpool(s, 'PLA', 'grey', 1000, false, 0.22)
  newSpool(s, 'PLA', 'red', 1000, true)
  newSpool(s, 'PLA', 'blue', 420, false, 0.48) // an old damp spool: teaches drying
  newDryer(s, 0)
  s.stats.push(newDayStats(s))
  addMail(s, {
    from: 'noreply@layergoods.test', fromName: 'LayerGoods', kind: 'system', subject: 'Your shop is live! 🎉',
    body: "Congratulations! Your LayerGoods shop \"Garage Layers\" is now open for business.\n\nOrders from customers appear in the Orders app. Slice them, print them, pack them and get them on the Outbox shelf before the courier arrives at 17:00.\n\nGood luck,\nThe LayerGoods team",
  })
  addMail(s, {
    from: 'sam@mailbox.test', fromName: 'Sam (your buddy)', kind: 'info', subject: 'Quick printer tips before you start',
    body: "Hey! Proud of you for finally doing this.\n\nA few things I learned the hard way:\n• Your old Endr-3 has no Wi-Fi. Slice the file to USB, then click the printer and start it there.\n• Watch for spaghetti! If a print comes loose, the printer just keeps going.\n• Filament soaks up moisture once the bag is open. That old blue spool is damp: pop it in the dryer on the fridge before using it.\n• The courier comes at 17:00. Anything not on the Outbox shelf waits until tomorrow.\n• Use the ▶▶ button to speed up time while you wait.\n\nGo get 'em!\nSam",
  })
  addOrder(s, { source: 'shop', customer: 'Lisa Meyer', email: 'lisa.meyer@mailbox.test', city: 'Portland, OR', productId: 'benchy', material: 'PLA', colors: ['black'], price: 9.49, dueDay: 2 })
  return s
}

function newDayStats(s: SimState): DayStats {
  return { day: s.day, shipped: 0, revenue: 0, costs: 0, repStart: s.reputation, repEnd: s.reputation, failures: 0, printsDone: 0, errors: 0 }
}
const todayStats = (s: SimState) => {
  let st = s.stats.find((x) => x.day === s.day)
  if (!st) {
    st = newDayStats(s)
    s.stats.push(st)
  }
  return st
}

// ============================================================================= time
/** Advance the simulation by dt game-minutes. */
export function tick(s: SimState, dt: number) {
  if (s.dayEnded) return
  let left = dt
  while (left > 1e-9) {
    const step = Math.min(1, left)
    left -= step
    stepMinute(s, step)
    if (s.dayEnded) break
  }
  checkGoals(s)
}

/** Events that happen once per whole game minute (independent of frame rate → deterministic). */
function minuteEvents(s: SimState, minute: number) {
  const mod = minuteOfDay(minute)
  // incidents starting / ending this minute
  for (const inc of s.incidents) {
    if (!inc.started && minute >= inc.start) startIncident(s, inc)
    if (inc.started && !inc.ended && minute >= inc.end) endIncident(s, inc)
  }
  if (mod >= SHOP_OPEN && mod < SHOP_CLOSE) {
    const viral = activeIncident(s, 'viral_product')
    const perDay = (3 + s.reputation * 1.2) * (viral ? 1.3 : 1)
    if (rand(s) < perDay / (SHOP_CLOSE - SHOP_OPEN)) {
      if (s.internet) spawnShopOrder(s)
      else s.missedOrders++
    }
    if (s.day === 1 && mod === 9 * 60 + 30) {
      addOrder(s, { source: 'shop', customer: 'Marco Rossi', email: 'marco.rossi@inbox.test', city: 'Austin, TX', productId: 'phone_stand', material: 'PLA', colors: ['white'], price: 12.99, dueDay: 3 })
    }
    if (mod === 11 * 60 && s.internet) spawnRequest(s)
  }
}

function stepMinute(s: SimState, dt: number) {
  const before = s.time
  s.time += dt
  const mod = minuteOfDay(s.time)
  for (let m = Math.floor(before) + 1; m <= Math.floor(s.time + 1e-9); m++) minuteEvents(s, m)
  for (const c of s.crates) {
    if (!c.arrived && s.time >= c.arriveAt) {
      c.arrived = true
      emit(s, { type: 'delivery', crateId: c.id })
    }
  }
  if (!s.power) s.outageMin += dt
  updateMoisture(s, dt)
  for (const p of s.printers) updatePrinter(s, p, dt)
  if (mod >= s.courierTime && s.courierDoneDay !== s.day && dayOf(s.time) === s.day) courier(s)
  if (mod >= DAY_FORCED_END && dayOf(s.time) === s.day) {
    s.dayEnded = true
    emit(s, { type: 'day_end', forced: true })
  }
}

function spawnShopOrder(s: SimState) {
  const viral = activeIncident(s, 'viral_product')
  const weights = Object.fromEntries(PRODUCT_LIST.map((p) => [p.id, p.demand * (viral?.productId === p.id ? 5 : 1)])) as Record<ProductId, number>
  const pid = weighted(s, weights)
  const prod = PRODUCTS[pid]
  const mat: Material = prod.materials.includes('PLA') && rand(s) < 0.75 ? 'PLA' : pick(s, prod.materials)
  const n = prod.colors ?? 1
  const colors: ColorId[] = []
  while (colors.length < n) {
    const c = weighted(s, COLOR_DEMAND)
    if (!colors.includes(c)) colors.push(c)
  }
  const c = newCustomer(s)
  const price = (Math.round(prod.price * (0.95 + rand(s) * 0.2) * (viral?.productId === pid ? 1.2 : 1)) - 0.01)
  addOrder(s, { source: 'shop', ...c, productId: pid, material: mat, colors, price, dueDay: s.day + (prod.hours >= 5 ? 3 : 2) })
}

function spawnRequest(s: SimState) {
  const t = pick(s, REQUEST_TEMPLATES)
  const prod = PRODUCTS[t.productId]
  const color = weighted(s, COLOR_DEMAND)
  const mat: Material = prod.materials[0]
  const c = newCustomer(s)
  const price = Math.round(prod.price * 1.3)
  addMail(s, {
    from: c.email, fromName: c.customer, kind: 'request', subject: t.subject,
    body: t.body.replace('{product}', prod.name).replace('{color}', COLORS[color].name.toLowerCase()) + `\n${c.customer.split(' ')[0]}`,
    choices: [
      { id: 'accept', label: `Accept: quote $${price} (${prod.name}, ${COLORS[color].name} ${mat})` },
      { id: 'counter', label: `Counter-offer: $${Math.round(price * 1.5)} (rush-job premium)` },
      { id: 'decline', label: 'Politely decline' },
    ],
    request: { productId: prod.id, material: mat, color, price, ...c },
  })
}

// ============================================================================= incidents
function rollIncidents(s: SimState) {
  if (s.day < 2) return
  const base = dayStartTime(s.day)
  let n = 0
  for (const def of INCIDENT_LIST) {
    if (n >= 2 || rand(s) >= def.chance) continue
    let start = base
    let end = base + 15 * 60
    if (def.type === 'power_outage') {
      start = base + 120 + Math.floor(rand(s) * 360)
      end = start + 60 + Math.floor(rand(s) * 120)
    } else if (def.type === 'internet_outage') {
      start = base + 60 + Math.floor(rand(s) * 360)
      end = start + 120 + Math.floor(rand(s) * 240)
    }
    const inc: Incident = { type: def.type, day: s.day, start, end }
    if (def.type === 'viral_product') inc.productId = pick(s, PRODUCT_LIST.filter((p) => !p.colors && !p.minBuild)).id
    if (def.type === 'firmware_update') {
      const wifi = s.printers.filter((p) => PRINTERS[p.modelId].link === 'wifi' && !p.fwPending)
      if (!wifi.length) continue
      inc.printerId = pick(s, wifi).id
    }
    s.incidents.push(inc)
    n++
  }
  // keep the list small
  s.incidents = s.incidents.filter((i) => i.day >= s.day - 3)
}

function startIncident(s: SimState, inc: Incident) {
  inc.started = true
  const def = INCIDENTS[inc.type]
  switch (inc.type) {
    case 'power_outage':
      s.power = false
      s.outageMin = 0
      emit(s, { type: 'power', on: false })
      break
    case 'internet_outage':
      s.internet = false
      emit(s, { type: 'internet', on: false })
      break
    case 'courier_late':
      s.courierTime = 19 * 60
      break
    case 'supplier_delay':
      for (const c of s.crates) if (!c.arrived && dayOf(c.arriveAt) === s.day) c.arriveAt += 1440
      break
    case 'firmware_update': {
      const p = inc.printerId ? getPrinter(s, inc.printerId) : undefined
      if (p) p.fwPending = true
      break
    }
  }
  if (!def.announced) emit(s, { type: 'incident', incident: inc.type })
}

function endIncident(s: SimState, inc: Incident) {
  inc.ended = true
  switch (inc.type) {
    case 'power_outage':
      s.power = true
      for (const p of s.printers) {
        if (p.status !== 'paused_power' || !p.job) continue
        if (PRINTERS[p.modelId].powerRecovery) {
          p.status = p.resumeStatus ?? 'printing'
          p.resumeStatus = null
        } else powerLoss(s, p)
      }
      emit(s, { type: 'power', on: true })
      break
    case 'internet_outage':
      s.internet = true
      for (let i = 0; i < s.missedOrders; i++) spawnShopOrder(s)
      s.missedOrders = 0
      emit(s, { type: 'internet', on: true })
      break
    case 'courier_late':
      s.courierTime = COURIER_TIME
      break
  }
}

/** A printer without power-loss recovery loses the job when the power comes back. */
function powerLoss(s: SimState, p: Printer) {
  const job = p.job!
  const frac = job.elapsedMin / job.durationMin
  const item: Item = {
    id: id(s, 'i'), kind: 'print', orderId: job.orderId, productId: job.productId, material: job.material, color: job.colors[0],
    colors: job.colors, grade: 'F', defect: 'power_loss', fraction: Math.max(0.05, frac), loc: { t: 'bed', printerId: p.id },
  }
  s.items.push(item)
  const o = getOrder(s, job.orderId)
  if (o && (o.status === 'printing' || o.status === 'queued')) {
    o.status = 'new'
    o.attempts++
  }
  p.job = null
  p.bedItemId = item.id
  p.status = 'done'
  p.resumeStatus = null
  todayStats(s).failures++
}

// ============================================================================= moisture & dryers
function updateMoisture(s: SimState, dt: number) {
  const h = humidity(s)
  for (const sp of s.spools) {
    if (sp.sealed) continue
    if (sp.loc.t === 'dryer') {
      if (!s.power) continue
      const before = sp.moisture
      sp.moisture = Math.max(0, sp.moisture - (MOISTURE.dryPerHour * dt) / 60)
      if (before >= 0.05 && sp.moisture < 0.05) emit(s, { type: 'dried', spoolId: sp.id })
    } else sp.moisture = Math.min(1, sp.moisture + (MATERIALS[sp.material].moisture * h * dt) / 60)
  }
}

export function putInDryer(s: SimState, dryerId: string): ActionResult {
  const d = getDryer(s, dryerId)
  const sp = heldSpool(s)
  if (!d) return fail('Unknown dryer')
  if (!sp) return fail('Carry a spool first')
  const slot = d.slots.indexOf(null)
  if (slot < 0) return fail('The dryer is full (2 spools)')
  d.slots[slot] = sp.id
  sp.loc = { t: 'dryer', dryerId: d.id, slot }
  sp.sealed = false
  s.held = null
  return OK
}

export function takeFromDryer(s: SimState, dryerId: string, slot?: number): ActionResult {
  const d = getDryer(s, dryerId)
  if (!d) return fail('Unknown dryer')
  if (s.held) return fail('Your hands are full')
  const i = slot ?? d.slots.findIndex((x) => x !== null)
  const sid = d.slots[i]
  if (i < 0 || !sid) return fail('The dryer is empty')
  const sp = getSpool(s, sid)!
  d.slots[i] = null
  sp.loc = { t: 'held' }
  s.held = { kind: 'spool', id: sp.id }
  return OK
}

// ============================================================================= printing
/** Probability that a job fails (shown in the Slicer as the risk estimate). */
export function failChance(modelId: PrinterModelId, material: Material, quality: QualityId, moisture = 0): number {
  const m = PRINTERS[modelId]
  let chance = m.baseFail + QUALITY[quality].fail + MATERIALS[material].failMod
  if (!m.enclosed) chance += MATERIALS[material].openWarp
  if (moisture > MOISTURE.failFrom) chance += (moisture - MOISTURE.failFrom) * 0.5
  return Math.max(0, Math.min(0.95, chance))
}

function rollFailure(s: SimState, p: Printer, material: Material, quality: QualityId, moisture: number): Job['failure'] {
  const heat = !!activeIncident(s, 'heat_wave')
  const worn = { nozzle: p.wear.nozzleH > WEAR.nozzleH, belts: p.wear.beltH > WEAR.beltH, plate: p.wear.plate >= WEAR.platePrints }
  let chance = failChance(p.modelId, material, quality, moisture)
  if (heat) chance += 0.03
  if (worn.nozzle) chance += 0.03
  if (worn.belts) chance += 0.03
  if (worn.plate) chance += 0.05
  if (p.needsMaintenance) return { type: 'clog', at: 0.03 + randFail(s) * 0.1 }
  const roll = randFail(s)
  if (s.jobsCreated === 0) return null // tutorial grace: your very first print always succeeds
  if (roll >= Math.min(0.95, chance)) return null
  const type = weighted<FailureType>(s, {
    spaghetti: 55 + (worn.plate ? 30 : 0),
    clog: 15 + (heat ? 15 : 0) + (worn.nozzle ? 15 : 0) + (moisture > MOISTURE.gradeC ? 10 : 0),
    layer_shift: 30 + (worn.belts ? 25 : 0),
  }, randFail)
  const at = type === 'spaghetti' ? 0.08 + randFail(s) * 0.6 : 0.15 + randFail(s) * 0.7
  return { type, at }
}

function rollError(s: SimState, p: Printer): Job['error'] {
  const m = PRINTERS[p.modelId]
  const chance = m.errorRate + (p.fwPending ? 0.05 : 0) + (p.wear.nozzleH > WEAR.nozzleH ? 0.01 : 0)
  const roll = randFail(s)
  if (s.jobsCreated === 0 || roll >= chance) return null
  const defs = ERROR_LIST.filter((e) => e.applies(m))
  const code = weighted<ErrorCode>(s, Object.fromEntries(defs.map((d) => [d.code, d.weight])) as Record<ErrorCode, number>, randFail)
  return { code, at: 0.1 + randFail(s) * 0.8 }
}

function startJob(s: SimState, p: Printer) {
  const job = p.job!
  job.heatLeftMin = HEAT_MINUTES
  job.startedAt = s.time
  p.status = 'heating'
  const o = getOrder(s, job.orderId)
  if (o) o.status = 'printing'
  emit(s, { type: 'print_started', printerId: p.id })
}

function gradeFor(p: Printer, job: Job): { grade: Grade; defect: Item['defect'] } {
  const max = QUALITY[job.quality].maxGrade
  let grade: Grade = max === 'A+' && p.modelId !== 'ender3v3' ? 'A+' : max === 'B' ? 'B' : p.modelId === 'ender3v3' ? (job.quality === 'fine' ? 'A' : 'B') : 'A'
  const cap = (g: Grade) => {
    const order: Grade[] = ['A+', 'A', 'B', 'C', 'F']
    if (order.indexOf(grade) < order.indexOf(g)) grade = g
  }
  let defect: Item['defect'] = null
  if (p.wear.nozzleH > WEAR.nozzleH) cap('B')
  if (job.moisture > MOISTURE.gradeB) cap('B')
  if (job.moisture > MOISTURE.gradeC) {
    cap('C')
    defect = 'stringing'
  }
  return { grade, defect }
}

function updatePrinter(s: SimState, p: Printer, dt: number) {
  if (p.status === 'updating') {
    if (!s.power) return
    p.updateLeft -= dt
    if (p.updateLeft <= 0) {
      p.status = 'idle'
      p.fwPending = false
      emit(s, { type: 'info', message: `${PRINTERS[p.modelId].name}: firmware updated` })
    }
    return
  }
  const job = p.job
  if (!job) return
  // power cut: the UPS covers the first hour
  if (!s.power && !(s.upgrades.ups && s.outageMin < UPS_MINUTES) && (p.status === 'printing' || p.status === 'heating')) {
    p.resumeStatus = p.status
    p.status = 'paused_power'
    return
  }
  if (p.status === 'heating') {
    job.heatLeftMin -= dt
    p.printMinutesToday += dt * 0.6
    if (job.heatLeftMin <= 0) p.status = 'printing'
    return
  }
  if (p.status !== 'printing') return
  p.printMinutesToday += dt
  p.wear.nozzleH += dt / 60
  p.wear.beltH += dt / 60
  const frac0 = job.elapsedMin / job.durationMin
  job.elapsedMin = Math.min(job.durationMin, job.elapsedMin + dt)
  const frac = job.elapsedMin / job.durationMin
  // machine error
  if (job.error && !job.errored && frac >= job.error.at) {
    triggerError(s, p, job.error.code)
    return
  }
  // print failure moment
  if (job.failure && !job.failed && frac >= job.failure.at) {
    job.failed = true
    if (job.failure.type !== 'layer_shift') job.stoppedAt = job.failure.at
    if (job.failure.type === 'clog') p.needsMaintenance = true
    todayStats(s).failures++
    emit(s, { type: 'failure_hidden', printerId: p.id, failure: job.failure.type })
  }
  // filament consumption, split across the tools in use
  const clogged = job.failed && job.failure?.type === 'clog'
  if (!clogged) {
    const used = job.grams * (frac - frac0)
    if (job.failed && job.failure?.type === 'spaghetti') job.spaghettiGrams += used
    for (const t of job.tools) {
      const sp = getSpool(s, p.spools[t])
      if (!sp) continue
      sp.grams = Math.max(0, sp.grams - used / job.tools.length)
      if (sp.grams <= 0 && frac < 1) {
        p.status = 'paused_runout'
        emit(s, { type: 'runout', printerId: p.id })
        return
      }
    }
  }
  if (frac >= 1) finishJob(s, p)
}

/** Exported for QA automation (window.__qa.forceError); the game itself only reaches it via rollError. */
export function triggerError(s: SimState, p: Printer, code: ErrorCode) {
  const job = p.job!
  const def = ERRORS[code]
  job.errored = true
  p.error = { code, abort: def.abort }
  p.status = 'error'
  todayStats(s).errors++
  if (def.abort) {
    const frac = job.elapsedMin / job.durationMin
    const item: Item = {
      id: id(s, 'i'), kind: 'print', orderId: job.orderId, productId: job.productId, material: job.material, color: job.colors[0],
      colors: job.colors, grade: 'F', defect: 'aborted', fraction: Math.max(0.05, frac), loc: { t: 'bed', printerId: p.id },
    }
    s.items.push(item)
    p.bedItemId = item.id
    const o = getOrder(s, job.orderId)
    if (o && (o.status === 'printing' || o.status === 'queued')) {
      o.status = 'new'
      o.attempts++
    }
    p.job = null
  }
  emit(s, { type: 'printer_error', printerId: p.id, code })
}

function finishJob(s: SimState, p: Printer) {
  const job = p.job!
  let { grade, defect } = gradeFor(p, job)
  let fraction = 1
  if (job.failed && job.failure) {
    if (job.failure.type === 'spaghetti') { defect = 'spaghetti'; grade = 'F'; fraction = job.stoppedAt ?? 0.2 }
    if (job.failure.type === 'clog') { defect = 'incomplete'; grade = 'F'; fraction = job.stoppedAt ?? 0.1 }
    if (job.failure.type === 'layer_shift') { defect = 'layer_shift'; grade = 'C' }
  }
  if (job.colorMix && !defect) { defect = 'color_mix'; grade = 'C' }
  const item: Item = {
    id: id(s, 'i'), kind: 'print', orderId: job.orderId, productId: job.productId, material: job.material, color: job.colors[0],
    colors: job.colors, grade, defect, fraction, loc: { t: 'bed', printerId: p.id },
  }
  s.items.push(item)
  p.bedItemId = item.id
  p.status = 'done'
  p.totalPrints++
  p.wear.plate++
  todayStats(s).printsDone++
  const o = getOrder(s, job.orderId)
  if (o && o.status === 'printing') {
    if (grade === 'F') {
      o.status = 'new'
      o.attempts++
    } else o.status = 'printed'
  }
  p.job = null
  emit(s, { type: 'print_done', printerId: p.id })
}

/** Print time and filament (incl. AMS purge / toolchange waste) for a product on a printer model. */
export function estimateJob(modelId: PrinterModelId, productId: ProductId, quality: QualityId) {
  const prod = PRODUCTS[productId]
  const m = PRINTERS[modelId]
  const extra = Math.max(0, (prod.colors ?? 1) - 1)
  const timeMul = m.multi === 'ams' ? 1 + 0.25 * extra : m.multi === 'toolchanger' ? 1 + 0.05 * extra : 1
  const purge = m.multi === 'ams' ? 15 * extra : m.multi === 'toolchanger' ? 2 * extra : 0
  const minutes = Math.round(prod.hours * 60 * m.speed * QUALITY[quality].time * timeMul)
  return { minutes, grams: prod.grams + purge, purge }
}

export function canPrinterTake(_s: SimState, p: Printer): ActionResult {
  if (p.status === 'error') return fail('Printer has an error: fix it first')
  if (p.status === 'updating') return fail('Firmware update in progress')
  if (p.status !== 'idle') return fail(p.status === 'done' ? 'Clear the bed first' : 'Printer is busy')
  if (p.bedItemId) return fail('Clear the bed first')
  return OK
}

/** Map each order colour to a loaded tool with that material+colour (and filament left). */
export function assignTools(s: SimState, p: Printer, material: Material, colors: ColorId[]): { tools: number[] | null; missing: ColorId[] } {
  const used = new Set<number>()
  const tools: number[] = []
  const missing: ColorId[] = []
  for (const c of colors) {
    const t = p.spools.findIndex((sid, i) => {
      const sp = getSpool(s, sid)
      return !used.has(i) && !!sp && sp.material === material && sp.color === c && sp.grams > 0
    })
    if (t < 0) missing.push(c)
    else {
      used.add(t)
      tools.push(t)
    }
  }
  return { tools: missing.length ? null : tools, missing }
}

/** Everything that could stop this order printing on this printer (used by the Slicer for warnings). */
export function jobCheck(s: SimState, p: Printer, o: Order, viaUsb = false): ActionResult {
  const m = PRINTERS[p.modelId]
  const prod = PRODUCTS[o.productId]
  if ((prod.colors ?? 1) > m.tools) return fail(`${prod.name} needs ${prod.colors} colours: use an AMS or a toolchanger printer`)
  if (prod.minBuild && prod.minBuild > Math.min(...m.buildMm)) return fail(`Too big for the ${m.name}: needs a ${prod.minBuild} mm build volume`)
  const can = canPrinterTake(s, p)
  if (!can.ok) return can
  if (m.link === 'wifi' && !viaUsb && !s.internet) return fail('No internet: save the job to USB instead')
  if (!viaUsb && m.link === 'wifi') {
    const a = assignTools(s, p, o.material, o.colors)
    if (!a.tools) return fail(`Load ${a.missing.map((c) => `${COLORS[c].name} ${o.material}`).join(', ')} first`)
  }
  return OK
}

function worstMoisture(s: SimState, p: Printer, tools: number[]) {
  return Math.max(0, ...tools.map((t) => getSpool(s, p.spools[t])?.moisture ?? 0))
}

/** Slice an order and send it: Wi-Fi printers start at once, USB jobs wait for you at the machine. */
export function sendJob(s: SimState, orderId: string, printerId: string, quality: QualityId, viaUsb = false): ActionResult {
  const o = getOrder(s, orderId)
  const p = getPrinter(s, printerId)
  if (!o || !p) return fail('Unknown order or printer')
  if (o.status !== 'new') return fail('Order is already in progress')
  const usb = viaUsb || PRINTERS[p.modelId].link === 'usb'
  const chk = jobCheck(s, p, o, usb)
  if (!chk.ok) return chk
  const model = PRINTERS[p.modelId]
  if (o.material === 'ABS' && !model.enclosed) emit(s, { type: 'info', message: 'ABS on an open printer: high warping risk!' })
  const est = estimateJob(p.modelId, o.productId, quality)
  const a = assignTools(s, p, o.material, o.colors)
  const tools = a.tools ?? o.colors.map((_, i) => i)
  const moisture = worstMoisture(s, p, tools)
  p.job = {
    id: id(s, 'j'), orderId: o.id, productId: o.productId, material: o.material, colors: [...o.colors], tools, quality,
    durationMin: est.minutes, elapsedMin: 0, heatLeftMin: HEAT_MINUTES, grams: est.grams,
    failure: rollFailure(s, p, o.material, quality, moisture), error: rollError(s, p), failed: false, spaghettiGrams: 0,
    stoppedAt: null, startedAt: s.time, moisture,
  }
  s.jobsCreated++
  o.status = 'queued'
  if (!usb) startJob(s, p)
  else p.status = 'waiting_usb'
  return OK
}

export function startFromUsb(s: SimState, printerId: string): ActionResult {
  const p = getPrinter(s, printerId)
  if (!p || p.status !== 'waiting_usb' || !p.job) return fail('No job on the USB stick')
  if (!s.power && !s.upgrades.ups) return fail('No power!')
  const a = assignTools(s, p, p.job.material, p.job.colors)
  if (!a.tools) return fail(`Load ${a.missing.map((c) => `${COLORS[c].name} ${p.job!.material}`).join(', ')} first`)
  p.job.tools = a.tools
  p.job.moisture = worstMoisture(s, p, a.tools)
  startJob(s, p)
  return OK
}

/** Abort whatever is on the printer and scrape the bed clean. */
export function clearBed(s: SimState, printerId: string): ActionResult {
  const p = getPrinter(s, printerId)
  if (!p) return fail('Unknown printer')
  const job = p.job
  if (job && ['printing', 'heating', 'paused_runout', 'paused_power', 'error', 'waiting_usb'].includes(p.status)) {
    const o = getOrder(s, job.orderId)
    if (o && (o.status === 'printing' || o.status === 'queued')) {
      o.status = 'new'
      if (p.status !== 'waiting_usb') o.attempts++
    }
    p.job = null
    p.status = p.error ? 'error' : 'idle'
    return OK
  }
  if (p.bedItemId) {
    const it = getItem(s, p.bedItemId)
    if (it) {
      it.loc = { t: 'gone' }
      const o = getOrder(s, it.orderId)
      if (o && o.status === 'printed') {
        o.status = 'new'
        o.attempts++
      }
    }
    p.bedItemId = null
    p.status = p.error ? 'error' : 'idle'
    return OK
  }
  return fail('Bed is already clear')
}

export function removePrint(s: SimState, printerId: string): ActionResult {
  const p = getPrinter(s, printerId)
  if (!p || !p.bedItemId) return fail('Nothing on the bed')
  if (s.held) return fail('Your hands are full')
  const it = getItem(s, p.bedItemId)!
  it.loc = { t: 'held' }
  s.held = { kind: 'item', id: it.id }
  p.bedItemId = null
  p.status = p.error ? 'error' : 'idle'
  return OK
}

// ----------------------------------------------------------------------------- errors & maintenance
export function fixError(s: SimState, printerId: string): ActionResult {
  const p = getPrinter(s, printerId)
  if (!p || !p.error) return fail('No error to fix')
  const def = ERRORS[p.error.code]
  if (def.part) {
    if (s.parts[def.part] <= 0) return fail(`Needs a spare ${def.part}: order one in the Shop`)
    s.parts[def.part]--
  }
  p.error = null
  if (p.job) p.status = 'printing'
  else p.status = p.bedItemId ? 'done' : 'idle'
  return OK
}

function idleForService(p: Printer): ActionResult {
  if (['printing', 'heating', 'paused_power', 'updating'].includes(p.status)) return fail('Stop the print first')
  return OK
}

export function coldPull(s: SimState, printerId: string): ActionResult {
  const p = getPrinter(s, printerId)
  if (!p) return fail('Unknown printer')
  if (!p.needsMaintenance) return fail('Nozzle is clean')
  const ok = idleForService(p)
  if (!ok.ok) return ok
  p.needsMaintenance = false
  return OK
}

export function cleanPlate(s: SimState, printerId: string): ActionResult {
  const p = getPrinter(s, printerId)
  if (!p) return fail('Unknown printer')
  const ok = idleForService(p)
  if (!ok.ok) return ok
  if (s.parts.ipa <= 0) return fail('Out of IPA: buy a bottle in the Shop')
  s.parts.ipa--
  p.wear.plate = 0
  return OK
}

export function replaceNozzle(s: SimState, printerId: string): ActionResult {
  const p = getPrinter(s, printerId)
  if (!p) return fail('Unknown printer')
  const ok = idleForService(p)
  if (!ok.ok) return ok
  if (s.parts.nozzle <= 0) return fail('No spare nozzle: buy some in the Shop')
  s.parts.nozzle--
  p.wear.nozzleH = 0
  p.needsMaintenance = false
  return OK
}

export function tensionBelts(s: SimState, printerId: string): ActionResult {
  const p = getPrinter(s, printerId)
  if (!p) return fail('Unknown printer')
  const ok = idleForService(p)
  if (!ok.ok) return ok
  p.wear.beltH = 0
  return OK
}

export function updateFirmware(s: SimState, printerId: string): ActionResult {
  const p = getPrinter(s, printerId)
  if (!p || !p.fwPending) return fail('Firmware is up to date')
  if (p.status !== 'idle') return fail('The printer must be idle to update')
  if (!s.internet) return fail('No internet: the update can’t be downloaded')
  p.status = 'updating'
  p.updateLeft = 15
  return OK
}

export function pausePrinter(s: SimState, printerId: string): ActionResult {
  const p = getPrinter(s, printerId)
  if (!p || p.status !== 'printing') return fail('Not printing')
  p.status = 'paused_runout'
  return OK
}

export function resumePrinter(s: SimState, printerId: string): ActionResult {
  const p = getPrinter(s, printerId)
  if (!p || p.status !== 'paused_runout' || !p.job) return fail('Nothing to resume')
  const job = p.job
  // every colour needs a loaded spool of the right material with filament left (a different colour = colour mix)
  const tools: number[] = []
  const used = new Set<number>()
  for (const c of job.colors) {
    let t = p.spools.findIndex((sid, i) => !used.has(i) && getSpool(s, sid)?.material === job.material && getSpool(s, sid)!.color === c && getSpool(s, sid)!.grams > 0)
    if (t < 0) {
      t = p.spools.findIndex((sid, i) => !used.has(i) && getSpool(s, sid)?.material === job.material && getSpool(s, sid)!.grams > 0)
      if (t < 0) return fail(`Load ${COLORS[c].name} ${job.material} first`)
      job.colorMix = true
    }
    used.add(t)
    tools.push(t)
  }
  job.tools = tools
  p.status = 'printing'
  return OK
}

// ----------------------------------------------------------------------------- filament handling
export function unloadSpool(s: SimState, printerId: string, tool?: number): ActionResult {
  const p = getPrinter(s, printerId)
  if (!p) return fail('Unknown printer')
  if (s.held) return fail('Your hands are full')
  if (p.status === 'printing' || p.status === 'heating') return fail('Printer is busy')
  let t = tool
  if (t === undefined) {
    const empties = p.spools.map((sid, i) => (sid && (getSpool(s, sid)?.grams ?? 0) <= 0 ? i : -1)).filter((i) => i >= 0)
    t = empties[0] ?? p.spools.map((sid, i) => (sid ? i : -1)).filter((i) => i >= 0).pop()
  }
  if (t === undefined || t < 0 || !p.spools[t]) return fail('No spool loaded')
  const sp = getSpool(s, p.spools[t])!
  sp.loc = { t: 'held' }
  s.held = { kind: 'spool', id: sp.id }
  p.spools[t] = null
  return OK
}

export function loadSpool(s: SimState, printerId: string, tool?: number): ActionResult {
  const p = getPrinter(s, printerId)
  const sp = heldSpool(s)
  if (!p || !sp) return fail('Carry a spool first')
  const t = tool ?? p.spools.indexOf(null)
  if (t < 0) return fail(p.spools.length > 1 ? `All ${p.spools.length} filament slots are full: unload one first` : 'Unload the current spool first')
  if (p.spools[t]) return fail('That slot already has a spool')
  if (sp.grams <= 0) return fail('That spool is empty')
  sp.loc = { t: 'printer', printerId: p.id, tool: t }
  sp.sealed = false
  p.spools[t] = sp.id
  s.held = null
  if (p.status === 'paused_runout') resumePrinter(s, p.id)
  return OK
}

export function takeSpool(s: SimState, spoolId: string): ActionResult {
  if (s.held) return fail('Your hands are full')
  const sp = getSpool(s, spoolId)
  if (!sp || sp.loc.t !== 'shelf') return fail('Not on the shelf')
  sp.loc = { t: 'held' }
  s.held = { kind: 'spool', id: sp.id }
  return OK
}

export function shelveSpool(s: SimState): ActionResult {
  const sp = heldSpool(s)
  if (!sp) return fail('Not carrying a spool')
  const slot = freeShelfSlot(s)
  if (slot < 0) return fail('Shelf is full')
  sp.loc = { t: 'shelf', slot }
  s.held = null
  return OK
}

// ============================================================================= items, packing, shipping
export function placeOnTable(s: SimState): ActionResult {
  const it = heldItem(s)
  if (!it || it.kind !== 'print') return fail('Carry a print first')
  if (s.items.filter((i) => i.loc.t === 'table').length >= 4) return fail('Packing table is full')
  it.loc = { t: 'table' }
  s.held = null
  return OK
}

export function pickFromTable(s: SimState, itemId: string): ActionResult {
  if (s.held) return fail('Your hands are full')
  const it = getItem(s, itemId)
  if (!it || it.loc.t !== 'table') return fail('Not on the table')
  it.loc = { t: 'held' }
  s.held = { kind: 'item', id: it.id }
  return OK
}

export function packItem(s: SimState, itemId: string, box: BoxSize, padded: boolean): ActionResult {
  const it = getItem(s, itemId)
  if (!it || it.loc.t !== 'table' || it.kind !== 'print') return fail('Put the print on the packing table first')
  const o = getOrder(s, it.orderId)
  if (!o || o.status === 'shipped' || o.status === 'cancelled') return fail('No open order for this print')
  if (it.grade === 'F') return fail('Failed prints cannot be shipped')
  if (s.items.some((i) => i.loc.t === 'packslot')) return fail('Move the packed box off the station first')
  const need = PRODUCTS[it.productId].box
  if (!boxFits(need, box)) return fail(`Too small. ${PRODUCTS[it.productId].name} needs a ${BOX_SIZES[need].name} box`)
  const key = `box_${box}` as const
  if (s.supplies[key] <= 0) return fail(`Out of ${BOX_SIZES[box].name.toLowerCase()} boxes. Order more in the Shop`)
  if (padded && s.supplies.paper <= 0) return fail('Out of packing paper')
  s.supplies[key]--
  if (padded) s.supplies.paper--
  it.loc = { t: 'gone' }
  s.items.push({
    id: id(s, 'b'), kind: 'box', orderId: o.id, productId: it.productId, material: it.material, color: it.color, colors: it.colors,
    grade: it.grade, defect: it.defect, fraction: 1, boxSize: box, padded, loc: { t: 'packslot' },
  })
  o.status = 'packed'
  o.grade = it.grade
  return OK
}

export function scrapItem(s: SimState, itemId: string): ActionResult {
  const it = getItem(s, itemId)
  if (!it) return fail('Unknown item')
  it.loc = { t: 'gone' }
  const o = getOrder(s, it.orderId)
  if (o && (o.status === 'printed' || o.status === 'packed' || o.status === 'in_outbox')) {
    o.status = 'new'
    o.attempts++
  }
  if (s.held?.id === it.id) s.held = null
  return OK
}

export function pickPackedBox(s: SimState): ActionResult {
  if (s.held) return fail('Your hands are full')
  const b = s.items.find((i) => i.loc.t === 'packslot')
  if (!b) return fail('No packed box')
  b.loc = { t: 'held' }
  s.held = { kind: 'item', id: b.id }
  return OK
}

export function placeInOutbox(s: SimState): ActionResult {
  const it = heldItem(s)
  if (!it || it.kind !== 'box') return fail('Carry a packed box')
  const slot = freeOutboxSlot(s)
  if (slot < 0) return fail('Outbox is full')
  it.loc = { t: 'outbox', slot }
  s.held = null
  const o = getOrder(s, it.orderId)
  if (o) o.status = 'in_outbox'
  return OK
}

export function takeFromOutbox(s: SimState, itemId: string): ActionResult {
  if (s.held) return fail('Your hands are full')
  const it = getItem(s, itemId)
  if (!it || it.loc.t !== 'outbox') return fail('Not in the outbox')
  it.loc = { t: 'held' }
  s.held = { kind: 'item', id: it.id }
  const o = getOrder(s, it.orderId)
  if (o) o.status = 'packed'
  return OK
}

export function trashHeld(s: SimState): ActionResult {
  if (!s.held) return fail('Nothing to throw away')
  if (s.held.kind === 'spool') {
    const sp = getSpool(s, s.held.id)
    if (sp && sp.grams > 50) return fail('That spool still has filament. Shelve it instead')
    s.spools = s.spools.filter((x) => x.id !== s.held!.id)
    s.held = null
    return OK
  }
  if (s.held.kind === 'item') return scrapItem(s, s.held.id)
  return fail('Cannot throw that away')
}

export function dropHeld(s: SimState, x: number, y: number, z: number): ActionResult {
  if (!s.held) return fail('Nothing to drop')
  if (s.held.kind === 'item') {
    getItem(s, s.held.id)!.loc = { t: 'floor', x, y, z }
    s.held = null
    return OK
  }
  return shelveSpool(s)
}

export function pickFromFloor(s: SimState, itemId: string): ActionResult {
  if (s.held) return fail('Your hands are full')
  const it = getItem(s, itemId)
  if (!it || it.loc.t !== 'floor') return fail('Not here')
  it.loc = { t: 'held' }
  s.held = { kind: 'item', id: it.id }
  return OK
}

function courier(s: SimState) {
  s.courierDoneDay = s.day
  const boxes = s.items.filter((i) => i.loc.t === 'outbox')
  let revenue = 0
  for (const b of boxes) {
    const o = getOrder(s, b.orderId)
    b.loc = { t: 'gone' }
    if (!o) continue
    o.status = 'shipped'
    o.shippedDay = s.day
    o.late = s.day > o.dueDay
    const fee = round2(o.price * PLATFORM_FEE)
    const label = BOX_SIZES[b.boxSize ?? 's'].label
    ledger(s, o.price, 'sales', `Order #${o.number} ${PRODUCTS[o.productId].name}`)
    ledger(s, -fee, 'fees', `Platform fee #${o.number}`)
    ledger(s, -label, 'labels', `Shipping label #${o.number}`)
    revenue += o.price - fee - label
    const st = todayStats(s)
    st.shipped++
    st.revenue += o.price
    st.costs += fee + label
    o.padded = b.padded
    o.defect = b.defect
  }
  emit(s, { type: 'courier', count: boxes.length, revenue: round2(revenue) })
}

// ============================================================================= mail
export function readMail(s: SimState, mailId: string) {
  const m = s.mail.find((x) => x.id === mailId)
  if (m) m.read = true
  checkGoals(s)
}

export function replyMail(s: SimState, mailId: string, choiceId: string): ActionResult {
  const m = s.mail.find((x) => x.id === mailId)
  if (!m || !m.choices || m.chosen) return fail('Already answered')
  if (!s.internet) return fail('No internet: the reply can’t be sent')
  m.chosen = choiceId
  const r = m.request
  if (!r) return OK
  const prod = PRODUCTS[r.productId]
  if (choiceId === 'accept') {
    const o = addOrder(s, { source: 'email', customer: r.customer, email: r.email, city: r.city, productId: r.productId, material: r.material, colors: [r.color], price: r.price, dueDay: s.day + (prod.hours >= 5 ? 4 : 3) })
    m.orderId = o.id
    m.replyText = `Hi ${r.customer.split(' ')[0]}, happy to help! $${r.price} for a ${COLORS[r.color].name.toLowerCase()} ${prod.name}. I'll get started right away.`
    s.reputation = Math.min(5, s.reputation + 0.02)
  } else if (choiceId === 'counter') {
    m.replyText = `Hi! I can do it for $${Math.round(r.price * 1.5)}. Custom work takes extra time. Let me know!`
    m.counterAt = s.time
  } else {
    m.replyText = "Thanks for reaching out! Unfortunately I can't take this one on right now."
  }
  return OK
}

// ============================================================================= shop & deliveries
export interface CartLine {
  kind: 'spool' | 'supply' | 'printer' | 'upgrade'
  material?: Material
  color?: ColorId
  supply?: SupplyId
  printer?: PrinterModelId
  upgrade?: UpgradeId
  qty: number
}

export function cartPrice(line: CartLine): number {
  if (line.kind === 'spool') return MATERIALS[line.material!].price * line.qty
  if (line.kind === 'supply') return SUPPLIES[line.supply!].price * line.qty
  if (line.kind === 'upgrade') return UPGRADES[line.upgrade!].price * line.qty
  return PRINTERS[line.printer!].price * line.qty
}

/** Printers already paid for but not yet unboxed */
const pendingPrinters = (s: SimState) =>
  s.crates.filter((c) => !c.opened).flatMap((c) => c.contents).filter((c) => c.kind === 'printer').flatMap((c) => Array<PrinterModelId>(c.qty).fill(c.printer!))
const pendingDryers = (s: SimState) =>
  s.crates.filter((c) => !c.opened).flatMap((c) => c.contents).filter((c) => c.kind === 'upgrade' && c.upgrade === 'dryer').reduce((a, c) => a + c.qty, 0)

/** Would these printers (plus the ones on the way) still fit in the garage? Returns the first that doesn't. */
export function capacityCheck(s: SimState, extra: PrinterModelId[]): PrinterModelId | null {
  const taken: string[] = []
  const all = [...pendingPrinters(s), ...extra].sort((a, b) => ['xl', 'l', 'm'].indexOf(PRINTERS[a].size) - ['xl', 'l', 'm'].indexOf(PRINTERS[b].size))
  for (const m of all) {
    const slot = freePrinterSlot(s, PRINTERS[m].size, taken)
    if (!slot) return m
    taken.push(slot)
  }
  return null
}

export function buy(s: SimState, cart: CartLine[]): ActionResult {
  if (!cart.length) return fail('Cart is empty')
  if (!s.internet) return fail('No internet: the Shop is offline')
  const total = round2(cart.reduce((a, l) => a + cartPrice(l), 0))
  if (total > s.money) return fail('Not enough money')
  const newPrinters = cart.filter((l) => l.kind === 'printer').flatMap((l) => Array<PrinterModelId>(l.qty).fill(l.printer!))
  const noRoom = capacityCheck(s, newPrinters)
  if (noRoom) return fail(`No room for the ${PRINTERS[noRoom].name} in the garage (needs a ${PRINTERS[noRoom].size.toUpperCase()} slot)`)
  const dryers = cart.filter((l) => l.kind === 'upgrade' && l.upgrade === 'dryer').reduce((a, l) => a + l.qty, 0)
  if (dryers && s.dryers.length + pendingDryers(s) + dryers > MAX_DRYERS) return fail(`Room for ${MAX_DRYERS} dryers at most`)
  if (cart.some((l) => l.kind === 'upgrade' && l.upgrade === 'ups') && s.upgrades.ups) return fail('You already have a UPS')
  for (const l of cart) {
    const cat = l.kind === 'spool' ? 'filament' : l.kind === 'supply' ? 'supplies' : l.kind === 'upgrade' ? 'upgrades' : 'printers'
    const name = l.kind === 'spool' ? `${COLORS[l.color!].name} ${l.material} ×${l.qty}` : l.kind === 'supply' ? `${SUPPLIES[l.supply!].name} ×${l.qty}` : l.kind === 'upgrade' ? UPGRADES[l.upgrade!].name : `${PRINTERS[l.printer!].brand} ${PRINTERS[l.printer!].name}`
    ledger(s, -cartPrice(l), cat, name)
    todayStats(s).costs += cartPrice(l)
  }
  let arriveAt = dayStartTime(s.day + 1) + (DELIVERY_TIME - DAY_START)
  if (s.incidents.some((i) => i.type === 'supplier_delay' && i.day === s.day + 1)) arriveAt += 1440
  for (const l of cart.filter((x) => x.kind === 'printer')) {
    for (let i = 0; i < l.qty; i++) s.crates.push({ id: id(s, 'c'), contents: [{ kind: 'printer', printer: l.printer, qty: 1 }], arriveAt, arrived: false, opened: false, big: true })
  }
  const rest: DeliveryContent[] = cart.filter((x) => x.kind !== 'printer').map((l) => ({ ...l }))
  if (rest.length) s.crates.push({ id: id(s, 'c'), contents: rest, arriveAt, arrived: false, opened: false, big: false })
  emit(s, { type: 'info', message: 'Order placed. Delivery tomorrow at 08:30' })
  return OK
}

export function openCrate(s: SimState, crateId: string): ActionResult {
  const c = s.crates.find((x) => x.id === crateId)
  if (!c || !c.arrived || c.opened) return fail('Nothing to open')
  const spools = c.contents.filter((x) => x.kind === 'spool').reduce((a, x) => a + x.qty, 0)
  const freeSlots = SHELF_SPOOL_SLOTS - s.spools.filter((x) => x.loc.t === 'shelf').length
  if (spools > freeSlots) return fail('Not enough room on the filament shelf')
  const printer = c.contents.find((x) => x.kind === 'printer')
  if (printer && !freePrinterSlot(s, PRINTERS[printer.printer!].size)) return fail(`No free ${PRINTERS[printer.printer!].size.toUpperCase()} slot for this printer`)
  for (const x of c.contents) {
    if (x.kind === 'spool') for (let i = 0; i < x.qty; i++) newSpool(s, x.material!, x.color!)
    if (x.kind === 'supply') {
      const sup = SUPPLIES[x.supply!]
      if (sup.kind === 'box') s.supplies[`box_${sup.size}`] += sup.qty * x.qty
      else if (sup.kind === 'paper') s.supplies.paper += sup.qty * x.qty
      else s.parts[sup.part] += sup.qty * x.qty
    }
    if (x.kind === 'upgrade') {
      if (x.upgrade === 'ups') s.upgrades.ups = true
      if (x.upgrade === 'dryer') for (let i = 0; i < x.qty; i++) if (s.dryers.length < MAX_DRYERS) newDryer(s, s.dryers.length)
    }
    if (x.kind === 'printer') {
      const p = newPrinter(s, x.printer!, freePrinterSlot(s, PRINTERS[x.printer!].size)!)
      emit(s, { type: 'info', message: `${PRINTERS[p.modelId].brand} ${PRINTERS[p.modelId].name} set up` })
    }
  }
  c.opened = true
  checkGoals(s)
  return OK
}

// ============================================================================= day cycle
export function canSleep(s: SimState) {
  return s.dayEnded || minuteOfDay(s.time) >= SLEEP_ALLOWED
}

/** Close the books for the current day. Returns the day's stats (for the report screen). */
export function endDay(s: SimState): DayStats {
  const st = todayStats(s)
  let kwh = 0
  for (const p of s.printers) {
    kwh += (p.printMinutesToday / 60) * PRINTERS[p.modelId].kw
    p.printMinutesToday = 0
  }
  kwh += s.dryers.filter((d) => d.slots.some(Boolean)).length * DRYER_KW * 10
  const cost = round2(kwh * ELECTRICITY_PER_KWH)
  if (cost > 0) {
    ledger(s, -cost, 'electricity', `Electricity (${kwh.toFixed(1)} kWh)`)
    st.costs += cost
  }
  st.repEnd = s.reputation
  return { ...st }
}

/** Sleep through the night: printers keep running; wakes up at 08:00 next day. */
export function sleepUntilMorning(s: SimState) {
  const target = dayStartTime(s.day + 1)
  s.dayEnded = false
  while (s.time < target) {
    const step = Math.min(1, target - s.time)
    s.time += step
    for (const c of s.crates) if (!c.arrived && s.time >= c.arriveAt) c.arrived = true
    if (!s.power) s.outageMin += step
    updateMoisture(s, step)
    for (const p of s.printers) updatePrinter(s, p, step)
  }
  // outages don't last overnight
  for (const inc of s.incidents) if (inc.started && !inc.ended) endIncident(s, inc)
  s.day = dayOf(s.time)
  s.time = target
  s.courierTime = COURIER_TIME
  todayStats(s)
  morning(s)
  checkGoals(s)
}

function morning(s: SimState) {
  // reviews for orders shipped yesterday
  for (const o of s.orders) {
    if (o.status !== 'shipped' || o.reviewed) continue
    o.reviewed = true
    let stars = o.grade === 'A+' ? 5 : o.grade === 'A' ? 5 : o.grade === 'B' ? 4 : o.grade === 'C' ? 2 : 1
    if (o.late) stars -= 1
    let broken = false
    if (!o.padded && rand(s) < 0.2) {
      stars -= 2
      broken = true
    }
    if (o.defect === 'layer_shift' || o.defect === 'color_mix' || o.defect === 'stringing') stars = Math.min(stars, 2)
    if (rand(s) < 0.15 && stars < 5 && !broken) stars += 1
    stars = Math.max(1, Math.min(5, stars))
    const text = broken ? 'Arrived broken. Please pack better!' : o.defect === 'stringing' ? 'Covered in strings. Was the filament wet?' : pick(s, REVIEW_TEXT[stars])
    s.reviews.unshift({ day: s.day, orderId: o.id, customer: o.customer, stars, text })
    s.reputation = Math.round((s.reputation + (stars - s.reputation) * 0.1) * 100) / 100
    emit(s, { type: 'review', stars, customer: o.customer })
    if (stars === 1) {
      ledger(s, -o.price, 'refunds', `Refund #${o.number}`)
      addMail(s, { from: o.email, fromName: o.customer, kind: 'complaint', subject: `Refund for order #${o.number}`, body: `Hi,\n\nI received my ${PRODUCTS[o.productId].name} and I'm really not happy with it. I've requested a refund through LayerGoods.\n\n${o.customer.split(' ')[0]}` })
    }
  }
  for (const o of s.orders) {
    if (o.status !== 'shipped' && o.status !== 'cancelled' && s.day > o.dueDay && !o.complained) {
      o.complained = true
      s.reputation = Math.max(0, Math.round((s.reputation - 0.08) * 100) / 100)
      addMail(s, { from: o.email, fromName: o.customer, kind: 'complaint', subject: `Where is my order #${o.number}?`, body: `Hello,\n\nMy ${PRODUCTS[o.productId].name} was supposed to ship by day ${o.dueDay} and I haven't received a tracking number yet. Any update?\n\n${o.customer.split(' ')[0]}`, orderId: o.id })
    }
  }
  for (const m of s.mail) {
    if (m.counterAt !== undefined && !m.counterResolved && m.request) {
      m.counterResolved = true
      const r = m.request
      if (rand(s) < 0.6) {
        const price = Math.round(r.price * 1.5)
        const prod = PRODUCTS[r.productId]
        const o = addOrder(s, { source: 'email', customer: r.customer, email: r.email, city: r.city, productId: r.productId, material: r.material, colors: [r.color], price, dueDay: s.day + (prod.hours >= 5 ? 4 : 3) })
        addMail(s, { from: r.email, fromName: r.customer, kind: 'request', subject: `Re: ${m.subject}`, body: `Deal! $${price} works for me. Looking forward to it.\n\n${r.customer.split(' ')[0]}`, orderId: o.id })
      } else {
        addMail(s, { from: r.email, fromName: r.customer, kind: 'info', subject: `Re: ${m.subject}`, body: `That's a bit over my budget, sorry. I'll look elsewhere.\n\n${r.customer.split(' ')[0]}` })
      }
    }
  }
  // today's conditions
  rollIncidents(s)
  const announced = todayIncidents(s).filter((i) => INCIDENTS[i.type].announced)
  if (announced.length) {
    const lines = announced.map((i) => {
      const d = INCIDENTS[i.type]
      const extra = i.type === 'viral_product' && i.productId ? ` Trending: ${PRODUCTS[i.productId].name}.` : i.type === 'firmware_update' && i.printerId ? ` Printer: ${PRINTERS[getPrinter(s, i.printerId)!.modelId].name}.` : ''
      return `${d.icon} ${d.name}: ${d.blurb}${extra}`
    })
    addMail(s, { from: 'assistant@garage.test', fromName: 'Garage Assistant', kind: 'system', subject: `Today, day ${s.day}: ${announced.map((i) => INCIDENTS[i.type].name).join(', ')}`, body: `Good morning! Here's what today looks like:\n\n${lines.join('\n\n')}` })
    for (const i of announced) emit(s, { type: 'incident', incident: i.type })
  }
  const crates = s.crates.filter((c) => c.arrived && !c.opened).length
  if (crates) emit(s, { type: 'info', message: `${crates} deliver${crates > 1 ? 'ies' : 'y'} waiting by the garage door` })
  if (s.day === 2) {
    addMail(s, { from: 'deals@filadepot.test', fromName: 'FilaDepot', kind: 'supplier', subject: 'New printers & multicolour season!', body: "Hi maker!\n\nNew in store: the Bamboo Lab A1 with AMS lite and the Snapmakr U1 toolchanger: multicolour prints are the hottest thing on LayerGoods right now. Also new: spare nozzles, fans, IPA, filament dryers and a UPS for those pesky power cuts.\n\nOrder before midnight for delivery tomorrow at 08:30.\n\nHappy printing,\nFilaDepot" })
  }
}

// ============================================================================= goals
export function checkGoals(s: SimState) {
  for (const g of GOALS) {
    if (s.goalsDone.includes(g.id)) continue
    if (g.tutorial) {
      const prev = GOALS.filter((x) => x.tutorial)
      const idx = prev.findIndex((x) => x.id === g.id)
      if (idx > 0 && !s.goalsDone.includes(prev[idx - 1].id)) continue
    }
    if (g.done(s)) {
      s.goalsDone.push(g.id)
      emit(s, { type: 'goal', goalId: g.id })
    }
  }
}

export function drainEvents(s: SimState): SimEvent[] {
  const e = s.events
  s.events = []
  return e
}

/** Load a save; migrates version-1 saves (M1/M1.1) to version 2. */
export function migrate(raw: unknown): SimState | null {
  const s = raw as SimState & { printers: (Printer & { spoolId?: string | null; slot: string | number })[] }
  if (!s || typeof s !== 'object') return null
  if (s.version === 1) {
    for (const p of s.printers) {
      const old = p as unknown as { spoolId?: string | null; slot: number | string }
      p.slot = typeof old.slot === 'number' ? `A${old.slot}` : old.slot
      p.spools = [old.spoolId ?? null]
      delete old.spoolId
      p.error = null
      p.wear = { nozzleH: 0, beltH: 0, plate: 0 }
      p.fwPending = false
      p.updateLeft = 0
      p.resumeStatus = null
      if (p.job) {
        const j = p.job as Job & { color?: ColorId }
        j.colors = [j.color ?? 'black']
        j.tools = [0]
        j.error = null
        j.moisture = 0
      }
    }
    for (const sp of s.spools) {
      sp.moisture = sp.moisture ?? 0.1
      sp.sealed = sp.sealed ?? false
      if (sp.loc.t === 'printer') (sp.loc as { tool: number }).tool = 0
    }
    for (const o of s.orders) o.colors = o.colors ?? [o.color]
    for (const it of s.items) it.colors = it.colors ?? [it.color]
    s.dryers = s.dryers ?? []
    s.parts = s.parts ?? { nozzle: 1, fan: 0, ipa: 5 }
    s.upgrades = s.upgrades ?? { ups: false }
    s.incidents = []
    s.power = true
    s.internet = true
    s.outageMin = 0
    s.missedOrders = 0
    s.courierTime = COURIER_TIME
    for (const st of s.stats) st.errors = st.errors ?? 0
    s.version = 2
  }
  if (s.version !== SAVE_VERSION) return null
  s.events = []
  s.failSeed ??= (s.seed ^ 0x5bd1e995) >>> 0 || 7
  s.jobsCreated ??= s.orders.filter((o) => o.status !== 'new').length
  if (!s.dryers.length) s.dryers.push({ id: `d${s.nextId++}`, spot: 0, slots: [null, null] })
  return s
}
