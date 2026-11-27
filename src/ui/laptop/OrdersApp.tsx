import { useState } from 'react'
import { Layers } from 'lucide-react'
import { useGame } from '../../game/store'
import { PRODUCTS } from '../../data/products'
import { COLORS } from '../../data/filaments'
import { money } from '../../game/format'
import type { Order } from '../../sim/types'
import { Button, Seg, Swatch } from '../components/ui'
import { AppHeader } from './Laptop'
import { useSlicerSel } from './SlicerApp'

export const STATUS_CHIP: Record<Order['status'], [string, string]> = {
  new: ['To print', 'accent'], queued: ['On USB / queued', 'info'], printing: ['Printing', 'info'], printed: ['Printed', 'ok'],
  packed: ['Packed', 'ok'], in_outbox: ['In Outbox', 'ok'], shipped: ['Shipped', ''], cancelled: ['Cancelled', 'danger'],
}

export function dueLabel(o: Order, day: number): [string, string] {
  if (o.status === 'shipped') return [o.late ? `Shipped late (D${o.shippedDay})` : `Shipped D${o.shippedDay}`, o.late ? 'danger' : 'dim']
  const d = o.dueDay - day
  if (d < 0) return [`Overdue ${-d}d`, 'danger']
  if (d === 0) return ['Ship today!', 'warn']
  if (d === 1) return ['Ship by tomorrow', '']
  return [`Ship by day ${o.dueDay}`, 'muted']
}

export function OrdersApp() {
  const orders = useGame((g) => g.sim.orders)
  const day = useGame((g) => g.sim.day)
  useGame((g) => g.rev)
  const setApp = useGame((g) => g.setLaptopApp)
  const [filter, setFilter] = useState<'open' | 'all' | 'shipped'>('open')
  const list = orders
    .filter((o) => (filter === 'open' ? o.status !== 'shipped' && o.status !== 'cancelled' : filter === 'shipped' ? o.status === 'shipped' : true))
    .slice()
    .sort((a, b) => (filter === 'shipped' ? b.number - a.number : a.dueDay - b.dueDay || a.number - b.number))
  const open = orders.filter((o) => o.status !== 'shipped' && o.status !== 'cancelled')
  const value = open.reduce((a, o) => a + o.price, 0)
  return (
    <div className="app">
      <AppHeader title="Orders">
        <span className="small muted">{open.length} open · {money(value)} pending</span>
        <Seg value={filter} onChange={setFilter} options={[{ id: 'open', label: 'Open' }, { id: 'shipped', label: 'Shipped' }, { id: 'all', label: 'All' }]} />
      </AppHeader>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr><th>#</th><th>Product</th><th>Filament</th><th>Customer</th><th>Deadline</th><th className="r">Price</th><th>Status</th><th /></tr>
          </thead>
          <tbody>
            {list.length === 0 && (
              <tr><td colSpan={8} className="empty muted">No orders here. {filter === 'open' ? 'New orders arrive throughout the day.' : ''}</td></tr>
            )}
            {list.map((o) => {
              const [due, dueTone] = dueLabel(o, day)
              const [st, stTone] = STATUS_CHIP[o.status]
              return (
                <tr key={o.id}>
                  <td className="mono dim">{o.number}</td>
                  <td><b>{PRODUCTS[o.productId].name}</b>{o.source === 'email' && <span className="chip accent" style={{ marginLeft: 6 }}>custom</span>}{o.attempts > 0 && <span className="chip warn" style={{ marginLeft: 6 }}>reprint</span>}</td>
                  <td><span className="row" style={{ gap: 6 }}><Swatch color={o.color} />{COLORS[o.color].name} {o.material}</span></td>
                  <td><div>{o.customer}</div><div className="tiny dim">{o.city}</div></td>
                  <td className={dueTone}>{due}</td>
                  <td className="r mono">{money(o.price)}</td>
                  <td><span className={`chip ${stTone}`}>{st}</span></td>
                  <td className="r">
                    {o.status === 'new' && (
                      <Button size="sm" variant="primary" onClick={() => { useSlicerSel.setState({ orderId: o.id }); setApp('slicer') }}><Layers size={14} /> Slice</Button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
