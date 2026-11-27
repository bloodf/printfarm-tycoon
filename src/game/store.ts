import { create } from 'zustand'
import {
  canSleep, createInitialState, drainEvents, endDay, getOrder, getPrinter, migrate, sleepUntilMorning, tick,
  type ActionResult,
} from '../sim/sim'
import type { DayStats, SimEvent, SimState } from '../sim/types'
import { PRODUCTS } from '../data/products'
import { PRINTERS } from '../data/printers'
import { COLORS } from '../data/filaments'
import { GOALS } from '../data/goals'
import { ERRORS } from '../data/errors'
import { INCIDENTS } from '../data/incidents'
import { audio, sfx } from './audio'
import { money } from './format'
import { runtime } from './runtime'

/** Real seconds → game minutes */
export const MINUTES_PER_SECOND = 1
export const FAST_FORWARD = 8

export type Screen = 'boot' | 'menu' | 'game'
export type Overlay = null | 'laptop' | 'packing' | 'printer' | 'pause' | 'settings' | 'report' | 'credits'

export interface Toast {
  id: number
  kind: 'info' | 'success' | 'warn' | 'error' | 'mail' | 'order' | 'money' | 'review'
  title: string
  body?: string
  born: number
}

export type PromptKey = 'interact' | 'secondary' | 'drop'
export interface Prompt {
  key: PromptKey
  label: string
  /** Seconds to hold; 0/undefined = tap */
  hold?: number
  run: () => void
  disabled?: string
}
export interface HoverTarget {
  uid: string
  title: string
  subtitle?: string
  prompts: Prompt[]
}

const SAVE_KEY = 'pft.save.v1'
const PAUSING: Overlay[] = ['pause', 'settings', 'report', 'credits']
let toastId = 1

interface GameStore {
  screen: Screen
  overlay: Overlay
  overlayArg: string | null
  sim: SimState
  rev: number
  fastForward: boolean
  toasts: Toast[]
  hover: HoverTarget | null
  hold: { label: string; progress: number } | null
  /** Point & Click: action popover anchored at a screen position */
  popover: { uid: string; x: number; y: number } | null
  /** Point & Click: cursor position for the hover tooltip */
  cursor: { x: number; y: number }
  report: DayStats | null
  fade: number
  lastSaved: number | null
  laptopApp: string

  setScreen: (s: Screen) => void
  newGame: () => void
  continueGame: () => boolean
  hasSave: () => boolean
  save: (silent?: boolean) => void
  quitToMenu: () => void
  advance: (realDt: number) => void
  bump: () => void
  act: (fn: (s: SimState) => ActionResult, opts?: { ok?: string; sound?: string; soundPos?: [number, number, number] }) => boolean
  open: (o: Overlay, arg?: string | null) => void
  close: () => void
  toast: (t: Omit<Toast, 'id' | 'born'>) => void
  dismissToast: (id: number) => void
  setHover: (h: HoverTarget | null) => void
  setHold: (h: { label: string; progress: number } | null) => void
  setPopover: (p: { uid: string; x: number; y: number } | null) => void
  toggleFastForward: () => void
  goToSleep: () => void
  startNextDay: () => void
  setLaptopApp: (a: string) => void
}

let lastBump = 0

export const useGame = create<GameStore>((set, get) => ({
  screen: 'boot',
  overlay: null,
  overlayArg: null,
  sim: createInitialState(1),
  rev: 0,
  fastForward: false,
  toasts: [],
  hover: null,
  hold: null,
  popover: null,
  cursor: { x: 0, y: 0 },
  report: null,
  fade: 0,
  lastSaved: null,
  laptopApp: 'mail',

  setScreen: (screen) => set({ screen }),

  newGame: () => {
    const sim = createInitialState((Date.now() % 2147483647) >>> 0)
    drainEvents(sim)
    set({ sim, screen: 'game', overlay: null, toasts: [], report: null, fastForward: false, laptopApp: 'mail', rev: get().rev + 1 })
    setTimeout(() => {
      get().toast({ kind: 'info', title: 'Day 1: Welcome to your garage', body: 'Check your email on the laptop to get started.' })
    }, 800)
  },

  hasSave: () => !!localStorage.getItem(SAVE_KEY),

  continueGame: () => {
    try {
      const raw = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null')
      const sim = migrate(raw?.sim)
      if (!sim) return false
      set({ sim, screen: 'game', overlay: null, toasts: [], report: null, fastForward: false, rev: get().rev + 1 })
      return true
    } catch {
      return false
    }
  },

  save: (silent) => {
    const { sim } = get()
    localStorage.setItem(SAVE_KEY, JSON.stringify({ sim: { ...sim, events: [] }, savedAt: Date.now() }))
    set({ lastSaved: Date.now() })
    if (!silent) get().toast({ kind: 'success', title: 'Game saved' })
  },

  quitToMenu: () => {
    runtime.focus = null
    set({ screen: 'menu', overlay: null, hover: null, hold: null, fastForward: false })
  },

  advance: (realDt) => {
    const st = get()
    if (st.screen !== 'game' || PAUSING.includes(st.overlay) || st.sim.dayEnded) return
    const dtMin = Math.min(realDt, 0.1) * MINUTES_PER_SECOND * (st.fastForward ? FAST_FORWARD : 1)
    tick(st.sim, dtMin)
    const ev = drainEvents(st.sim)
    if (ev.length) handleEvents(ev)
    const now = performance.now()
    if (ev.length || now - lastBump > 100) {
      lastBump = now
      set({ rev: st.rev + 1 })
    }
    // expire toasts
    const tnow = Date.now()
    if (st.toasts.some((t) => tnow - t.born > 6500)) set({ toasts: get().toasts.filter((t) => tnow - t.born <= 6500) })
  },

  bump: () => set({ rev: get().rev + 1 }),

  act: (fn, opts) => {
    const r = fn(get().sim)
    const ev = drainEvents(get().sim)
    if (ev.length) handleEvents(ev)
    if (!r.ok) {
      sfx.error()
      get().toast({ kind: 'error', title: r.error ?? "Can't do that" })
    } else {
      if (opts?.sound) audio.play(opts.sound, { pos: opts.soundPos, detune: 0.08 })
      if (opts?.ok) get().toast({ kind: 'success', title: opts.ok })
    }
    set({ rev: get().rev + 1 })
    return r.ok
  },

  open: (overlay, arg = null) => {
    set({ overlay, overlayArg: arg, hover: null, hold: null, popover: null, fastForward: overlay === 'laptop' ? get().fastForward : false })
  },

  close: () => {
    runtime.focus = null
    set({ overlay: null, overlayArg: null })
  },

  toast: (t) => {
    const toast: Toast = { ...t, id: toastId++, born: Date.now() }
    set({ toasts: [...get().toasts.slice(-4), toast] })
  },

  dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
  setHover: (hover) => set({ hover }),
  setHold: (hold) => set({ hold }),
  setPopover: (popover) => set({ popover }),
  toggleFastForward: () => {
    sfx.toggle()
    set({ fastForward: !get().fastForward })
  },
  setLaptopApp: (laptopApp) => set({ laptopApp }),

  goToSleep: () => {
    const s = get().sim
    if (!canSleep(s)) {
      sfx.error()
      get().toast({ kind: 'warn', title: 'Too early to sleep', body: 'You can call it a day after 17:00.' })
      return
    }
    audio.play('door_open', { volume: 0.8 })
    const report = endDay(s)
    runtime.focus = null
    set({ report, overlay: 'report', fastForward: false, hover: null, hold: null, rev: get().rev + 1 })
  },

  startNextDay: () => {
    const s = get().sim
    sleepUntilMorning(s)
    const ev = drainEvents(s)
    set({ overlay: null, report: null, rev: get().rev + 1 })
    handleEvents(ev)
    get().save(true)
    get().toast({ kind: 'info', title: `Good morning! Day ${s.day}`, body: 'Game saved automatically.' })
  },
}))

// ----------------------------------------------------------------------------- sim events → feedback
function printerSoundPos(pid: string): [number, number, number] | undefined {
  const v = runtime.printerPos.get(pid)
  return v ? [v.x, v.y + 0.3, v.z] : undefined
}

function handleEvents(events: SimEvent[]) {
  const g = useGame.getState()
  const s = g.sim
  for (const e of events) {
    switch (e.type) {
      case 'order': {
        const o = getOrder(s, e.orderId)
        if (!o) break
        audio.play('notif_order', { bus: 'ui', throttle: 0.5 })
        g.toast({ kind: 'order', title: `New order #${o.number}`, body: `${PRODUCTS[o.productId].name} · ${COLORS[o.color].name} ${o.material} · ${money(o.price)}` })
        break
      }
      case 'mail': {
        const m = s.mail.find((x) => x.id === e.mailId)
        if (!m) break
        audio.play('notif_mail', { bus: 'ui', throttle: 0.5 })
        g.toast({ kind: 'mail', title: `Email from ${m.fromName}`, body: m.subject })
        break
      }
      case 'print_started':
        audio.play('printer_home', { pos: printerSoundPos(e.printerId), volume: 0.7 })
        break
      case 'print_done': {
        const p = getPrinter(s, e.printerId)
        audio.play('printer_done', { pos: printerSoundPos(e.printerId) })
        if (p) g.toast({ kind: 'success', title: `${PRINTERS[p.modelId].name} finished printing`, body: 'Take the print off the bed.' })
        break
      }
      case 'runout': {
        const p = getPrinter(s, e.printerId)
        audio.play('printer_alarm', { pos: printerSoundPos(e.printerId) })
        if (p) g.toast({ kind: 'warn', title: `${PRINTERS[p.modelId].name}: filament runout!`, body: 'Load a new spool of the same colour to resume.' })
        break
      }
      case 'courier':
        audio.play('courier_van', { bus: 'ambience', volume: 0.9 })
        if (e.count > 0) {
          setTimeout(() => audio.play('cash', { bus: 'ui' }), 4200)
          g.toast({ kind: 'money', title: `Courier picked up ${e.count} parcel${e.count > 1 ? 's' : ''}`, body: `Net income +${money(e.revenue)}` })
        } else g.toast({ kind: 'info', title: 'The courier came by', body: 'Nothing in the Outbox today.' })
        break
      case 'delivery':
        audio.play('courier_van', { bus: 'ambience', volume: 0.7 })
        g.toast({ kind: 'info', title: 'Delivery arrived!', body: 'A package is waiting by the garage door.' })
        break
      case 'goal': {
        const goal = GOALS.find((x) => x.id === e.goalId)
        if (goal) {
          audio.play('ui_toggle', { bus: 'ui' })
          g.toast({ kind: 'success', title: `✓ ${goal.title}` })
        }
        break
      }
      case 'review':
        g.toast({ kind: 'review', title: `${'★'.repeat(e.stars)}${'☆'.repeat(5 - e.stars)} review`, body: `from ${e.customer}` })
        break
      case 'day_end':
        useGame.setState({ fastForward: false })
        g.toast({ kind: 'warn', title: "It's 23:00, you're exhausted", body: 'Time to go to bed.' })
        setTimeout(() => useGame.getState().goToSleep(), 1200)
        break
      case 'printer_error': {
        const p = getPrinter(s, e.printerId)
        const def = ERRORS[e.code]
        audio.play('error_alarm', { pos: printerSoundPos(e.printerId) })
        if (p) g.toast({ kind: 'error', title: `${PRINTERS[p.modelId].name}: ${def.code} ${def.title}`, body: `${def.abort ? 'Print lost.' : 'Print paused.'} Fix: ${def.fix}${def.part ? ` (you have ${s.parts[def.part]})` : ''}. Click the printer.` })
        break
      }
      case 'power':
        audio.play(e.on ? 'power_up' : 'power_down', { bus: 'ambience', volume: 1 })
        if (e.on) g.toast({ kind: 'success', title: '⚡ Power is back', body: 'Printers with power-loss recovery resume; the others lost their prints.' })
        else g.toast({ kind: 'warn', title: '⚡ Power outage!', body: s.upgrades.ups ? 'The UPS keeps the printers running for up to 60 minutes.' : 'Printers stopped. Prints without power-loss recovery will be lost.' })
        break
      case 'internet':
        if (e.on) g.toast({ kind: 'success', title: '📶 Internet is back', body: 'Orders and emails are coming through again.' })
        else g.toast({ kind: 'warn', title: '📶 Internet is down', body: 'No new orders, the Shop is offline, Wi-Fi printers can’t receive jobs. Save jobs to USB.' })
        break
      case 'incident': {
        const d = INCIDENTS[e.incident]
        if (d.announced) g.toast({ kind: 'info', title: `${d.icon} Today: ${d.name}`, body: d.blurb })
        break
      }
      case 'dried': {
        const sp = s.spools.find((x) => x.id === e.spoolId)
        audio.play('printer_beep', { bus: 'ui' })
        if (sp) g.toast({ kind: 'success', title: `${COLORS[sp.color].name} ${sp.material} is dry`, body: 'Take it out of the dryer.' })
        break
      }
      case 'error':
        g.toast({ kind: 'error', title: e.message })
        break
      case 'info':
        g.toast({ kind: 'info', title: e.message })
        break
      default:
        break
    }
  }
}

// QA/debug hook (used by the automated playthrough)
declare global {
  interface Window {
    __pft?: unknown
  }
}
window.__pft = { useGame, runtime }
