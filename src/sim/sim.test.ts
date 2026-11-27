import { describe, expect, it } from 'vitest'
import {
  buy, canSleep, clearBed, coldPull, createInitialState, drainEvents, endDay, getPrinter, loadSpool, migrate, minuteOfDay,
  openCrate, packItem, pickPackedBox, placeInOutbox, placeOnTable, readMail, removePrint, replyMail, sendJob,
  shelveSpool, sleepUntilMorning, startFromUsb, takeSpool, tick, unloadSpool,
} from './sim'
import type { SimState } from './types'

const ender = (s: SimState) => s.printers[0]

function runUntil(s: SimState, cond: (s: SimState) => boolean, maxMinutes = 3000) {
  for (let i = 0; i < maxMinutes && !cond(s); i++) tick(s, 1)
  return s
}

/** Find a seed whose first Ender job does not fail (failures are random by design). */
function cleanSeed(from = 1): SimState {
  for (let seed = from; seed < from + 500; seed++) {
    const s = createInitialState(seed)
    sendJob(s, s.orders[0].id, ender(s).id, 'standard')
    if (!ender(s).job!.failure) return s
  }
  throw new Error('no clean seed')
}

describe('initial state', () => {
  it('starts on day 1 at 08:00 with one Endr-3, spools, mails and an order', () => {
    const s = createInitialState(1)
    expect(s.day).toBe(1)
    expect(minuteOfDay(s.time)).toBe(8 * 60)
    expect(s.printers.map((p) => p.modelId)).toEqual(['ender3v3'])
    expect(s.spools.length).toBe(5)
    expect(s.mail.length).toBe(2)
    expect(s.orders[0]).toMatchObject({ productId: 'benchy', color: 'black', status: 'new' })
  })
})

describe('full order loop (USB printer)', () => {
  it('order → slice → start from USB → print → remove → pack → outbox → courier → money', () => {
    const s = cleanSeed()
    const p = ender(s)
    const order = s.orders[0]
    readMail(s, s.mail[0].id)
    expect(p.status).toBe('waiting_usb')
    expect(startFromUsb(s, p.id).ok).toBe(true)
    expect(p.status).toBe('heating')
    runUntil(s, () => p.status === 'done')
    expect(p.bedItemId).toBeTruthy()
    expect(removePrint(s, p.id).ok).toBe(true)
    expect(s.held?.kind).toBe('item')
    expect(placeOnTable(s).ok).toBe(true)
    const item = s.items.find((i) => i.loc.t === 'table')!
    expect(packItem(s, item.id, 's', true).ok).toBe(true)
    expect(s.supplies.box_s).toBe(9)
    expect(pickPackedBox(s).ok).toBe(true)
    expect(placeInOutbox(s).ok).toBe(true)
    expect(order.status).toBe('in_outbox')
    const before = s.money
    runUntil(s, () => minuteOfDay(s.time) >= 17 * 60 + 1)
    expect(order.status).toBe('shipped')
    expect(s.money).toBeGreaterThan(before)
    expect(s.goalsDone).toEqual(expect.arrayContaining(['slice', 'start_usb', 'wait', 'remove', 'pack', 'outbox', 'ship']))
  })

  it('refuses to pack into a box that is too small', () => {
    const s = cleanSeed()
    const p = ender(s)
    // swap the order to a helmet (needs L)
    s.orders[0].productId = 'helmet'
    p.job!.productId = 'helmet'
    startFromUsb(s, p.id)
    runUntil(s, () => p.status === 'done', 5000)
    removePrint(s, p.id)
    placeOnTable(s)
    const item = s.items.find((i) => i.loc.t === 'table')!
    const r = packItem(s, item.id, 's', true)
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/Too small/)
  })
})

describe('Wi-Fi printers and filament', () => {
  it('requires the right filament before sending', () => {
    const s = createInitialState(3)
    s.money = 5000
    buy(s, [{ kind: 'printer', printer: 'mk4', qty: 1 }])
    sleepUntilMorning(s)
    tick(s, 31) // deliveries arrive at 08:30
    expect(openCrate(s, s.crates[0].id).ok).toBe(true)
    const mk4 = s.printers.find((p) => p.modelId === 'mk4')!
    const o = s.orders[0] // black PLA benchy
    expect(sendJob(s, o.id, mk4.id, 'standard').error).toMatch(/Load Black PLA/)
    // move black spool from Ender to MK4
    unloadSpool(s, ender(s).id)
    expect(loadSpool(s, mk4.id).ok).toBe(true)
    expect(sendJob(s, o.id, mk4.id, 'standard').ok).toBe(true)
    expect(mk4.status).toBe('heating')
  })

  it('pauses on runout and resumes when a matching spool is loaded', () => {
    for (let seed = 1; seed < 300; seed++) {
      const s = createInitialState(seed)
      const p = ender(s)
      s.spools.find((x) => x.id === p.spools[0])!.grams = 5 // almost empty; benchy needs 15 g
      sendJob(s, s.orders[0].id, p.id, 'standard')
      if (p.job!.failure) continue
      startFromUsb(s, p.id)
      runUntil(s, () => p.status === 'paused_runout' || p.status === 'done')
      expect(p.status).toBe('paused_runout')
      expect(drainEvents(s).some((e) => e.type === 'runout')).toBe(true)
      unloadSpool(s, p.id)
      s.held = null // throw the empty spool away
      // give the player a fresh black spool
      const fresh = s.spools.find((x) => x.loc.t === 'shelf')!
      fresh.color = 'black'
      takeSpool(s, fresh.id)
      expect(loadSpool(s, p.id).ok).toBe(true)
      expect(p.status).toBe('printing')
      runUntil(s, () => p.status === 'done')
      expect(p.status).toBe('done')
      return
    }
    throw new Error('no seed')
  })

  it('shelves and takes spools', () => {
    const s = createInitialState(1)
    const sp = s.spools.find((x) => x.loc.t === 'shelf')!
    expect(takeSpool(s, sp.id).ok).toBe(true)
    expect(takeSpool(s, s.spools.find((x) => x.loc.t === 'shelf')!.id).ok).toBe(false) // hands full
    expect(shelveSpool(s).ok).toBe(true)
    expect(s.held).toBeNull()
  })
})

describe('failures', () => {
  it('spaghetti: item is a failure, order goes back to new, bed can be cleared', () => {
    for (let seed = 1; seed < 2000; seed++) {
      const s = createInitialState(seed)
      s.jobsCreated = 1 // skip the tutorial grace
      const p = ender(s)
      sendJob(s, s.orders[0].id, p.id, 'standard')
      if (p.job!.failure?.type !== 'spaghetti') continue
      startFromUsb(s, p.id)
      runUntil(s, () => p.status === 'done' || p.status === 'paused_runout')
      const item = s.items.find((i) => i.id === p.bedItemId)!
      expect(item.defect).toBe('spaghetti')
      expect(s.orders[0].status).toBe('new')
      expect(clearBed(s, p.id).ok).toBe(true)
      expect(p.status).toBe('idle')
      return
    }
    throw new Error('no spaghetti seed')
  })

  it('clog marks the printer for maintenance; cold pull fixes it', () => {
    for (let seed = 1; seed < 3000; seed++) {
      const s = createInitialState(seed)
      s.jobsCreated = 1 // skip the tutorial grace
      const p = ender(s)
      sendJob(s, s.orders[0].id, p.id, 'standard')
      if (p.job!.failure?.type !== 'clog') continue
      startFromUsb(s, p.id)
      runUntil(s, () => p.status === 'done')
      expect(p.needsMaintenance).toBe(true)
      clearBed(s, p.id)
      expect(coldPull(s, p.id).ok).toBe(true)
      expect(p.needsMaintenance).toBe(false)
      return
    }
    throw new Error('no clog seed')
  })

  it('cancelling mid-print resets the order', () => {
    const s = cleanSeed()
    const p = ender(s)
    startFromUsb(s, p.id)
    tick(s, 20)
    expect(clearBed(s, p.id).ok).toBe(true)
    expect(s.orders[0].status).toBe('new')
    expect(p.job).toBeNull()
  })
})

describe('shop, deliveries, mail, day cycle', () => {
  it('buying creates a crate that arrives next morning and unpacks to the shelf', () => {
    const s = createInitialState(1)
    const money = s.money
    expect(buy(s, [{ kind: 'spool', material: 'PETG', color: 'orange', qty: 2 }, { kind: 'supply', supply: 'box_m', qty: 1 }]).ok).toBe(true)
    expect(s.money).toBeCloseTo(money - 46 - 9)
    expect(openCrate(s, s.crates[0].id).ok).toBe(false) // not arrived yet
    sleepUntilMorning(s)
    expect(s.day).toBe(2)
    expect(s.crates[0].arrived).toBe(false)
    tick(s, 31)
    expect(s.crates[0].arrived).toBe(true)
    const before = s.supplies.box_m
    expect(openCrate(s, s.crates[0].id).ok).toBe(true)
    expect(s.spools.filter((x) => x.color === 'orange').length).toBe(2)
    expect(s.supplies.box_m).toBe(before + 10)
  })

  it('cannot buy more printers than garage slots (size classes)', () => {
    const s = createInitialState(1)
    s.money = 99999
    // M printers fit the bench (4) and the wide table (3); one bench slot is taken by the Endr-3
    expect(buy(s, [{ kind: 'printer', printer: 'p1s', qty: 7 }]).ok).toBe(false)
    expect(buy(s, [{ kind: 'printer', printer: 'p1s', qty: 6 }]).ok).toBe(true)
  })

  it('email requests can be accepted into orders', () => {
    const s = createInitialState(1)
    runUntil(s, () => s.mail.some((m) => m.kind === 'request'))
    const m = s.mail.find((x) => x.kind === 'request')!
    readMail(s, m.id)
    const n = s.orders.length
    expect(replyMail(s, m.id, 'accept').ok).toBe(true)
    expect(s.orders.length).toBe(n + 1)
    expect(s.orders[s.orders.length - 1].source).toBe('email')
    expect(replyMail(s, m.id, 'accept').ok).toBe(false)
  })

  it('sleep is only allowed after 17:00; the day ends with a report; reviews arrive next morning', () => {
    const s = cleanSeed()
    expect(canSleep(s)).toBe(false)
    const p = ender(s)
    startFromUsb(s, p.id)
    runUntil(s, () => p.status === 'done')
    removePrint(s, p.id); placeOnTable(s)
    packItem(s, s.items.find((i) => i.loc.t === 'table')!.id, 's', true)
    pickPackedBox(s); placeInOutbox(s)
    runUntil(s, () => minuteOfDay(s.time) >= 17 * 60 + 5)
    expect(canSleep(s)).toBe(true)
    const report = endDay(s)
    expect(report.shipped).toBe(1)
    sleepUntilMorning(s)
    expect(s.day).toBe(2)
    expect(minuteOfDay(s.time)).toBe(8 * 60)
    expect(s.reviews.length).toBe(1)
  })

  it('forces the end of the day at 23:00', () => {
    const s = createInitialState(1)
    runUntil(s, () => s.dayEnded, 2000)
    expect(minuteOfDay(s.time)).toBeGreaterThanOrEqual(23 * 60)
    expect(drainEvents(s).some((e) => e.type === 'day_end')).toBe(true)
  })
})

describe('fairness and determinism', () => {
  it('tutorial grace: the very first print never fails', () => {
    for (let seed = 1; seed < 400; seed++) {
      const s = createInitialState(seed)
      sendJob(s, s.orders[0].id, ender(s).id, 'draft')
      expect(ender(s).job!.failure).toBeNull()
    }
  })

  it('is frame-rate independent: same orders whether ticked in 1 min or 0.07 min steps', () => {
    const a = createInitialState(9)
    const b = createInitialState(9)
    for (let i = 0; i < 600; i++) tick(a, 1)
    for (let i = 0; i < Math.round(600 / 0.07); i++) tick(b, 0.07)
    tick(b, 600 - Math.round(600 / 0.07) * 0.07)
    expect(b.orders.map((o) => [o.productId, o.color])).toEqual(a.orders.map((o) => [o.productId, o.color]))
  })
})

describe('determinism and saves', () => {
  it('same seed + same actions → identical state', () => {
    const run = () => {
      const s = createInitialState(77)
      sendJob(s, s.orders[0].id, ender(s).id, 'fine')
      startFromUsb(s, ender(s).id)
      runUntil(s, () => s.time > 8 * 60 + 700)
      drainEvents(s)
      return s
    }
    expect(run()).toEqual(run())
  })

  it('survives a JSON round-trip', () => {
    const s = createInitialState(5)
    tick(s, 120)
    const copy = migrate(JSON.parse(JSON.stringify(s)))!
    expect(copy.orders.length).toBe(s.orders.length)
    tick(copy, 10)
    expect(copy.time).toBe(s.time + 10)
  })

  it('printer lookup helper works', () => {
    const s = createInitialState(1)
    expect(getPrinter(s, ender(s).id)?.modelId).toBe('ender3v3')
  })
})

// =============================================================================================== M2 systems
import {
  assignTools, capacityCheck, cleanPlate, estimateJob, fixError, freePrinterSlot, jobCheck, putInDryer, removePrint as rp,
  takeFromDryer, updateFirmware,
} from './sim'
import type { Printer, Spool } from './types'
import type { ColorId } from '../data/filaments'

/** Give the player a printer without going through the shop. */
function addPrinter(s: SimState, modelId: Printer['modelId']) {
  s.money = 99999
  buy(s, [{ kind: 'printer', printer: modelId, qty: 1 }])
  const c = s.crates[s.crates.length - 1]
  c.arrived = true
  openCrate(s, c.id)
  return s.printers[s.printers.length - 1]
}
function giveSpool(s: SimState, color: ColorId, moisture = 0): Spool {
  const sp: Spool = { id: `t${s.nextId++}`, material: 'PLA', color, grams: 1000, moisture, sealed: false, loc: { t: 'held' } }
  s.spools.push(sp)
  s.held = { kind: 'spool', id: sp.id }
  return sp
}
function orderFor(s: SimState, productId: SimState['orders'][number]['productId'], colors: ColorId[]) {
  const o = { ...s.orders[0], id: `ox${s.nextId++}`, number: 9000 + s.nextId, productId, colors, color: colors[0], status: 'new' as const }
  s.orders.push(o)
  return o
}

describe('M2: garage slots by size class', () => {
  it('places printers in fitting slots; XL only on the cart', () => {
    const s = createInitialState(1)
    expect(freePrinterSlot(s, 'm')).toBe('A0')
    const a1 = addPrinter(s, 'a1')
    expect(a1.slot).toBe('B0')
    const xl = addPrinter(s, 'xl')
    expect(xl.slot).toBe('X0')
    expect(capacityCheck(s, ['xl'])).toBe('xl') // the one XL cart is taken
  })
})

describe('M2: multi-tool printers and multicolour orders', () => {
  it('single-tool printers reject multicolour products; the A1 + AMS accepts them', () => {
    const s = createInitialState(1)
    const o = orderFor(s, 'benchy_mc', ['red', 'blue', 'white'])
    expect(jobCheck(s, ender(s), o, true).error).toMatch(/3 colours/)
    const a1 = addPrinter(s, 'a1')
    expect(jobCheck(s, a1, o).error).toMatch(/Load/)
    for (const c of ['red', 'blue', 'white'] as ColorId[]) {
      giveSpool(s, c)
      expect(loadSpool(s, a1.id).ok).toBe(true)
    }
    expect(a1.spools.filter(Boolean).length).toBe(3)
    expect(assignTools(s, a1, 'PLA', o.colors).tools).toEqual([0, 1, 2])
    expect(sendJob(s, o.id, a1.id, 'standard').ok).toBe(true)
    expect(a1.job!.colors).toEqual(['red', 'blue', 'white'])
  })

  it('AMS colour changes cost more time and purge than a toolchanger', () => {
    const ams = estimateJob('a1', 'dragon_mc', 'standard')
    const tc = estimateJob('u1', 'dragon_mc', 'standard')
    expect(ams.purge).toBe(45)
    expect(tc.purge).toBe(6)
    // same product: AMS +25%/extra colour at speed 0.60 vs toolchanger +5%/extra colour at speed 0.65
    expect(ams.minutes / tc.minutes).toBeCloseTo((0.6 * 1.75) / (0.65 * 1.15), 1)
  })

  it('XL-only parts need a big enough build volume', () => {
    const s = createInitialState(1)
    const o = orderFor(s, 'chestplate', ['grey'])
    const mk4 = addPrinter(s, 'mk4')
    expect(jobCheck(s, mk4, o, true).error).toMatch(/Too big/)
    const xl = addPrinter(s, 'xl')
    expect(jobCheck(s, xl, o, true).ok).toBe(true)
  })
})

describe('M2: filament moisture and dryers', () => {
  it('opened spools absorb moisture, sealed ones do not; humid days triple it', () => {
    const s = createInitialState(1)
    const sealed = s.spools.find((x) => x.sealed)!
    const open = s.spools.find((x) => !x.sealed && x.loc.t === 'shelf' && x.color === 'white')!
    const m0 = open.moisture
    tick(s, 600)
    expect(sealed.moisture).toBe(0)
    expect(open.moisture).toBeCloseTo(m0 + 0.04, 3)
    s.incidents.push({ type: 'humid_day', day: 1, start: s.time - 1, end: s.time + 1000, started: true })
    const m1 = open.moisture
    tick(s, 60)
    expect(open.moisture - m1).toBeCloseTo(0.012, 4)
  })

  it('the dryer takes spools, dries them ~12%/h and gives them back', () => {
    const s = createInitialState(1)
    const blue = s.spools.find((x) => x.color === 'blue')!
    expect(blue.moisture).toBeGreaterThan(0.4)
    takeSpool(s, blue.id)
    expect(putInDryer(s, s.dryers[0].id).ok).toBe(true)
    tick(s, 120)
    expect(blue.moisture).toBeCloseTo(0.48 - 0.24, 2)
    tick(s, 180)
    expect(blue.moisture).toBe(0)
    expect(takeFromDryer(s, s.dryers[0].id).ok).toBe(true)
    expect(s.held?.id).toBe(blue.id)
  })

  it('wet filament caps the grade and causes stringing', () => {
    for (let seed = 1; seed < 200; seed++) {
      const s = createInitialState(seed)
      s.jobsCreated = 1
      const p = ender(s)
      getSpoolById(s, p.spools[0]!).moisture = 0.7
      sendJob(s, s.orders[0].id, p.id, 'standard')
      if (p.job!.failure || p.job!.error) continue
      startFromUsb(s, p.id)
      runUntil(s, () => p.status === 'done')
      const it = s.items.find((i) => i.id === p.bedItemId)!
      expect(it.grade).toBe('C')
      expect(it.defect).toBe('stringing')
      return
    }
    throw new Error('no clean seed')
  })
})
const getSpoolById = (s: SimState, sid: string) => s.spools.find((x) => x.id === sid)!

describe('M2: machine errors, spare parts and maintenance', () => {
  it('a paused error (fan failure) needs a spare part, then the print resumes', () => {
    const s = createInitialState(3)
    const p = ender(s)
    sendJob(s, s.orders[0].id, p.id, 'standard')
    p.job!.failure = null
    p.job!.error = { code: 'E302', at: 0.3 }
    startFromUsb(s, p.id)
    runUntil(s, () => p.status === 'error')
    expect(p.error?.code).toBe('E302')
    expect(p.job).not.toBeNull()
    s.parts.fan = 0
    expect(fixError(s, p.id).error).toMatch(/spare fan/)
    s.parts.fan = 1
    expect(fixError(s, p.id).ok).toBe(true)
    expect(p.status).toBe('printing')
    runUntil(s, () => p.status === 'done')
    expect(s.items.find((i) => i.id === p.bedItemId)!.grade).not.toBe('F')
  })

  it('an aborting error (thermal runaway) loses the job and leaves a failed part', () => {
    const s = createInitialState(3)
    const p = ender(s)
    sendJob(s, s.orders[0].id, p.id, 'standard')
    p.job!.failure = null
    p.job!.error = { code: 'E101', at: 0.5 }
    startFromUsb(s, p.id)
    runUntil(s, () => p.status === 'error')
    expect(p.job).toBeNull()
    expect(s.orders[0].status).toBe('new')
    expect(fixError(s, p.id).ok).toBe(true)
    expect(p.status).toBe('done')
    expect(clearBed(s, p.id).ok).toBe(true)
  })

  it('plate wear grows per print; cleaning with IPA resets it', () => {
    const s = createInitialState(1)
    const p = ender(s)
    p.wear.plate = 9
    const ipa = s.parts.ipa
    expect(cleanPlate(s, p.id).ok).toBe(true)
    expect(p.wear.plate).toBe(0)
    expect(s.parts.ipa).toBe(ipa - 1)
  })

  it('firmware updates take 15 minutes while idle', () => {
    const s = createInitialState(1)
    const mk4 = addPrinter(s, 'mk4')
    mk4.fwPending = true
    expect(updateFirmware(s, mk4.id).ok).toBe(true)
    expect(mk4.status).toBe('updating')
    tick(s, 16)
    expect(mk4.status).toBe('idle')
    expect(mk4.fwPending).toBe(false)
  })
})

describe('M2: daily incidents', () => {
  function outage(s: SimState, type: 'power_outage' | 'internet_outage', len: number) {
    s.incidents.push({ type, day: s.day, start: Math.ceil(s.time) + 1, end: Math.ceil(s.time) + 1 + len })
  }

  it('power cut: the Endr-3 (no recovery) loses its print, the MK4 resumes', () => {
    const s = createInitialState(5)
    s.jobsCreated = 1
    const mk4 = addPrinter(s, 'mk4')
    const p = ender(s)
    sendJob(s, s.orders[0].id, p.id, 'draft')
    p.job!.failure = null
    p.job!.error = null
    startFromUsb(s, p.id)
    const o2 = orderFor(s, 'clips', ['black'])
    giveSpool(s, 'black')
    loadSpool(s, mk4.id)
    sendJob(s, o2.id, mk4.id, 'standard')
    mk4.job!.failure = null
    mk4.job!.error = null
    tick(s, 10)
    outage(s, 'power_outage', 90)
    tick(s, 5)
    expect(s.power).toBe(false)
    expect(p.status).toBe('paused_power')
    expect(mk4.status).toBe('paused_power')
    tick(s, 100)
    expect(s.power).toBe(true)
    expect(p.status).toBe('done')
    expect(s.items.find((i) => i.id === p.bedItemId)!.defect).toBe('power_loss')
    expect(['printing', 'done']).toContain(mk4.status)
  })

  it('a UPS rides through the first hour of a power cut', () => {
    const s = createInitialState(5)
    s.upgrades.ups = true
    const p = ender(s)
    sendJob(s, s.orders[0].id, p.id, 'fine')
    p.job!.failure = null
    p.job!.error = null
    startFromUsb(s, p.id)
    tick(s, 10)
    outage(s, 'power_outage', 120)
    tick(s, 30)
    expect(p.status).toBe('printing')
    tick(s, 40)
    expect(p.status).toBe('paused_power')
  })

  it('internet outage: no Wi-Fi jobs, no new orders; USB still works; missed orders arrive later', () => {
    const s = createInitialState(7)
    runUntil(s, () => minuteOfDay(s.time) >= 10 * 60) // after the scripted day-1 order
    const mk4 = addPrinter(s, 'mk4')
    giveSpool(s, 'black')
    loadSpool(s, mk4.id)
    outage(s, 'internet_outage', 240)
    tick(s, 2)
    expect(s.internet).toBe(false)
    expect(sendJob(s, s.orders[0].id, mk4.id, 'standard').error).toMatch(/No internet/)
    expect(sendJob(s, s.orders[0].id, mk4.id, 'standard', true).ok).toBe(true)
    expect(mk4.status).toBe('waiting_usb')
    const n = s.orders.length
    tick(s, 230)
    expect(s.orders.length).toBe(n)
    const missed = s.missedOrders
    tick(s, 20)
    expect(s.internet).toBe(true)
    expect(s.orders.length).toBeGreaterThanOrEqual(n + missed)
  })

  it('incidents are rolled from day 2 and announced by mail', () => {
    let announced = 0
    for (let seed = 1; seed < 40; seed++) {
      const s = createInitialState(seed)
      runUntil(s, () => s.dayEnded, 2000)
      endDay(s)
      sleepUntilMorning(s)
      if (s.mail.some((m) => m.fromName === 'Garage Assistant')) announced++
      expect(s.incidents.every((i) => i.day === 2)).toBe(true)
    }
    expect(announced).toBeGreaterThan(5)
  })

  it('courier late: pickup at 19:00', () => {
    const s = createInitialState(1)
    s.incidents.push({ type: 'courier_late', day: 1, start: s.time + 1, end: s.time + 900 })
    runUntil(s, () => minuteOfDay(s.time) >= 17 * 60 + 30)
    expect(s.courierDoneDay).toBe(0)
    runUntil(s, () => minuteOfDay(s.time) >= 19 * 60 + 1)
    expect(s.courierDoneDay).toBe(1)
  })
})

describe('M2: save migration', () => {
  it('migrates a version-1 save', () => {
    const s = createInitialState(2) as unknown as Record<string, unknown> & { printers: Record<string, unknown>[]; spools: Record<string, unknown>[]; orders: Record<string, unknown>[] }
    const v1 = JSON.parse(JSON.stringify(s))
    v1.version = 1
    for (const p of v1.printers) {
      p.spoolId = p.spools[0]
      delete p.spools
      p.slot = 1
    }
    for (const o of v1.orders) delete o.colors
    delete v1.dryers
    const m = migrate(v1)!
    expect(m.version).toBe(2)
    expect(m.printers[0].slot).toBe('A1')
    expect(m.printers[0].spools.length).toBe(1)
    expect(m.orders[0].colors).toEqual([m.orders[0].color])
    expect(m.dryers.length).toBe(1)
    void rp
  })
})
