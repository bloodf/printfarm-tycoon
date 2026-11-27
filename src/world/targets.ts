/**
 * Hover targets: title + context prompts for every interactable, derived from the current sim state.
 * CONTROLS brief: E = interact (tap or hold), F = secondary, G = drop.
 */
import * as THREE from 'three'
import { useGame, type HoverTarget, type Prompt } from '../game/store'
import {
  canSleep, cleanPlate, clearBed, coldPull, fixError, getItem, getPrinter, getSpool, heldItem, heldSpool, loadSpool, openCrate,
  pickFromFloor, pickFromTable, pickPackedBox, placeInOutbox, placeOnTable, putInDryer, removePrint, replaceNozzle,
  resumePrinter, shelveSpool, startFromUsb, takeFromDryer, takeFromOutbox, takeSpool, tensionBelts, trashHeld, unloadSpool,
  updateFirmware,
} from '../sim/sim'
import { PRINTERS } from '../data/printers'
import { COLORS, moistureLabel } from '../data/filaments'
import { ERRORS, WEAR } from '../data/errors'
import { PRODUCTS } from '../data/products'
import { machineStatus, screenOn } from './screens'
import { duration } from '../game/format'
import { runtime } from '../game/runtime'

const g = () => useGame.getState()
const sim = () => g().sim

function pos(v?: THREE.Vector3): [number, number, number] | undefined {
  return v ? [v.x, v.y + 0.3, v.z] : undefined
}

const handsFull = (label: string): Prompt => ({ key: 'interact', label, disabled: 'Hands full', run: () => {} })

export function printerTarget(pid: string): HoverTarget | null {
  const s = sim()
  const p = getPrinter(s, pid)
  if (!p) return null
  const m = PRINTERS[p.modelId]
  const st = machineStatus(p)
  const where = pos(runtime.printerPos.get(pid))
  let subtitle = st.label
  if (p.job && (p.status === 'printing' || p.status === 'heating')) {
    subtitle += ` · ${Math.floor((p.job.elapsedMin / p.job.durationMin) * 100)}% · ${duration(p.job.durationMin - p.job.elapsedMin)} left`
  }
  const loaded = p.spools.map((sid) => getSpool(s, sid))
  if (p.spools.length === 1) {
    const sp = loaded[0]
    subtitle += sp ? ` · ${COLORS[sp.color].name} ${sp.material} ${Math.round(sp.grams)} g · ${moistureLabel(sp.moisture).toLowerCase()}` : ' · no filament'
  } else subtitle += ` · ${loaded.filter(Boolean).length}/${p.spools.length} filament slots loaded`
  const prompts: Prompt[] = []
  const act = (fn: Parameters<ReturnType<typeof g>['act']>[0], sound: string, ok?: string) => () => g().act(fn, { sound, soundPos: where, ok })
  // ---- machine error first
  if (p.error) {
    const e = ERRORS[p.error.code]
    const missing = e.part && s.parts[e.part] <= 0
    prompts.push({ key: 'interact', label: `Fix ${e.code}: ${e.fix}`, hold: e.seconds, disabled: missing ? `Needs a spare ${e.part}: Shop → Parts` : undefined, run: act((x) => fixError(x, pid), 'spool_swap', `${e.title} fixed`) })
  }
  const hs = heldSpool(s)
  if (hs) {
    const free = p.spools.indexOf(null)
    prompts.push(free < 0
      ? { key: 'interact', label: `Load ${COLORS[hs.color].name} ${hs.material}`, disabled: p.spools.length > 1 ? 'All filament slots are full' : 'Unload the current spool first', run: () => {} }
      : { key: 'interact', label: `Load ${COLORS[hs.color].name} ${hs.material}${p.spools.length > 1 ? ` into slot ${free + 1}` : ''}`, run: act((x) => loadSpool(x, pid), 'spool_swap') })
  } else if (s.held) {
    prompts.push(handsFull('Printer'))
  } else {
    switch (p.status) {
      case 'waiting_usb':
        prompts.push({ key: 'interact', label: 'Start print from USB', disabled: !screenOn(s) ? 'No power' : undefined, run: act((x) => startFromUsb(x, pid), 'printer_beep') })
        break
      case 'done': {
        const it = getItem(s, p.bedItemId)
        if (it && it.grade === 'F') prompts.push({ key: 'interact', label: 'Scrape off the failed print', hold: 2.2, run: act((x) => clearBed(x, pid), 'spaghetti_rip') })
        else prompts.push({ key: 'interact', label: 'Remove print', hold: 1.1, run: act((x) => removePrint(x, pid), 'bed_flex_pop') })
        break
      }
      case 'heating':
      case 'printing':
        prompts.push({ key: 'interact', label: 'Cancel print & clear bed', hold: 2.5, run: act((x) => clearBed(x, pid), 'spaghetti_rip') })
        break
      case 'paused_runout': {
        const empty = p.spools.findIndex((sid) => sid && (getSpool(s, sid)?.grams ?? 1) <= 0)
        if (empty >= 0) prompts.push({ key: 'interact', label: `Unload the empty spool${p.spools.length > 1 ? ` (slot ${empty + 1})` : ''}`, run: act((x) => unloadSpool(x, pid, empty), 'spool_swap') })
        else prompts.push({ key: 'interact', label: 'Resume print', run: act((x) => resumePrinter(x, pid), 'printer_beep') })
        prompts.push({ key: 'secondary', label: 'Cancel print & clear bed', hold: 2.5, run: act((x) => clearBed(x, pid), 'spaghetti_rip') })
        break
      }
      case 'paused_power':
        prompts.push({ key: 'interact', label: 'Waiting for power…', disabled: 'Power outage', run: () => {} })
        break
      case 'updating':
        prompts.push({ key: 'interact', label: `Updating firmware (${Math.ceil(p.updateLeft)} min)`, disabled: 'Please wait', run: () => {} })
        break
      case 'idle':
        if (p.fwPending) prompts.push({ key: 'interact', label: 'Install firmware update (15 min)', run: act((x) => updateFirmware(x, pid), 'printer_beep') })
        if (p.needsMaintenance) prompts.push({ key: 'interact', label: 'Cold pull (clean the nozzle)', hold: 4, run: act((x) => coldPull(x, pid), 'spool_swap', 'Nozzle cleaned') })
        break
    }
    // unload any loaded tool when the printer isn't busy
    if (!['printing', 'heating', 'paused_power', 'updating'].includes(p.status)) {
      loaded.forEach((sp, i) => {
        if (sp && !(p.status === 'paused_runout' && sp.grams <= 0)) prompts.push({ key: 'secondary', label: `Unload ${COLORS[sp.color].name} ${sp.material}${p.spools.length > 1 ? ` (slot ${i + 1})` : ''}`, run: act((x) => unloadSpool(x, pid, i), 'spool_swap') })
      })
    }
    // maintenance when worn
    if (['idle', 'done'].includes(p.status)) {
      if (p.wear.plate >= WEAR.platePrints) prompts.push({ key: 'secondary', label: `Clean the build plate (IPA, ${s.parts.ipa} left)`, hold: 2, disabled: s.parts.ipa <= 0 ? 'No IPA: Shop → Parts' : undefined, run: act((x) => cleanPlate(x, pid), 'paper_crinkle', 'Plate cleaned') })
      if (p.wear.nozzleH >= WEAR.nozzleH) prompts.push({ key: 'secondary', label: `Replace the worn nozzle (${s.parts.nozzle} spare)`, hold: 4, disabled: s.parts.nozzle <= 0 ? 'No spare nozzle: Shop → Parts' : undefined, run: act((x) => replaceNozzle(x, pid), 'spool_swap', 'New nozzle fitted') })
      if (p.wear.beltH >= WEAR.beltH) prompts.push({ key: 'secondary', label: 'Tension the belts', hold: 3, run: act((x) => tensionBelts(x, pid), 'spool_swap', 'Belts tensioned') })
    }
  }
  prompts.push({ key: 'secondary', label: 'Printer screen & maintenance', run: () => g().open('printer', pid) })
  return { uid: `printer:${pid}`, title: `${m.brand} ${m.name}`, subtitle, prompts }
}

export function spoolTarget(spoolId: string): HoverTarget | null {
  const s = sim()
  const sp = getSpool(s, spoolId)
  if (!sp) return null
  const title = `${COLORS[sp.color].name} ${sp.material}`
  const subtitle = `${Math.round(sp.grams)} g · ${sp.sealed ? 'sealed (dry)' : `${moistureLabel(sp.moisture)} (${Math.round(sp.moisture * 100)}% moisture)`}`
  if (heldSpool(s)) return { uid: `spool:${spoolId}`, title, subtitle, prompts: [{ key: 'interact', label: 'Put your spool on the shelf', run: () => g().act(shelveSpool, { sound: 'spool_swap' }) }] }
  if (s.held) return { uid: `spool:${spoolId}`, title, subtitle, prompts: [handsFull('Take spool')] }
  return { uid: `spool:${spoolId}`, title, subtitle, prompts: [{ key: 'interact', label: 'Take spool', run: () => g().act((x) => takeSpool(x, spoolId), { sound: 'spool_swap' }) }] }
}

export function dryerTarget(dryerId: string): HoverTarget | null {
  const s = sim()
  const d = s.dryers.find((x) => x.id === dryerId)
  if (!d) return null
  const loaded = d.slots.map((sid) => getSpool(s, sid))
  const running = s.power && loaded.some(Boolean)
  const subtitle = loaded.some(Boolean)
    ? loaded.map((sp, i) => (sp ? `S${i + 1}: ${COLORS[sp.color].name} ${sp.material} ${Math.round(sp.moisture * 100)}%` : `S${i + 1}: empty`)).join(' · ') + (running ? ' · 55 °C' : s.power ? '' : ' · no power')
    : 'Empty · dries 2 spools at 55 °C (−12%/h)'
  const prompts: Prompt[] = []
  const hs = heldSpool(s)
  if (hs) {
    prompts.push(d.slots.includes(null)
      ? { key: 'interact', label: `Dry ${COLORS[hs.color].name} ${hs.material} (${Math.round(hs.moisture * 100)}%)`, run: () => g().act((x) => putInDryer(x, dryerId), { sound: 'spool_swap' }) }
      : { key: 'interact', label: 'Put spool in the dryer', disabled: 'Dryer is full', run: () => {} })
  } else if (!s.held) {
    loaded.forEach((sp, i) => {
      if (sp) prompts.push({ key: i === 0 ? 'interact' : 'secondary', label: `Take out ${COLORS[sp.color].name} ${sp.material} (${Math.round(sp.moisture * 100)}%)`, run: () => g().act((x) => takeFromDryer(x, dryerId, i), { sound: 'spool_swap' }) })
    })
  } else prompts.push(handsFull('Dryer'))
  return { uid: `dryer:${dryerId}`, title: 'Filament dryer', subtitle, prompts }
}

export function shelfTarget(): HoverTarget {
  const s = sim()
  const hs = heldSpool(s)
  const count = s.spools.filter((x) => x.loc.t === 'shelf').length
  return {
    uid: 'shelf', title: 'Filament shelf', subtitle: `${count} spools stored`,
    prompts: hs ? [{ key: 'interact', label: `Store ${COLORS[hs.color].name} ${hs.material}`, run: () => g().act(shelveSpool, { sound: 'spool_swap' }) }] : [],
  }
}

export function packingTableTarget(): HoverTarget {
  const s = sim()
  const hi = heldItem(s)
  const onTable = s.items.filter((i) => i.loc.t === 'table')
  const prompts: Prompt[] = []
  const packed = s.items.find((i) => i.loc.t === 'packslot')
  if (hi && hi.kind === 'print') prompts.push({ key: 'interact', label: 'Place print on the table', run: () => g().act(placeOnTable, { sound: 'item_place' }) })
  else if (!s.held && packed) {
    prompts.push({ key: 'interact', label: 'Pick up the packed parcel', run: () => g().act(pickPackedBox, { sound: 'box_place' }) })
    if (onTable.length) prompts.push({ key: 'secondary', label: 'Use packing station', run: () => g().open('packing') })
  } else if (!s.held) prompts.push(onTable.length
    ? { key: 'interact', label: 'Use packing station', run: () => g().open('packing') }
    : { key: 'interact', label: 'Use packing station', disabled: 'Bring a print first', run: () => {} })
  const sup = s.supplies
  return { uid: 'packing', title: 'Packing station', subtitle: `Boxes S ${sup.box_s} · M ${sup.box_m} · L ${sup.box_l} · Paper ${sup.paper}`, prompts }
}

export function tableItemTarget(itemId: string): HoverTarget | null {
  const s = sim()
  const it = getItem(s, itemId)
  if (!it) return null
  const t = packingTableTarget()
  const title = `${PRODUCTS[it.productId].name}`
  const prompts: Prompt[] = [...t.prompts]
  if (!s.held) prompts.push({ key: 'secondary', label: 'Pick up', run: () => g().act((x) => pickFromTable(x, itemId), { sound: 'item_pickup' }) })
  return { uid: `tableitem:${itemId}`, title, subtitle: `${COLORS[it.color].name} ${it.material} · grade ${it.grade}${it.defect ? ' · ' + it.defect.replace('_', ' ') : ''}`, prompts }
}

export function packedBoxTarget(itemId: string): HoverTarget | null {
  const s = sim()
  const it = getItem(s, itemId)
  if (!it) return null
  return {
    uid: `packed:${itemId}`, title: 'Packed box', subtitle: 'Ready to ship',
    prompts: s.held ? [handsFull('Pick up box')] : [{ key: 'interact', label: 'Pick up box', run: () => g().act(pickPackedBox, { sound: 'box_place' }) }],
  }
}

export function outboxTarget(): HoverTarget {
  const s = sim()
  const hi = heldItem(s)
  const n = s.items.filter((i) => i.loc.t === 'outbox').length
  return {
    uid: 'outbox', title: 'Outbox', subtitle: `${n}/6 parcels · courier at 17:00`,
    prompts: hi && hi.kind === 'box' ? [{ key: 'interact', label: 'Place parcel in the Outbox', run: () => g().act(placeInOutbox, { sound: 'box_place' }) }] : [],
  }
}

export function outboxItemTarget(itemId: string): HoverTarget | null {
  const t = outboxTarget()
  const s = sim()
  if (!t.prompts.length && !s.held) t.prompts.push({ key: 'interact', label: 'Take parcel', run: () => g().act((x) => takeFromOutbox(x, itemId), { sound: 'box_place' }) })
  return { ...t, uid: `outboxitem:${itemId}` }
}

export function laptopTarget(): HoverTarget {
  const s = sim()
  const unread = s.mail.filter((m) => !m.read).length
  const fresh = s.orders.filter((o) => o.status === 'new').length
  return {
    uid: 'laptop', title: 'Laptop', subtitle: `${unread} unread email${unread === 1 ? '' : 's'} · ${fresh} order${fresh === 1 ? '' : 's'} to print`,
    prompts: [{ key: 'interact', label: 'Use laptop', run: () => g().open('laptop') }],
  }
}

export function trashTarget(): HoverTarget {
  const s = sim()
  const prompts: Prompt[] = []
  if (s.held) {
    const label = s.held.kind === 'spool' ? 'Throw away empty spool' : 'Throw away'
    prompts.push({ key: 'interact', label, hold: 0.6, run: () => g().act(trashHeld, { sound: 'item_place' }) })
  }
  return { uid: 'trash', title: 'Trash bin', subtitle: 'Failed prints, empty spools', prompts }
}

export function houseDoorTarget(): HoverTarget {
  const s = sim()
  const ok = canSleep(s)
  return {
    uid: 'housedoor', title: 'Door to the house', subtitle: ok ? 'Call it a day' : 'You can end the day after 17:00',
    prompts: [{ key: 'interact', label: 'End the day', run: () => g().goToSleep() }],
  }
}

export function crateTarget(crateId: string): HoverTarget | null {
  const s = sim()
  const c = s.crates.find((x) => x.id === crateId)
  if (!c) return null
  const what = c.contents.map((x) => (x.kind === 'printer' ? `${PRINTERS[x.printer!].brand} ${PRINTERS[x.printer!].name}` : x.kind === 'spool' ? `${x.qty}× ${COLORS[x.color!].name} ${x.material}` : x.kind === 'upgrade' ? (x.upgrade === 'ups' ? 'UPS' : `${x.qty}× dryer`) : `${x.qty}× supplies`)).join(', ')
  return {
    uid: `crate:${crateId}`, title: c.big ? 'Printer delivery' : 'FilaDepot delivery', subtitle: what,
    prompts: [{ key: 'interact', label: c.big ? 'Unbox & set up printer' : 'Open & unpack', hold: c.big ? 1.5 : 0.8, run: () => g().act((x) => openCrate(x, crateId), { sound: 'box_fold' }) }],
  }
}

export function floorItemTarget(itemId: string): HoverTarget | null {
  const s = sim()
  const it = getItem(s, itemId)
  if (!it) return null
  return {
    uid: `floor:${itemId}`, title: it.kind === 'box' ? 'Parcel' : PRODUCTS[it.productId].name, subtitle: 'On the floor',
    prompts: s.held ? [handsFull('Pick up')] : [{ key: 'interact', label: 'Pick up', run: () => g().act((x) => pickFromFloor(x, itemId), { sound: 'item_pickup' }) }],
  }
}
