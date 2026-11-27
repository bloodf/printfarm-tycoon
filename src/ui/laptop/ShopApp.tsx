import { useState } from 'react'
import { Minus, Plus, ShoppingCart, Trash2, Truck } from 'lucide-react'
import { useGame } from '../../game/store'
import { buy, capacityCheck, cartPrice, type CartLine } from '../../sim/sim'
import { COLORS, MATERIALS, type ColorId, type Material } from '../../data/filaments'
import { PRINTERS, PRINTER_LIST, SIZE_LABEL } from '../../data/printers'
import { SUPPLIES, UPGRADES, type SupplyId, type UpgradeId } from '../../data/economy'
import { MAX_DRYERS } from '../../data/garage'
import { WifiOff } from 'lucide-react'
import { money } from '../../game/format'
import { Button, Seg, Swatch } from '../components/ui'
import { AppHeader } from './Laptop'

type Tab = 'filament' | 'supplies' | 'parts' | 'printers'

const lineKey = (l: CartLine) => `${l.kind}:${l.material ?? ''}:${l.color ?? ''}:${l.supply ?? ''}:${l.printer ?? ''}:${l.upgrade ?? ''}`
const lineName = (l: CartLine) =>
  l.kind === 'spool' ? `${COLORS[l.color!].name} ${l.material} 1 kg` : l.kind === 'supply' ? SUPPLIES[l.supply!].name : l.kind === 'upgrade' ? UPGRADES[l.upgrade!].name : `${PRINTERS[l.printer!].brand} ${PRINTERS[l.printer!].name}`

export function ShopApp() {
  const sim = useGame((g) => g.sim)
  useGame((g) => g.rev)
  const act = useGame((g) => g.act)
  const [tab, setTab] = useState<Tab>('filament')
  const [mat, setMat] = useState<Material>('PLA')
  const [cart, setCart] = useState<CartLine[]>([])
  const add = (l: CartLine) => {
    setCart((c) => {
      const k = lineKey(l)
      const ex = c.find((x) => lineKey(x) === k)
      if (ex) return c.map((x) => (x === ex ? { ...x, qty: x.qty + 1 } : x))
      return [...c, { ...l, qty: 1 }]
    })
  }
  const setQty = (l: CartLine, q: number) => setCart((c) => (q <= 0 ? c.filter((x) => x !== l) : c.map((x) => (x === l ? { ...x, qty: q } : x))))
  const total = cart.reduce((a, l) => a + cartPrice(l), 0)
  const stock = (m: Material, c: ColorId) => sim.spools.filter((s) => s.material === m && s.color === c && s.loc.t === 'shelf').length
  const pendingPrinters = sim.crates.filter((c) => !c.opened).flatMap((c) => c.contents).filter((c) => c.kind === 'printer').length
  const inCart = cart.filter((l) => l.kind === 'printer').flatMap((l) => Array(l.qty).fill(l.printer!))
  const roomFor = (m: (typeof PRINTER_LIST)[number]['id']) => !capacityCheck(sim, [...inCart, m])
  const pendingDryers = sim.crates.filter((c) => !c.opened).flatMap((c) => c.contents).filter((c) => c.kind === 'upgrade' && c.upgrade === 'dryer').length
  const dryersInCart = cart.filter((l) => l.kind === 'upgrade' && l.upgrade === 'dryer').reduce((a, l) => a + l.qty, 0)
  const upgradeAvailable = (u: UpgradeId) => u === 'ups' ? !sim.upgrades.ups && !cart.some((l) => l.upgrade === 'ups') : sim.dryers.length + pendingDryers + dryersInCart < MAX_DRYERS
  const checkout = () => {
    if (act((s) => buy(s, cart), { sound: 'cash' })) setCart([])
  }
  return (
    <div className="app shop">
      <AppHeader title="Shop">
        {!sim.internet && <span className="chip danger"><WifiOff size={12} /> Shop offline (internet down)</span>}
        <Seg value={tab} onChange={setTab} options={[{ id: 'filament', label: 'Filament' }, { id: 'supplies', label: 'Packing' }, { id: 'parts', label: 'Parts & upgrades' }, { id: 'printers', label: 'Printers' }]} />
      </AppHeader>
      <div className="shop-grid">
        <div className="shop-main">
          {tab === 'filament' && (
            <>
              <div className="row" style={{ marginBottom: 10 }}>
                <b className="display" style={{ fontSize: 18 }}>FilaDepot</b>
                <span className="muted small">Premium 1.75 mm, 1 kg spools</span>
                <span className="spacer" />
                <Seg value={mat} onChange={setMat} options={(Object.keys(MATERIALS) as Material[]).map((m) => ({ id: m, label: m }))} />
              </div>
              <div className="small muted" style={{ marginBottom: 10 }}>{MATERIALS[mat].note} · {money(MATERIALS[mat].price)} per spool</div>
              <div className="swatch-grid">
                {(Object.keys(COLORS) as ColorId[]).map((c) => (
                  <button key={c} className="card hover spool-card" onClick={() => add({ kind: 'spool', material: mat, color: c, qty: 1 })}>
                    <div className="spool-icon" style={{ ['--c' as string]: COLORS[c].hex }} />
                    <b>{COLORS[c].name}</b>
                    <div className="tiny muted">{mat} · in stock: {stock(mat, c)}</div>
                    <div className="row" style={{ justifyContent: 'space-between', width: '100%' }}><span className="mono">{money(MATERIALS[mat].price)}</span><Plus size={16} className="accent" /></div>
                  </button>
                ))}
              </div>
            </>
          )}
          {tab === 'supplies' && (
            <div className="col">
              <div className="small muted">BoxCo shipping supplies. Current stock: S {sim.supplies.box_s} · M {sim.supplies.box_m} · L {sim.supplies.box_l} · paper {sim.supplies.paper}</div>
              {(Object.keys(SUPPLIES) as SupplyId[]).filter((id) => SUPPLIES[id].kind !== 'part').map((id) => (
                <div key={id} className="card row">
                  <div className="grow">
                    <b>{SUPPLIES[id].name}</b>
                    <div className="tiny muted">{SUPPLIES[id].kind === 'box' ? 'Flat-packed double-wall cardboard' : 'Crinkle kraft paper for padding. Prevents breakage'}</div>
                  </div>
                  <span className="mono">{money(SUPPLIES[id].price)}</span>
                  <Button size="sm" onClick={() => add({ kind: 'supply', supply: id, qty: 1 })}><Plus size={14} /> Add</Button>
                </div>
              ))}
            </div>
          )}
          {tab === 'parts' && (
            <div className="col">
              <div className="small muted">Spare parts in stock: nozzles {sim.parts.nozzle} · fans {sim.parts.fan} · IPA cleans {sim.parts.ipa}. Dryers: {sim.dryers.length}/{MAX_DRYERS}{sim.upgrades.ups ? ' · UPS installed' : ''}</div>
              {(Object.keys(SUPPLIES) as SupplyId[]).filter((id) => SUPPLIES[id].kind === 'part').map((id) => (
                <div key={id} className="card row">
                  <div className="grow">
                    <b>{SUPPLIES[id].name}</b>
                    <div className="tiny muted">{id === 'nozzle' ? 'Worn nozzles (250 print-hours) lower quality and clog more' : id === 'fan' ? 'Needed to fix error E302 (part-cooling fan failure)' : 'Clean a build plate every ~8 prints or parts start coming loose'}</div>
                  </div>
                  <span className="mono">{money(SUPPLIES[id].price)}</span>
                  <Button size="sm" onClick={() => add({ kind: 'supply', supply: id, qty: 1 })}><Plus size={14} /> Add</Button>
                </div>
              ))}
              {(Object.keys(UPGRADES) as UpgradeId[]).map((id) => (
                <div key={id} className="card row">
                  <div className="grow">
                    <b>{UPGRADES[id].name}</b>
                    <div className="tiny muted">{UPGRADES[id].blurb}</div>
                  </div>
                  <span className="mono">{money(UPGRADES[id].price, false)}</span>
                  <Button size="sm" variant="primary" disabled={!upgradeAvailable(id)} onClick={() => add({ kind: 'upgrade', upgrade: id, qty: 1 })}>{upgradeAvailable(id) ? <><Plus size={14} /> Add</> : id === 'ups' ? 'Owned' : 'No room'}</Button>
                </div>
              ))}
            </div>
          )}
          {tab === 'printers' && (
            <div className="col">
              <div className="small muted">Garage: {sim.printers.length} printers{pendingPrinters ? ` (+${pendingPrinters} on the way)` : ''}. Slots: 4 × M on the workbench, 3 × L on the print table, 1 × XL cart.</div>
              {PRINTER_LIST.map((p) => {
                const owned = sim.printers.filter((x) => x.modelId === p.id).length
                return (
                  <div key={p.id} className="card printer-card">
                    <div className="row">
                      <div className="grow">
                        <div className="display" style={{ fontSize: 22, fontWeight: 700 }}>{p.brand} {p.name}</div>
                        <div className="tiny muted">Modelled after the {p.reference} · owned: {owned}</div>
                      </div>
                      <div className="display" style={{ fontSize: 24 }}>{money(p.price, false)}</div>
                    </div>
                    <div className="small" style={{ margin: '6px 0 10px' }}>{p.blurb}</div>
                    <div className="specs">
                      <span>Speed <b>{p.speed < 1 ? `${Math.round((1 / p.speed) * 100 - 100)}% faster` : p.speed > 1 ? `${Math.round(p.speed * 100 - 100)}% slower` : 'reference'}</b></span>
                      <span>Reliability <b className={p.baseFail > 0.08 ? 'warn' : 'ok'}>{Math.round((1 - p.baseFail) * 100)}%</b></span>
                      <span>Link <b>{p.link === 'wifi' ? 'Wi-Fi' : 'USB'}</b></span>
                      <span>Camera <b>{p.camera ? 'yes' : 'no'}</b></span>
                      <span>Enclosed <b>{p.enclosed ? 'yes' : 'no'}</b></span>
                      <span>Volume <b>{p.buildMm.join('×')} mm</b></span>
                      <span>Colours <b>{p.tools > 1 ? `${p.tools} (${p.multi === 'ams' ? 'AMS' : 'toolchanger'})` : '1'}</b></span>
                      <span>Power-loss recovery <b className={p.powerRecovery ? 'ok' : 'warn'}>{p.powerRecovery ? 'yes' : 'no'}</b></span>
                      <span>Footprint <b>{SIZE_LABEL[p.size]}</b></span>
                    </div>
                    <div className="row" style={{ justifyContent: 'flex-end', marginTop: 8 }}>
                      <Button variant="primary" size="sm" disabled={!roomFor(p.id)} onClick={() => add({ kind: 'printer', printer: p.id, qty: 1 })}>
                        {!roomFor(p.id) ? `No free ${p.size.toUpperCase()} slot` : <><Plus size={14} /> Add to cart</>}
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
        <aside className="cart card">
          <div className="row"><ShoppingCart size={18} /><b className="display" style={{ fontSize: 18 }}>Cart</b></div>
          {cart.length === 0 && <div className="muted small">Your cart is empty.</div>}
          <div className="col" style={{ gap: 6 }}>
            {cart.map((l) => (
              <div key={lineKey(l)} className="cart-line">
                <div className="row" style={{ gap: 6 }}>
                  {l.color && <Swatch color={l.color} />}
                  <span className="grow small ellipsis">{lineName(l)}</span>
                  <button className="btn ghost iconbtn" onClick={() => setQty(l, 0)}><Trash2 size={14} /></button>
                </div>
                <div className="row small">
                  <button className="btn sm ghost iconbtn" onClick={() => setQty(l, l.qty - 1)}><Minus size={12} /></button>
                  <span className="mono">{l.qty}</span>
                  <button className="btn sm ghost iconbtn" onClick={() => setQty(l, l.qty + 1)} disabled={(l.kind === 'printer' && !roomFor(l.printer!)) || (l.kind === 'upgrade' && !upgradeAvailable(l.upgrade!))}><Plus size={12} /></button>
                  <span className="spacer" />
                  <span className="mono">{money(cartPrice(l))}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="spacer" />
          <div className="divider" />
          <div className="row"><span className="grow muted">Total</span><b className="display" style={{ fontSize: 22 }}>{money(total)}</b></div>
          <div className="row small"><span className="grow muted">Balance after</span><span className={sim.money - total < 0 ? 'danger' : ''}>{money(sim.money - total)}</span></div>
          <div className="row tiny muted" style={{ gap: 6 }}><Truck size={13} /> Free delivery tomorrow at 08:30</div>
          <Button variant="primary" block disabled={!cart.length || total > sim.money || !sim.internet} onClick={checkout}>{sim.internet ? 'Place order' : 'Offline: try later'}</Button>
        </aside>
      </div>
    </div>
  )
}
