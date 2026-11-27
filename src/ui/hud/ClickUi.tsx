import { useEffect, useRef, useState } from 'react'
import { Camera, FastForward, Laptop as LaptopIcon, Menu, Moon, Pause, Play, X } from 'lucide-react'
import { useGame, type Prompt } from '../../game/store'
import { canSleep } from '../../sim/sim'
import { sfx } from '../../game/audio'
import { interactables } from '../../world/interact'
import { orbit } from '../../world/ClickControls'

/** Small label that follows the cursor while hovering an interactable (Point & Click). */
export function HoverTooltip() {
  const hover = useGame((g) => g.hover)
  const cursor = useGame((g) => g.cursor)
  const popover = useGame((g) => g.popover)
  if (!hover || popover) return null
  const primary = hover.prompts.find((p) => !p.disabled)
  return (
    <div className="tooltip glass" style={{ left: cursor.x + 18, top: cursor.y + 14 }}>
      <div className="display tooltip-title">{hover.title}</div>
      {hover.subtitle && <div className="tiny muted">{hover.subtitle}</div>}
      {primary && <div className="tiny accent" style={{ marginTop: 3 }}>Click: {primary.label}{hover.prompts.length > 1 ? ` · +${hover.prompts.length - 1} more` : ''}</div>}
    </div>
  )
}

/** Timed action button (replaces "hold E" in Point & Click). */
function HoldButton({ p, onDone }: { p: Prompt; onDone: () => void }) {
  const [prog, setProg] = useState(0)
  const raf = useRef(0)
  useEffect(() => () => cancelAnimationFrame(raf.current), [])
  const start = () => {
    if (prog > 0) return
    sfx.click()
    const t0 = performance.now()
    const step = () => {
      const f = Math.min(1, (performance.now() - t0) / ((p.hold ?? 1) * 1000))
      setProg(f)
      if (f < 1) raf.current = requestAnimationFrame(step)
      else {
        p.run()
        onDone()
      }
    }
    raf.current = requestAnimationFrame(step)
  }
  return (
    <button className={`pop-btn ${p.key === 'interact' ? 'primary' : ''}`} onClick={start} onMouseEnter={() => sfx.hover()}>
      <span className="ring" style={{ ['--p' as string]: `${prog * 360}deg` }} />
      {p.label}
      {prog > 0 && prog < 1 && <span className="tiny muted"> {Math.round(prog * 100)}%</span>}
    </button>
  )
}

/** Action menu anchored where the player clicked (Point & Click). */
export function ActionPopover() {
  const pop = useGame((g) => g.popover)
  useGame((g) => g.rev)
  const setPopover = useGame((g) => g.setPopover)
  const toast = useGame((g) => g.toast)
  if (!pop) return null
  const it = interactables.get(pop.uid)
  const t = it?.target()
  if (!t) return null
  const close = () => setPopover(null)
  const x = Math.min(pop.x + 16, window.innerWidth - 320)
  const y = Math.min(pop.y - 10, window.innerHeight - 60 - t.prompts.length * 46 - 80)
  return (
    <div className="popover glass anim-rise" style={{ left: x, top: Math.max(70, y) }} onMouseDown={(e) => e.stopPropagation()}>
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <div className="grow">
          <div className="display popover-title">{t.title}</div>
          {t.subtitle && <div className="tiny muted">{t.subtitle}</div>}
        </div>
        <button className="btn ghost iconbtn" onClick={() => { sfx.back(); close() }} aria-label="Close"><X size={16} /></button>
      </div>
      <div className="col" style={{ gap: 6, marginTop: 8 }}>
        {t.prompts.length === 0 && <div className="small muted">Nothing to do here right now.</div>}
        {t.prompts.map((p) =>
          p.disabled ? (
            <button key={p.label} className="pop-btn disabled" onClick={() => { sfx.error(); toast({ kind: 'error', title: p.disabled! }) }}>
              {p.label} <span className="tiny danger">({p.disabled})</span>
            </button>
          ) : p.hold ? (
            <HoldButton key={p.label} p={p} onDone={close} />
          ) : (
            <button key={p.label} className={`pop-btn ${p.key === 'interact' ? 'primary' : ''}`} onMouseEnter={() => sfx.hover()} onClick={() => { sfx.click(); p.run(); close() }}>
              {p.label}
            </button>
          ),
        )}
      </div>
    </div>
  )
}

/** Bottom toolbar: laptop, time controls, camera, end of day, menu. */
export function Toolbar() {
  const g = useGame()
  const ff = g.fastForward
  const paused = g.overlay === 'pause'
  const btn = (key: string, title: string, icon: React.ReactNode, on: () => void, active = false) => (
    <button key={key} className={`tb-btn ${active ? 'on' : ''}`} title={title} onMouseEnter={() => sfx.hover()} onClick={() => { sfx.click(); on() }}>
      {icon}
      <span className="tb-label">{title}</span>
    </button>
  )
  return (
    <div className="toolbar glass">
      {btn('laptop', 'Laptop', <LaptopIcon size={18} />, () => g.open('laptop'))}
      <span className="tb-sep" />
      {btn('pause', 'Pause', <Pause size={18} />, () => g.open('pause'), paused)}
      {btn('play', '1×', <Play size={18} />, () => ff && g.toggleFastForward(), !ff && !paused)}
      {btn('ff', '8×', <FastForward size={18} />, () => !ff && g.toggleFastForward(), ff)}
      <span className="tb-sep" />
      {btn('cam', 'Reset view', <Camera size={18} />, () => orbit.reset())}
      {btn('endday', canSleep(g.sim) ? 'End day' : 'End day (17:00)', <Moon size={18} />, () => g.goToSleep(), false)}
      {btn('menu', 'Menu', <Menu size={18} />, () => g.open('pause'))}
    </div>
  )
}
