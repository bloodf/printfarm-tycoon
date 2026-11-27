import { useEffect, useRef, useState } from 'react'
import { Check, Package, Printer as PrinterIcon, Scissors, Tag, Trash2, X } from 'lucide-react'
import { useGame } from '../../game/store'
import { audio, sfx } from '../../game/audio'
import { usePacking, type PackStep } from '../../game/packing'
import { cleanPlate, clearBed, coldPull, fixError, getItem, getOrder, getPrinter, getSpool, packItem, pausePrinter, replaceNozzle, resumePrinter, scrapItem, startFromUsb, tensionBelts, unloadSpool, updateFirmware } from '../../sim/sim'
import { ERRORS, WEAR } from '../../data/errors'
import { PRINTERS } from '../../data/printers'
import { COLORS, moistureLabel } from '../../data/filaments'
import { BOX_SIZES, PRODUCTS, boxFits, type BoxSize } from '../../data/products'
import { duration, money } from '../../game/format'
import { machineStatus, temps } from '../../world/screens'
import { runtime } from '../../game/runtime'
import { Bar, Button, Swatch } from '../components/ui'

function useEsc(fn: () => void) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        sfx.back()
        fn()
      }
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [fn])
}

// --------------------------------------------------------------------------------------- printer screen menu
export function PrinterMenu() {
  const pid = useGame((g) => g.overlayArg)!
  const close = useGame((g) => g.close)
  const act = useGame((g) => g.act)
  const sim = useGame((g) => g.sim)
  useGame((g) => g.rev)
  useEsc(close)
  const p = getPrinter(sim, pid)
  if (!p) return null
  const m = PRINTERS[p.modelId]
  const st = machineStatus(p)
  const t = temps(p)
  const job = p.job
  const err = p.error ? ERRORS[p.error.code] : null
  const idle = ['idle', 'done'].includes(p.status)
  const f = job ? job.elapsedMin / job.durationMin : 0
  const pos = runtime.printerPos.get(pid)
  const sp3: [number, number, number] | undefined = pos ? [pos.x, pos.y + 0.3, pos.z] : undefined
  const beep = { sound: 'printer_beep', soundPos: sp3 }
  return (
    <div className="station-wrap">
      <div className="pscreen glass anim-rise" style={{ ['--pa' as string]: m.ui.accent }}>
        <div className="pscreen-head">
          <PrinterIcon size={18} />
          <b className="display">{m.brand} {m.name}</b>
          <span className="spacer" />
          <button className="btn ghost iconbtn" onClick={() => { sfx.back(); close() }}><X size={18} /></button>
        </div>
        <div className="pscreen-status" style={{ color: st.color }}>{st.label}</div>
        <div className="pscreen-grid">
          <div className="card"><div className="upper muted">Nozzle</div><div className="display big">{t.nozzle}°C</div></div>
          <div className="card"><div className="upper muted">Bed</div><div className="display big">{t.bed}°C</div></div>
          <div className="card">
            <div className="upper muted">Power</div>
            <div className="display big" style={{ fontSize: 20 }}>{sim.power ? 'OK' : sim.upgrades.ups && sim.outageMin < 60 ? 'UPS' : 'OFF'}</div>
            <div className="tiny muted">{m.powerRecovery ? 'Power-loss recovery' : 'No power-loss recovery'}</div>
          </div>
        </div>
        {err && (
          <div className="errline" style={{ marginTop: 10 }}>
            <div className="grow">
              <b>{err.code} · {err.title}</b>
              <div className="small">{err.detail} {err.abort ? 'The print was lost.' : 'The print is paused.'}</div>
            </div>
            <Button variant="primary" size="sm" disabled={!!err.part && sim.parts[err.part] <= 0} onClick={() => act((s) => fixError(s, pid), { sound: 'spool_swap', soundPos: sp3, ok: `${err.title} fixed` })}>
              {err.part && sim.parts[err.part] <= 0 ? `Needs a spare ${err.part}` : err.fix}
            </Button>
          </div>
        )}
        <div className="card" style={{ marginTop: 10 }}>
          <div className="upper muted">Filament{p.spools.length > 1 ? ` · ${m.multi === 'ams' ? 'AMS lite' : 'toolheads'}` : ''}</div>
          {p.spools.map((sid, i) => {
            const x = getSpool(sim, sid)
            return (
              <div key={i} className="row small" style={{ gap: 6, marginTop: 4 }}>
                {p.spools.length > 1 && <span className="mono dim">{i + 1}</span>}
                {x ? <><Swatch color={x.color} /><b>{COLORS[x.color].name} {x.material}</b><span className="muted">{Math.round(x.grams)} g</span><span className={`chip ${x.moisture > 0.35 ? 'danger' : x.moisture > 0.15 ? 'warn' : 'ok'}`}>{moistureLabel(x.moisture)} {Math.round(x.moisture * 100)}%</span>
                  <span className="spacer" />
                  {!['printing', 'heating', 'paused_power', 'updating'].includes(p.status) && <Button size="sm" onClick={() => { if (act((s) => unloadSpool(s, pid, i), { sound: 'spool_swap', soundPos: sp3 })) close() }}>⏏ Unload</Button>}</>
                  : <span className="dim">empty</span>}
              </div>
            )
          })}
        </div>
        {job && (
          <div className="card" style={{ marginTop: 10 }}>
            <div className="row"><b className="grow">{PRODUCTS[job.productId].name}.gcode</b><span className="mono">{Math.floor(f * 100)}%</span></div>
            <Bar value={f} />
            <div className="row small muted" style={{ marginTop: 6 }}><span>{job.quality} quality</span><span className="spacer" /><span>{duration(job.durationMin - job.elapsedMin)} left</span></div>
          </div>
        )}
        <div className="pscreen-actions">
          {p.status === 'waiting_usb' && <Button variant="primary" onClick={() => act((s) => startFromUsb(s, pid), beep)}>▶ Start print from USB</Button>}
          {p.status === 'printing' && <Button onClick={() => act((s) => pausePrinter(s, pid), beep)}>❚❚ Pause</Button>}
          {p.status === 'paused_runout' && <Button variant="primary" onClick={() => act((s) => resumePrinter(s, pid), beep)}>▶ Resume</Button>}
          {(p.status === 'printing' || p.status === 'heating' || p.status === 'paused_runout' || p.status === 'waiting_usb') && (
            <Button variant="danger" onClick={() => act((s) => clearBed(s, pid), { ...beep, ok: 'Print stopped' })}>■ Stop print</Button>
          )}
          {p.needsMaintenance && p.status === 'idle' && <Button onClick={() => act((s) => coldPull(s, pid), { sound: 'spool_swap', soundPos: sp3, ok: 'Nozzle cleaned' })}>🧹 Cold pull</Button>}
          {p.fwPending && p.status === 'idle' && <Button onClick={() => act((s) => updateFirmware(s, pid), { ...beep, ok: 'Firmware update started' })}>⬆ Install firmware update</Button>}
        </div>
        <div className="card" style={{ marginTop: 10 }}>
          <div className="upper muted">Maintenance</div>
          {([['Nozzle', p.wear.nozzleH, WEAR.nozzleH, 'h', 'Replace nozzle', `${sim.parts.nozzle} spare`, () => replaceNozzle, sim.parts.nozzle <= 0],
            ['Belts', p.wear.beltH, WEAR.beltH, 'h', 'Tension belts', '', () => tensionBelts, false],
            ['Build plate', p.wear.plate, WEAR.platePrints, ' prints', 'Clean with IPA', `${sim.parts.ipa} left`, () => cleanPlate, sim.parts.ipa <= 0]] as const).map(([label, v, max, unit, btn, stock, fn, none]) => (
            <div key={label} className="row small" style={{ gap: 8, marginTop: 6 }}>
              <span style={{ width: 78 }}>{label}</span>
              <div className="grow"><div className="bar" style={{ height: 6 }}><i style={{ width: `${Math.min(1, v / max) * 100}%`, background: v >= max ? 'var(--danger)' : v > max * 0.75 ? 'var(--warn)' : 'var(--ok)' }} /></div></div>
              <span className="mono dim" style={{ width: 70, textAlign: 'right' }}>{Math.round(v)}/{max}{unit}</span>
              <Button size="sm" disabled={!idle || none} onClick={() => act((s) => fn()(s, pid), { sound: 'spool_swap', soundPos: sp3, ok: `${label}: done` })}>{btn}{stock ? ` (${stock})` : ''}</Button>
            </div>
          ))}
        </div>
        <div className="tiny muted" style={{ marginTop: 10 }}>
          {m.link === 'usb' ? 'USB printer: jobs are started here at the machine.' : 'Wi-Fi printer: jobs are sent from the Slicer app.'} The printer can't see spaghetti. You have to.
        </div>
      </div>
    </div>
  )
}

// --------------------------------------------------------------------------------------- packing station
const STEPS: { id: PackStep; label: string }[] = [
  { id: 'select', label: 'Select' }, { id: 'qc', label: 'Inspect' }, { id: 'box', label: 'Box' }, { id: 'fill', label: 'Padding' },
  { id: 'tape', label: 'Tape' }, { id: 'label', label: 'Label' },
]

export function PackingStation() {
  const close = useGame((g) => g.close)
  const act = useGame((g) => g.act)
  const sim = useGame((g) => g.sim)
  useGame((g) => g.rev)
  const pk = usePacking()
  const onTable = sim.items.filter((i) => i.loc.t === 'table')
  const item = getItem(sim, pk.itemId)
  const order = getOrder(sim, item?.orderId)
  const [tapeHold, setTapeHold] = useState(0)
  const holdTimer = useRef<number | null>(null)
  const finish = () => {
    pk.reset()
    useGame.setState({ overlayArg: null })
    close()
  }
  useEsc(finish)
  useEffect(() => {
    // auto-select when only one print is on the table
    if (pk.step === 'select' && !pk.itemId && onTable.length === 1) {
      pk.set({ itemId: onTable[0].id, step: 'qc' })
      useGame.setState({ overlayArg: onTable[0].id })
    }
  }, [pk, onTable])
  useEffect(() => () => pk.reset(), []) // eslint-disable-line react-hooks/exhaustive-deps

  const stepIdx = STEPS.findIndex((s) => s.id === pk.step)
  const need = item ? PRODUCTS[item.productId].box : 's'
  const startTape = () => {
    audio.play('tape_rip', { volume: 0.9 })
    const t0 = performance.now()
    holdTimer.current = window.setInterval(() => {
      const f = Math.min(1, (performance.now() - t0) / 900)
      setTapeHold(f)
      if (f >= 1) {
        window.clearInterval(holdTimer.current!)
        holdTimer.current = null
        setTapeHold(0)
        pk.set({ step: 'label' })
      }
    }, 30)
  }
  const stopTape = () => {
    if (holdTimer.current) {
      window.clearInterval(holdTimer.current)
      holdTimer.current = null
      setTapeHold(0)
    }
  }
  const printLabel = () => {
    if (!item || !pk.box) return
    audio.play('label_print')
    const ok = act((s) => packItem(s, item.id, pk.box!, pk.padded))
    if (ok) pk.set({ step: 'done' })
  }

  return (
    <div className="station-wrap right">
      <div className="packing glass anim-rise">
        <div className="row">
          <Package size={18} className="accent" />
          <b className="display" style={{ fontSize: 22 }}>Packing station</b>
          <span className="spacer" />
          <button className="btn ghost iconbtn" onClick={() => { sfx.back(); finish() }}><X size={18} /></button>
        </div>
        <div className="steps">
          {STEPS.map((s, i) => (
            <div key={s.id} className={`step ${i < stepIdx || pk.step === 'done' ? 'done' : i === stepIdx ? 'on' : ''}`}>
              <span className="step-n">{i < stepIdx || pk.step === 'done' ? <Check size={12} /> : i + 1}</span>
              <span className="tiny">{s.label}</span>
            </div>
          ))}
        </div>

        {pk.step === 'select' && (
          <div className="col">
            <div className="muted small">Choose a print from the table to pack.</div>
            {onTable.map((it) => {
              const o = getOrder(sim, it.orderId)
              return (
                <button key={it.id} className="card hover" onClick={() => { pk.set({ itemId: it.id, step: 'qc' }); useGame.setState({ overlayArg: it.id }) }}>
                  <div className="row"><Swatch color={it.color} /><b className="grow">{PRODUCTS[it.productId].name}</b><span className="chip">{it.grade}</span></div>
                  <div className="small muted">{o ? `Order #${o.number} · ${o.customer}` : 'No matching order'}</div>
                </button>
              )
            })}
          </div>
        )}

        {pk.step === 'qc' && item && (
          <div className="col">
            <div className="card">
              <div className="row"><Swatch color={item.color} /><b className="grow display" style={{ fontSize: 20 }}>{PRODUCTS[item.productId].name}</b><span className={`grade g-${item.grade.replace('+', 'p')}`}>{item.grade}</span></div>
              <div className="small muted">{COLORS[item.color].name} {item.material}</div>
              <div className="divider" />
              {item.defect ? (
                <div className="warnline">{{ layer_shift: 'Layer shift: the top half is offset. The customer will notice.', incomplete: 'Incomplete print: the nozzle clogged mid-print.', spaghetti: 'This is a spaghetti mess, not a product.', color_mix: 'Colour changes mid-print after a spool swap.', stringing: 'Stringing everywhere: the filament was wet. Customers will complain.', power_loss: 'Power cut: this printer could not resume.', aborted: 'Print aborted by a machine error.' }[item.defect]}</div>
              ) : (
                <div className="ok small">✓ Clean print. No visible defects.</div>
              )}
            </div>
            {order ? (
              <div className="card small">
                <div className="upper muted">Order #{order.number}</div>
                <div>{order.customer} · {order.city}</div>
                <div className="muted">Ordered: {COLORS[order.color].name} {order.material} · {money(order.price)}</div>
                {(order.color !== item.color || order.material !== item.material) && <div className="danger">Colour/material doesn't match the order!</div>}
              </div>
            ) : (
              <div className="warnline small">No open order for this print.</div>
            )}
            <div className="row">
              <Button variant="danger" onClick={() => { act((s) => scrapItem(s, item.id), { sound: 'item_place', ok: 'Scrapped. The order needs a reprint' }); pk.reset(); useGame.setState({ overlayArg: null }) }}><Trash2 size={16} /> Scrap</Button>
              <span className="spacer" />
              <Button variant="primary" disabled={!order || item.grade === 'F'} onClick={() => pk.set({ step: 'box', box: need })}>Looks good → choose box</Button>
            </div>
          </div>
        )}

        {pk.step === 'box' && item && (
          <div className="col">
            <div className="muted small">{PRODUCTS[item.productId].name} needs at least a <b>{BOX_SIZES[need].name}</b> box.</div>
            <div className="box-grid">
              {(['s', 'm', 'l'] as BoxSize[]).map((b) => {
                const fits = boxFits(need, b)
                const stock = sim.supplies[`box_${b}`]
                return (
                  <button key={b} disabled={!fits || stock <= 0} className={`card hover box-card ${pk.box === b ? 'selected' : ''}`} onClick={() => { sfx.click(); audio.play('box_fold', { volume: 0.7 }); pk.set({ box: b }) }}>
                    <div className={`box-ico s-${b}`} />
                    <b>{BOX_SIZES[b].name}</b>
                    <div className="tiny muted">{BOX_SIZES[b].dims}</div>
                    <div className={`tiny ${stock <= 0 ? 'danger' : 'muted'}`}>{stock} in stock · label {money(BOX_SIZES[b].label)}</div>
                    {!fits && <div className="tiny danger">Too small</div>}
                    {fits && b === need && <span className="chip ok">Best fit</span>}
                  </button>
                )
              })}
            </div>
            <Button variant="primary" block disabled={!pk.box} onClick={() => pk.set({ step: 'fill' })}>Fold box & put the print in</Button>
          </div>
        )}

        {pk.step === 'fill' && (
          <div className="col">
            <div className="muted small">Padding protects the print in transit. Without it, about 1 in 5 parcels arrive broken.</div>
            <div className="row">
              <Button block variant={pk.padded ? 'primary' : undefined} disabled={sim.supplies.paper <= 0} onClick={() => { audio.play('paper_crinkle'); pk.set({ padded: true }) }}>
                {pk.padded ? <><Check size={16} /> Paper added</> : `Add kraft paper (${sim.supplies.paper} left)`}
              </Button>
            </div>
            <Button variant={pk.padded ? 'primary' : undefined} block onClick={() => { audio.play('box_fold', { volume: 0.8 }); pk.set({ step: 'tape' }) }}>
              {pk.padded ? 'Close the flaps' : 'Skip padding & close the flaps'}
            </Button>
          </div>
        )}

        {pk.step === 'tape' && (
          <div className="col">
            <div className="muted small">Hold the button to run the tape gun across the box.</div>
            <button className="btn primary lg block tape-btn" onMouseDown={startTape} onMouseUp={stopTape} onMouseLeave={stopTape}>
              <Scissors size={18} /> Hold to tape
              <i style={{ width: `${tapeHold * 100}%` }} />
            </button>
          </div>
        )}

        {pk.step === 'label' && (
          <div className="col">
            <div className="muted small">Print the shipping label and stick it on.</div>
            <Button variant="primary" size="lg" block onClick={printLabel}><Tag size={18} /> Print shipping label</Button>
          </div>
        )}

        {pk.step === 'done' && (
          <div className="col">
            <div className="done-box">
              <Check size={34} className="ok" />
              <div className="display" style={{ fontSize: 22 }}>Parcel ready!</div>
              <div className="small muted">Pick it up from the station and put it on the Outbox shelf before 17:00.</div>
            </div>
            <div className="row">
              {onTable.length > 0 && <Button onClick={() => pk.reset()}>Pack another</Button>}
              <span className="spacer" />
              <Button variant="primary" onClick={finish}>Done</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
