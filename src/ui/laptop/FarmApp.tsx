import { useEffect, useRef } from 'react'
import { AlertTriangle, Camera, CameraOff, PlugZap, Usb, Wifi, WifiOff } from 'lucide-react'
import { useGame } from '../../game/store'
import { getItem, getSpool } from '../../sim/sim'
import { PRINTERS } from '../../data/printers'
import { COLORS, moistureLabel } from '../../data/filaments'
import { PRODUCTS } from '../../data/products'
import { ERRORS, WEAR } from '../../data/errors'
import { duration } from '../../game/format'
import { machineStatus, screenOn, temps } from '../../world/screens'
import { feeds } from '../../world/CameraFeeds'
import { Bar, Swatch } from '../components/ui'
import { AppHeader } from './Laptop'

function Feed({ pid }: { pid: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const i = setInterval(() => {
      const c = feeds.get(pid)
      if (c && ref.current && c.parentElement !== ref.current) {
        ref.current.innerHTML = ''
        ref.current.appendChild(c)
      }
    }, 200)
    return () => clearInterval(i)
  }, [pid])
  return <div className="feed" ref={ref}><div className="feed-wait small muted">Connecting to camera…</div></div>
}

function Wear({ label, value, max }: { label: string; value: number; max: number }) {
  const f = Math.min(1, value / max)
  return (
    <div className="wear">
      <span className="tiny muted">{label}</span>
      <div className={`bar ${f >= 1 ? '' : 'ok'}`} style={{ height: 5 }}><i style={{ width: `${f * 100}%`, background: f >= 1 ? 'var(--danger)' : f > 0.75 ? 'var(--warn)' : undefined }} /></div>
    </div>
  )
}

export function FarmApp() {
  const sim = useGame((g) => g.sim)
  useGame((g) => g.rev)
  const powered = screenOn(sim)
  return (
    <div className="app">
      <AppHeader title="Farm">
        {!sim.internet && <span className="chip danger"><WifiOff size={12} /> offline</span>}
        {!sim.power && <span className="chip danger"><PlugZap size={12} /> power outage{sim.upgrades.ups && powered ? ' · on UPS' : ''}</span>}
        <span className="small muted">{sim.printers.filter((p) => p.status === 'printing').length}/{sim.printers.length} printing</span>
      </AppHeader>
      <div className="farm-grid">
        {[...sim.printers].sort((a, b) => a.slot.localeCompare(b.slot)).map((p) => {
          const m = PRINTERS[p.modelId]
          const st = machineStatus(p)
          const t = temps(p)
          const job = p.job
          const f = job ? job.elapsedMin / job.durationMin : 0
          const bed = getItem(sim, p.bedItemId)
          const online = m.link === 'wifi' && sim.internet && powered
          return (
            <div key={p.id} className={`card farm-card ${p.status === 'error' ? 'has-error' : ''}`}>
              <div className="row">
                <div className="grow">
                  <div className="display" style={{ fontSize: 20, fontWeight: 700 }}>{m.brand} {m.name}</div>
                  <div className="tiny muted">Slot {p.slot} · {p.totalPrints} prints{m.tools > 1 ? ` · ${m.tools} filament slots` : ''}</div>
                </div>
                {m.link === 'wifi' ? <span className={`chip ${online ? 'info' : 'danger'}`}>{online ? <Wifi size={12} /> : <WifiOff size={12} />} {online ? 'online' : 'offline'}</span> : <span className="chip warn"><Usb size={12} /> USB only</span>}
              </div>
              {m.camera && online ? <Feed pid={p.id} /> : (
                <div className="feed nofeed">{m.camera ? <WifiOff size={26} /> : <CameraOff size={26} />}<div className="small">{m.camera ? 'Camera offline' : 'No camera: go and look at it!'}</div></div>
              )}
              <div className="row" style={{ gap: 8 }}>
                <span className="dot" style={{ background: powered ? st.color : '#444' }} />
                <b>{powered ? st.label : 'No power'}</b>
                <span className="spacer" />
                <span className="mono small muted">{t.nozzle}° / {t.bed}°</span>
              </div>
              {p.status === 'error' && p.error && (
                <div className="errline small"><AlertTriangle size={14} /> <b>{p.error.code} {ERRORS[p.error.code].title}</b>: {ERRORS[p.error.code].detail} Fix at the printer: <i>{ERRORS[p.error.code].fix}</i>.</div>
              )}
              {!online && m.link === 'wifi' && job && p.status === 'printing' ? (
                <div className="small muted">Progress unknown: printer offline.</div>
              ) : m.link === 'usb' && job && (p.status === 'printing' || p.status === 'heating') ? (
                <div className="small muted">Progress unknown: this printer has no Wi-Fi.</div>
              ) : job ? (
                <>
                  <div className="row small"><span className="grow ellipsis">{PRODUCTS[job.productId].name}</span><span className="mono">{Math.floor(f * 100)}%</span></div>
                  <Bar value={f} tone="info" />
                  <div className="row small muted"><span>ETA {duration(job.durationMin - job.elapsedMin)}</span><span className="spacer" /><span>{job.quality}</span></div>
                </>
              ) : bed ? (
                <div className="small">{bed.grade === 'F' ? <span className="danger">Failed print on the bed</span> : <span className="ok">Finished {PRODUCTS[bed.productId].name} waiting on the bed</span>}</div>
              ) : (
                <div className="small muted">{p.status === 'updating' ? 'Installing firmware…' : 'Idle: send a job from the Slicer.'}</div>
              )}
              <div className="tools">
                {p.spools.map((sid, i) => {
                  const sp = getSpool(sim, sid)
                  return (
                    <div key={i} className="tool small">
                      {sp ? <><Swatch color={sp.color} /><span className="ellipsis">{COLORS[sp.color].name} {sp.material}</span><span className="spacer" /><span className={sp.grams < 100 ? 'warn' : 'muted'}>{Math.round(sp.grams)} g</span><span className={`chip ${sp.moisture > 0.35 ? 'danger' : sp.moisture > 0.15 ? 'warn' : 'ok'}`} title="Moisture">{moistureLabel(sp.moisture)}</span></> : <span className="dim">{m.tools > 1 ? `Slot ${i + 1}: empty` : 'No filament loaded'}</span>}
                    </div>
                  )
                })}
              </div>
              <div className="wears">
                <Wear label="Nozzle" value={p.wear.nozzleH} max={WEAR.nozzleH} />
                <Wear label="Belts" value={p.wear.beltH} max={WEAR.beltH} />
                <Wear label="Plate" value={p.wear.plate} max={WEAR.platePrints} />
              </div>
              {p.status === 'paused_runout' && <div className="warnline small"><AlertTriangle size={14} /> Filament runout: load a new spool</div>}
              {p.needsMaintenance && <div className="warnline small"><AlertTriangle size={14} /> Nozzle clogged: needs a cold pull</div>}
              {p.fwPending && <div className="warnline small"><AlertTriangle size={14} /> Firmware update available: install it when idle</div>}
              {m.camera && online && <div className="tiny muted row" style={{ gap: 4 }}><Camera size={12} /> Check the feed for spaghetti</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
