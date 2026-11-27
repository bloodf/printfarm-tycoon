import { useEffect } from 'react'
import { BarChart3, Battery, Boxes, Cpu, Layers, Mail, Package, ShoppingCart, Wifi, WifiOff, X } from 'lucide-react'
import { useGame } from '../../game/store'
import { audio, sfx } from '../../game/audio'
import { clock, weekday } from '../../game/format'
import { MailApp } from './MailApp'
import { OrdersApp } from './OrdersApp'
import { SlicerApp } from './SlicerApp'
import { FarmApp } from './FarmApp'
import { ShopApp } from './ShopApp'
import { BankApp } from './BankApp'

export const APPS = [
  { id: 'mail', name: 'Mail', icon: Mail, color: '#4aa8ff' },
  { id: 'orders', name: 'Orders', icon: Package, color: '#ff7a1a' },
  { id: 'slicer', name: 'Slicer', icon: Layers, color: '#3ddc84' },
  { id: 'farm', name: 'Farm', icon: Cpu, color: '#b48cff' },
  { id: 'shop', name: 'Shop', icon: ShoppingCart, color: '#ffc53d' },
  { id: 'bank', name: 'Bank', icon: BarChart3, color: '#5ee0d6' },
] as const

export function Laptop() {
  const app = useGame((g) => g.laptopApp)
  const setApp = useGame((g) => g.setLaptopApp)
  const close = useGame((g) => g.close)
  const t = useGame((g) => g.sim.time)
  const online = useGame((g) => g.sim.internet)
  const unread = useGame((g) => g.sim.mail.filter((m) => !m.read).length)
  const fresh = useGame((g) => g.sim.orders.filter((o) => o.status === 'new').length)
  const alerts = useGame((g) => g.sim.printers.filter((p) => p.status === 'done' || p.status === 'paused_runout' || p.status === 'waiting_usb' || p.status === 'error').length)
  const crates = useGame((g) => g.sim.crates.filter((c) => c.arrived && !c.opened).length)
  useEffect(() => {
    audio.play('laptop_open', { bus: 'ui' })
    const k = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        sfx.back()
        close()
      }
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [close])
  const badges: Record<string, number> = { mail: unread, orders: fresh, farm: alerts, shop: crates }
  const current = APPS.find((a) => a.id === app) ?? APPS[0]
  return (
    <div className="laptop-wrap anim-fade">
      <div className="laptop anim-rise">
        <div className="os-top">
          <div className="row" style={{ gap: 8 }}>
            <div className="os-logo"><Boxes size={15} /></div>
            <b className="display" style={{ fontSize: 16, letterSpacing: '.08em' }}>LayerOS</b>
            <span className="muted small">· Garage Layers</span>
          </div>
          <div className="row small" style={{ gap: 14 }}>
            {online ? <Wifi size={14} className="muted" /> : <span className="row danger tiny" style={{ gap: 4 }} title="Internet down"><WifiOff size={14} /> No internet</span>}
            <Battery size={16} className="muted" />
            <span className="mono">{weekday(t)} {clock(t)}</span>
            <button className="btn ghost iconbtn" title="Close (Esc)" onClick={() => { sfx.back(); close() }}><X size={18} /></button>
          </div>
        </div>
        <div className="os-body">
          <nav className="os-dock">
            {APPS.map((a) => (
              <button key={a.id} className={`os-app ${app === a.id ? 'on' : ''}`} onMouseEnter={() => sfx.hover()} onClick={() => { sfx.click(); setApp(a.id) }}>
                <span className="os-icon" style={{ background: `linear-gradient(160deg, ${a.color}, ${a.color}99)` }}><a.icon size={20} color="#0d1014" /></span>
                <span className="os-name">{a.name}</span>
                {badges[a.id] ? <span className="os-badge">{badges[a.id]}</span> : null}
              </button>
            ))}
          </nav>
          <section className="os-window" key={current.id}>
            {app === 'mail' && <MailApp />}
            {app === 'orders' && <OrdersApp />}
            {app === 'slicer' && <SlicerApp />}
            {app === 'farm' && <FarmApp />}
            {app === 'shop' && <ShopApp />}
            {app === 'bank' && <BankApp />}
          </section>
        </div>
      </div>
      <div className="laptop-hint small muted">Esc to step away from the laptop · time keeps running</div>
    </div>
  )
}

export function AppHeader({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="app-head">
      <h2 className="display">{title}</h2>
      <div className="row" style={{ gap: 8 }}>{children}</div>
    </div>
  )
}
