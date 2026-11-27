import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, Circle, Clock3, Mail, Package, Truck, Wallet, Info, Star, FastForward } from 'lucide-react'
import { useGame, FAST_FORWARD, type Toast } from '../../game/store'
import { useSettings } from '../../game/settings'
import { runtime } from '../../game/runtime'
import { clock, duration, money, weekday } from '../../game/format'
import { minuteOfDay, getItem, getSpool } from '../../sim/sim'
import { COURIER_TIME } from '../../data/economy'
import { INCIDENTS } from '../../data/incidents'
import { GOALS } from '../../data/goals'
import { PRODUCTS } from '../../data/products'
import { COLORS } from '../../data/filaments'
import { Stars } from '../components/ui'
import { ActionPopover, HoverTooltip, Toolbar } from './ClickUi'
import { dropAtView } from '../../world/ClickControls'

export function Hud() {
  const overlay = useGame((g) => g.overlay)
  const inUi = !!overlay
  return (
    <div className="layer passthrough hud">
      <ClockCard />
      <MoneyCard />
      <OutageBanner />
      {!inUi && <Goals />}
      {!inUi && <HoverTooltip />}
      {!inUi && <HeldCard />}
      {!inUi && <CursorCarry />}
      <Toasts />
      <Fps />
      {!inUi && <div className="hud-interactive"><Toolbar /><ActionPopover /></div>}
    </div>
  )
}

function ClockCard() {
  const t = useGame((g) => g.sim.time)
  const day = useGame((g) => g.sim.day)
  const ff = useGame((g) => g.fastForward)
  const courierDone = useGame((g) => g.sim.courierDoneDay === g.sim.day)
  const courierTime = useGame((g) => g.sim.courierTime)
  // "type:state" per incident shown today (announced ones all day, surprises once they start); outages end → "over"
  const today = useGame((g) => g.sim.incidents.filter((i) => i.day === g.sim.day && (INCIDENTS[i.type].announced || i.started))
    .map((i) => `${i.type}:${i.ended && !INCIDENTS[i.type].allDay ? 'over' : i.started && !INCIDENTS[i.type].allDay ? 'now' : 'day'}`).join(','))
  const m = minuteOfDay(t)
  const toCourier = courierTime - m
  return (
    <div className="hud-clock glass">
      <div className="row" style={{ gap: 8 }}>
        <span className="upper muted">{weekday(t)} · Day {day}</span>
        {ff && <span className="chip accent ff"><FastForward size={12} /> ×{FAST_FORWARD}</span>}
      </div>
      <div className="hud-time display">{clock(t)}</div>
      <div className="row small muted" style={{ gap: 6 }}>
        <Truck size={14} />
        {courierDone ? <span>Courier came · next tomorrow 17:00</span> : toCourier > 0 ? <span>Courier in <b className={toCourier < 60 ? 'warn' : ''}>{duration(toCourier)}</b>{courierTime !== COURIER_TIME ? ' (late today)' : ''}</span> : <span>Courier arriving…</span>}
      </div>
      {today && (
        <div className="today">
          {today.split(',').map((entry, i) => {
            const [k, state] = entry.split(':')
            const d = INCIDENTS[k as keyof typeof INCIDENTS]
            return (
              <span key={`${k}${i}`} className={`chip ${state === 'now' ? 'danger' : ''} ${state === 'over' ? 'over' : ''}`} title={d.blurb}>
                {d.icon} {d.name}{state === 'over' ? ' · over' : ''}
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}

function OutageBanner() {
  const power = useGame((g) => g.sim.power)
  const internet = useGame((g) => g.sim.internet)
  const ups = useGame((g) => g.sim.upgrades.ups)
  const outage = useGame((g) => Math.floor(g.sim.outageMin))
  if (power && internet) return null
  return (
    <div className="outage anim-fade">
      {!power && <span>⚡ POWER OUTAGE{ups ? (outage < 60 ? ` · UPS ${60 - outage} min left` : ' · UPS empty') : ' · printers stopped'}</span>}
      {!internet && <span>📶 INTERNET DOWN · use USB · Shop offline</span>}
    </div>
  )
}

function MoneyCard() {
  const moneyV = useGame((g) => g.sim.money)
  const rep = useGame((g) => g.sim.reputation)
  const unread = useGame((g) => g.sim.mail.filter((m) => !m.read).length)
  const fresh = useGame((g) => g.sim.orders.filter((o) => o.status === 'new').length)
  const [shown, setShown] = useState(moneyV)
  const [delta, setDelta] = useState<{ v: number; k: number } | null>(null)
  const prev = useRef(moneyV)
  useEffect(() => {
    const d = moneyV - prev.current
    prev.current = moneyV
    if (Math.abs(d) >= 0.01) setDelta({ v: d, k: Date.now() })
    let raf = 0
    const start = performance.now()
    const from = shown
    const step = () => {
      const f = Math.min(1, (performance.now() - start) / 600)
      setShown(from + (moneyV - from) * (1 - Math.pow(1 - f, 3)))
      if (f < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [moneyV]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="hud-money glass">
      <div className="row" style={{ gap: 8 }}>
        <Wallet size={18} className="muted" />
        <span className="hud-cash display">{money(shown)}</span>
        {delta && (
          <span key={delta.k} className={`hud-delta display ${delta.v > 0 ? 'ok' : 'danger'}`}>
            {delta.v > 0 ? '+' : ''}{money(delta.v)}
          </span>
        )}
      </div>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="row" style={{ gap: 6 }}><Stars value={rep} size={14} /><span className="small muted">{rep.toFixed(1)}</span></span>
        <span className="row small" style={{ gap: 10 }}>
          <span className={`row ${unread ? 'info' : 'dim'}`} style={{ gap: 4 }}><Mail size={14} />{unread}</span>
          <span className={`row ${fresh ? 'accent' : 'dim'}`} style={{ gap: 4 }}><Package size={14} />{fresh}</span>
        </span>
      </div>
    </div>
  )
}

function Goals() {
  const done = useGame((g) => g.sim.goalsDone.join(','))
  const hints = useSettings((s) => s.gameplay.hints)
  const doneSet = new Set(done.split(','))
  const tutorial = GOALS.filter((g) => g.tutorial)
  const current = tutorial.find((g) => !doneSet.has(g.id))
  const longTerm = GOALS.filter((g) => !g.tutorial && !doneSet.has(g.id)).slice(0, 2)
  const tDone = tutorial.filter((g) => doneSet.has(g.id)).length
  return (
    <div className="hud-goals glass">
      <div className="row upper muted" style={{ justifyContent: 'space-between' }}>
        <span>{current ? 'Tutorial' : 'Goals'}</span>
        {current && <span className="mono">{tDone}/{tutorial.length}</span>}
      </div>
      {current && (
        <div className="goal current" key={current.id}>
          <Circle size={16} className="accent" />
          <div>
            <div className="goal-title">{current.title}</div>
            {hints && <div className="small muted">{current.hint}</div>}
          </div>
        </div>
      )}
      {longTerm.map((g) => (
        <div className="goal" key={g.id}>
          <Circle size={14} className="dim" />
          <div className="small">{g.title}</div>
        </div>
      ))}
      {!current && longTerm.length === 0 && (
        <div className="goal"><CheckCircle2 size={16} className="ok" /><div className="small">All goals complete. The rented unit unlocks in M3!</div></div>
      )}
    </div>
  )
}

function HeldCard() {
  const held = useGame((g) => g.sim.held)
  const item = useGame((g) => (g.sim.held?.kind === 'item' ? getItem(g.sim, g.sim.held.id) : undefined))
  const spool = useGame((g) => (g.sim.held?.kind === 'spool' ? getSpool(g.sim, g.sim.held.id) : undefined))
  if (!held) return null
  let title = ''
  let sub = ''
  let color = '#888'
  if (spool) {
    title = `${COLORS[spool.color].name} ${spool.material} spool`
    sub = `${Math.round(spool.grams)} g left`
    color = COLORS[spool.color].hex
  } else if (item) {
    title = item.kind === 'box' ? 'Packed parcel' : PRODUCTS[item.productId].name
    sub = item.kind === 'box' ? 'Take it to the Outbox' : `${COLORS[item.color].name} ${item.material} · grade ${item.grade}`
    color = COLORS[item.color].hex
  }
  return (
    <div className="held glass anim-rise">
      <span className="swatch" style={{ background: color, width: 18, height: 18 }} />
      <div className="grow">
        <div className="upper muted">In your hands</div>
        <div className="display" style={{ fontSize: 18, fontWeight: 600 }}>{title}</div>
        <div className="small muted">{sub}</div>
      </div>
      {item && <HeldDrop />}
    </div>
  )
}

function HeldDrop() {
  return (
    <button className="btn sm" style={{ pointerEvents: 'auto' }} onClick={() => dropAtView()}>
      Drop
    </button>
  )
}

/** The carried item follows the cursor as a small badge (there are no hands: decision D11). */
function CursorCarry() {
  const held = useGame((g) => g.sim.held)
  const cursor = useGame((g) => g.cursor)
  const color = useGame((g) => {
    const h = g.sim.held
    if (!h) return null
    if (h.kind === 'spool') return COLORS[getSpool(g.sim, h.id)?.color ?? 'grey'].hex
    const it = getItem(g.sim, h.id)
    return it ? (it.kind === 'box' ? '#b98a55' : COLORS[it.color].hex) : null
  })
  const kind = held?.kind === 'spool' ? 'spool' : held ? 'item' : null
  if (!held || !color) return null
  return (
    <div className={`carry carry-${kind}`} style={{ left: cursor.x + 14, top: cursor.y - 30, ['--c' as string]: color }} />
  )
}

const TOAST_ICON: Record<Toast['kind'], React.ReactNode> = {
  info: <Info size={18} />, success: <CheckCircle2 size={18} />, warn: <AlertTriangle size={18} />, error: <AlertTriangle size={18} />,
  mail: <Mail size={18} />, order: <Package size={18} />, money: <Wallet size={18} />, review: <Star size={18} />,
}

function Toasts() {
  const toasts = useGame((g) => g.toasts)
  const dismiss = useGame((g) => g.dismissToast)
  return (
    <div className="toasts">
      {toasts.map((t) => (
        <div key={t.id} className={`toast glass t-${t.kind}`} onClick={() => dismiss(t.id)} style={{ pointerEvents: 'auto' }}>
          <div className="toast-icon">{TOAST_ICON[t.kind]}</div>
          <div className="grow">
            <div className="toast-title">{t.title}</div>
            {t.body && <div className="small muted">{t.body}</div>}
          </div>
        </div>
      ))}
    </div>
  )
}

function Fps() {
  const show = useSettings((s) => s.graphics.showFps)
  const [st, setSt] = useState(runtime.stats)
  useEffect(() => {
    if (!show) return
    const i = setInterval(() => setSt({ ...runtime.stats }), 500)
    return () => clearInterval(i)
  }, [show])
  if (!show) return null
  return (
    <div className="fps mono tiny">
      <Clock3 size={11} /> {st.fps} fps · {st.drawCalls} draws · {(st.triangles / 1000).toFixed(0)}k tris
    </div>
  )
}
