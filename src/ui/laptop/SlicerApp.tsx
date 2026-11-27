import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { create } from 'zustand'
import { AlertTriangle, CheckCircle2, Send, Usb, Wifi } from 'lucide-react'
import { useGame } from '../../game/store'
import { assignTools, estimateJob, failChance, getSpool, jobCheck, sendJob } from '../../sim/sim'
import { PRODUCTS, type ProductId } from '../../data/products'
import { PRINTERS } from '../../data/printers'
import { COLORS, MATERIALS, moistureLabel, type ColorId } from '../../data/filaments'
import { QUALITY, ELECTRICITY_PER_KWH, type QualityId } from '../../data/economy'
import { duration, money } from '../../game/format'
import { machineStatus } from '../../world/screens'
import { part, useModel } from '../../world/assets'
import { setBands } from '../../world/printMaterial'
import { makePrintMaterial } from '../../world/printMaterial'
import { Button, Seg, Slider, Swatch } from '../components/ui'
import { AppHeader } from './Laptop'
import { dueLabel } from './OrdersApp'

export const useSlicerSel = create<{ orderId: string | null; printerId: string | null; quality: QualityId }>(() => ({ orderId: null, printerId: null, quality: 'standard' }))

function PreviewModel({ productId, colors, layer }: { productId: ProductId; colors: string[]; layer: number }) {
  const color = colors[0]
  const products = useModel('products')
  const g = useRef<THREE.Group>(null)
  const { obj, mat, height } = useMemo(() => {
    const src = part(products, PRODUCTS[productId].mesh ?? productId)
    const c = src.clone(true)
    c.position.set(0, 0, 0)
    const m = makePrintMaterial(color)
    c.traverse((o) => {
      const mm = o as THREE.Mesh
      if (mm.isMesh) mm.material = m
    })
    return { obj: c, mat: m, height: (src.userData.height as number) ?? 0.05 }
  }, [products, productId, color]) // eslint-disable-line react-hooks/exhaustive-deps
  const scale = 0.16 / Math.max(height, PRODUCTS[productId].footprint[0] / 1000, PRODUCTS[productId].footprint[1] / 1000)
  useFrame((_, dt) => {
    if (g.current) g.current.rotation.y += dt * 0.35
    setBands(mat, colors, 0, height * scale)
    mat.userData.u.uClipY.value = height * scale * layer + 0.00001
    mat.userData.u.uHot.value = layer < 0.999 ? 1 : 0
  })
  return (
    <group ref={g} scale={scale}>
      <primitive object={obj} />
    </group>
  )
}

function PlateGrid() {
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.001, 0]} receiveShadow>
        <planeGeometry args={[0.3, 0.3]} />
        <meshStandardMaterial color="#8a6a3a" roughness={0.5} metalness={0.3} />
      </mesh>
      <gridHelper args={[0.3, 12, '#3a2c18', '#3a2c18']} position={[0, 0.0005, 0]} />
    </group>
  )
}

export function SlicerApp() {
  const sim = useGame((g) => g.sim)
  useGame((g) => g.rev)
  const act = useGame((g) => g.act)
  const toast = useGame((g) => g.toast)
  const { orderId, printerId, quality } = useSlicerSel()
  const [layer, setLayer] = useState(1)
  const open = sim.orders.filter((o) => o.status === 'new')
  const order = sim.orders.find((o) => o.id === orderId && o.status === 'new') ?? open[0]
  useEffect(() => {
    if (order && order.id !== orderId) useSlicerSel.setState({ orderId: order.id })
  }, [order, orderId])
  const printer = sim.printers.find((p) => p.id === printerId) ?? sim.printers.find((p) => p.status === 'idle' && !p.bedItemId) ?? sim.printers[0]

  if (!order) {
    return (
      <div className="app">
        <AppHeader title="Slicer" />
        <div className="empty-big">
          <CheckCircle2 size={42} className="ok" />
          <div className="display" style={{ fontSize: 24 }}>Nothing to slice</div>
          <div className="muted">All orders are printing or done. New orders arrive throughout the day.</div>
        </div>
      </div>
    )
  }
  const prod = PRODUCTS[order.productId]
  const model = PRINTERS[printer.modelId]
  const est = estimateJob(printer.modelId, order.productId, quality)
  const fcost = (est.grams / 1000) * MATERIALS[order.material].price
  const ecost = (est.minutes / 60) * model.kw * ELECTRICITY_PER_KWH
  const usbOnly = model.link === 'usb'
  const check = jobCheck(sim, printer, order)
  const usbCheck = jobCheck(sim, printer, order, true)
  const tools = assignTools(sim, printer, order.material, order.colors).tools
  const used = tools ? tools.map((t) => getSpool(sim, printer.spools[t])!) : []
  const wet = used.reduce((a, x) => Math.max(a, x.moisture), 0)
  const risk = failChance(printer.modelId, order.material, quality, wet)
  const warnings: string[] = []
  if (!usbOnly && !check.ok) warnings.push(check.error!)
  if (usbOnly && !usbCheck.ok) warnings.push(usbCheck.error!)
  if (usbOnly && !tools && usbCheck.ok) warnings.push(`Load ${order.colors.map((c) => `${COLORS[c].name} ${order.material}`).join(', ')} before starting at the machine`)
  for (const x of used) if (x.grams < est.grams / order.colors.length) warnings.push(`Only ${Math.round(x.grams)} g of ${COLORS[x.color].name} left: it will run out mid-print`)
  if (wet > 0.35) warnings.push(`${moistureLabel(wet)} filament (${Math.round(wet * 100)}%): expect stringing and a lower grade. Dry it first`)
  if (order.material === 'ABS' && !model.enclosed) warnings.push('ABS on an open printer: high warping risk')
  if (!sim.internet && !usbOnly) warnings.push('Internet is down: Wi-Fi sending is unavailable. Use "Save to USB"')
  const [due, dueTone] = dueLabel(order, sim.day)
  const send = (viaUsb: boolean) => {
    const ok = act((s) => sendJob(s, order.id, printer.id, quality, viaUsb), { sound: viaUsb ? 'ui_toggle' : 'printer_beep' })
    if (ok) {
      if (viaUsb || usbOnly) toast({ kind: 'info', title: 'Saved to USB stick', body: `Click the ${model.name} and choose "Start print from USB".` })
      else toast({ kind: 'success', title: `Sent to ${model.name}`, body: 'Heating up…' })
      useSlicerSel.setState({ orderId: null })
    }
  }
  return (
    <div className="app slicer">
      <AppHeader title="Slicer">
        <span className="small muted">LayerSlice 2.1</span>
      </AppHeader>
      <div className="slicer-grid">
        <div className="slicer-orders">
          <div className="upper muted">Orders to print ({open.length})</div>
          {open.map((o) => (
            <button key={o.id} className={`card hover slicer-order ${o.id === order.id ? 'selected' : ''}`} onClick={() => useSlicerSel.setState({ orderId: o.id })}>
              <div className="row"><b className="grow ellipsis">{PRODUCTS[o.productId].name}</b><span className="mono tiny dim">#{o.number}</span></div>
              <div className="row small" style={{ gap: 4 }}>{o.colors.map((c: ColorId) => <Swatch key={c} color={c} />)} {o.colors.length > 1 ? `${o.colors.length}-colour` : COLORS[o.color].name} {o.material}<span className="spacer" /><span className={dueLabel(o, sim.day)[1]}>{dueLabel(o, sim.day)[0]}</span></div>
              {(PRODUCTS[o.productId].colors || PRODUCTS[o.productId].minBuild) && <div className="row" style={{ gap: 4 }}>{PRODUCTS[o.productId].colors && <span className="chip accent">multicolour</span>}{(PRODUCTS[o.productId].minBuild ?? 0) > 300 && <span className="chip warn">XL only</span>}</div>}
            </button>
          ))}
        </div>
        <div className="slicer-view">
          <div className="slicer-canvas">
            <Canvas camera={{ position: [0.22, 0.2, 0.26], fov: 38 }} shadows dpr={[1, 2]}>
              <color attach="background" args={['#161b22']} />
              <hemisphereLight args={['#ffffff', '#445', 1.6]} />
              <directionalLight position={[0.3, 0.6, 0.4]} intensity={2.4} castShadow />
              <directionalLight position={[-0.4, 0.3, -0.5]} intensity={1.6} color="#9fc4ff" />
              <pointLight position={[0, 0.25, 0.25]} intensity={0.6} />
              <Suspense fallback={null}>
                <PreviewModel productId={order.productId} colors={order.colors.map((c) => COLORS[c].hex)} layer={layer} />
              </Suspense>
              <PlateGrid />
              <CamLook />
            </Canvas>
            <div className="slicer-overlay small">
              <b className="display" style={{ fontSize: 18 }}>{prod.name}</b>
              <div className="muted">{prod.description}</div>
            </div>
          </div>
          <div className="row small" style={{ gap: 10 }}>
            <span className="upper muted">Layer view</span>
            <Slider value={layer} min={0.02} max={1} step={0.01} onChange={setLayer} />
            <span className="mono muted" style={{ width: 46, textAlign: 'right' }}>{Math.round(layer * 100)}%</span>
          </div>
        </div>
        <div className="slicer-side">
          <div className="upper muted">Printer</div>
          <div className="col" style={{ gap: 8 }}>
            {sim.printers.map((p) => {
              const m = PRINTERS[p.modelId]
              const st = machineStatus(p)
              const free = p.status === 'idle' && !p.bedItemId
              const fitsJob = jobCheck(sim, p, order, true).ok || !free
              const ready = jobCheck(sim, p, order, m.link === 'usb').ok && !!assignTools(sim, p, order.material, order.colors).tools
              return (
                <button key={p.id} className={`card hover printer-pick ${p.id === printer.id ? 'selected' : ''} ${!fitsJob && free ? 'unfit' : ''}`} onClick={() => useSlicerSel.setState({ printerId: p.id })}>
                  <div className="row"><b className="grow">{m.brand} {m.name}</b>{ready && <CheckCircle2 size={14} className="ok" />}{m.link === 'wifi' ? <Wifi size={14} className={sim.internet ? 'info' : 'danger'} /> : <Usb size={14} className="warn" />}</div>
                  <div className="row small" style={{ gap: 6 }}>
                    <span className="dot" style={{ background: free ? 'var(--ok)' : st.color }} />
                    <span className="muted">{free ? 'Ready' : st.label}</span>
                    <span className="spacer" />
                    {p.spools.map((sid, i) => {
                      const x = getSpool(sim, sid)
                      return x ? <Swatch key={i} color={x.color} /> : <span key={i} className="swatch" style={{ background: 'transparent', borderStyle: 'dashed' }} />
                    })}
                  </div>
                </button>
              )
            })}
          </div>
          <div className="upper muted" style={{ marginTop: 6 }}>Quality</div>
          <Seg value={quality} onChange={(q) => useSlicerSel.setState({ quality: q })} options={(Object.keys(QUALITY) as QualityId[]).map((q) => ({ id: q, label: QUALITY[q].name }))} />
          <div className="est card">
            <div className="est-row"><span>Print time</span><b>{duration(est.minutes)}</b></div>
            <div className="est-row"><span>Filament</span><b>{est.grams} g{est.purge ? ` (incl. ${est.purge} g purge)` : ''} · {money(fcost)}</b></div>
            {order.colors.length > 1 && <div className="est-row"><span>Colour changes</span><b>{model.multi === 'ams' ? 'AMS: slow, purges' : model.multi === 'toolchanger' ? 'Toolchanger: fast, clean' : 'not supported'}</b></div>}
            <div className="est-row"><span>Electricity</span><b>{money(ecost)}</b></div>
            <div className="est-row"><span>Failure risk</span><b className={risk > 0.15 ? 'danger' : risk > 0.07 ? 'warn' : 'ok'}>{Math.round(risk * 100)}%</b></div>
            <div className="est-row"><span>Expected grade</span><b>{expectedGrade(printer.modelId, quality)}</b></div>
            <div className="est-row"><span>Order pays</span><b className="ok">{money(order.price)}</b></div>
            <div className="est-row"><span>Deadline</span><b className={dueTone}>{due}</b></div>
          </div>
          {warnings.map((w) => (
            <div key={w} className="warnline small"><AlertTriangle size={14} /> {w}</div>
          ))}
          {!usbOnly && (
            <Button variant="primary" size="lg" block disabled={!check.ok} onClick={() => send(false)}>
              <Send size={18} /> Send to {model.name}
            </Button>
          )}
          <Button variant={usbOnly ? 'primary' : undefined} size={usbOnly ? 'lg' : undefined} block disabled={!usbCheck.ok} onClick={() => send(true)}>
            <Usb size={18} /> Save to USB{usbOnly ? '' : ' (start at the printer)'}
          </Button>
          <div className="tiny muted">{usbOnly ? 'USB printers have no Wi-Fi: start the job at the machine.' : 'USB works even when the internet is down.'}</div>
        </div>
      </div>
    </div>
  )
}

function expectedGrade(model: string, q: QualityId) {
  if (q === 'draft') return 'B'
  if (q === 'fine') return model === 'ender3v3' ? 'A' : 'A+'
  return model === 'ender3v3' ? 'B' : 'A'
}

function CamLook() {
  useFrame(({ camera }) => camera.lookAt(0, 0.05, 0))
  return null
}
