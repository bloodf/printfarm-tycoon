import * as THREE from 'three'
import { PRINTERS } from '../data/printers'
import { COLORS } from '../data/filaments'
import { PRODUCTS } from '../data/products'
import type { Printer, SimState } from '../sim/types'
import { getSpool } from '../sim/sim'
import { ERRORS } from '../data/errors'
import { duration } from '../game/format'

export function makeScreenTexture(w = 320, h = 200) {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return { canvas, tex, ctx: canvas.getContext('2d')! }
}

/** What the machine *thinks* is happening (it doesn't know about spaghetti). */
export function machineStatus(p: Printer): { label: string; color: string } {
  switch (p.status) {
    case 'idle':
      return p.needsMaintenance ? { label: 'Check nozzle', color: '#ffc53d' } : { label: 'Ready', color: '#3ddc84' }
    case 'waiting_usb':
      return { label: 'USB: file ready', color: '#4aa8ff' }
    case 'heating':
      return { label: 'Heating', color: '#ff8a3d' }
    case 'printing':
      return { label: 'Printing', color: '#4aa8ff' }
    case 'paused_runout':
      return { label: 'Filament runout', color: '#ff4d4f' }
    case 'done':
      return { label: 'Print finished', color: '#ffd23a' }
    case 'paused_power':
      return { label: 'Power lost', color: '#ff4d4f' }
    case 'error':
      return { label: p.error ? `Error ${p.error.code}` : 'Error', color: '#ff4d4f' }
    case 'updating':
      return { label: 'Updating firmware', color: '#b48cff' }
  }
}

/** Is the printer's screen powered? (dark during a power cut unless the UPS is still covering it) */
export function screenOn(s: SimState) {
  return s.power || (s.upgrades.ups && s.outageMin < 60)
}

export function temps(p: Printer) {
  const job = p.job
  if (p.status === 'heating' && job) {
    const f = 1 - Math.max(0, job.heatLeftMin) / 4
    return { nozzle: Math.round(25 + f * 190), bed: Math.round(25 + f * 35) }
  }
  if (p.status === 'printing' || p.status === 'paused_runout') return { nozzle: p.status === 'printing' ? 215 : 170, bed: 60 }
  return { nozzle: 26, bed: 25 }
}

export function paintPrinterScreen(ctx: CanvasRenderingContext2D, s: SimState, p: Printer, blink: boolean) {
  const m = PRINTERS[p.modelId]
  const { width: W, height: H } = ctx.canvas
  if (!screenOn(s)) {
    ctx.fillStyle = '#020203'
    ctx.fillRect(0, 0, W, H)
    return
  }
  ctx.fillStyle = m.ui.bg
  ctx.fillRect(0, 0, W, H)
  // header
  ctx.fillStyle = m.ui.accent
  ctx.fillRect(0, 0, W, 34)
  ctx.fillStyle = p.modelId === 'p1s' ? '#fff' : m.ui.bg
  ctx.font = 'bold 20px sans-serif'
  ctx.fillText(`${m.brand.toUpperCase()}  ${m.name}`, 10, 24)
  const st = machineStatus(p)
  ctx.fillStyle = st.color
  if (!(p.status === 'paused_runout' && blink)) {
    ctx.font = 'bold 26px sans-serif'
    ctx.fillText(st.label, 10, 70)
  }
  ctx.fillStyle = m.ui.fg
  ctx.font = '18px monospace'
  const t = temps(p)
  ctx.fillText(`Nozzle ${t.nozzle}°C   Bed ${t.bed}°C`, 10, 100)
  if (p.spools.length === 1) {
    const sp = getSpool(s, p.spools[0])
    if (sp) {
      ctx.fillStyle = COLORS[sp.color].hex
      ctx.fillRect(10, 112, 18, 18)
      ctx.strokeStyle = m.ui.fg
      ctx.strokeRect(10, 112, 18, 18)
      ctx.fillStyle = m.ui.fg
      ctx.fillText(`${sp.material} ${Math.round(sp.grams)} g`, 36, 127)
    } else {
      ctx.fillStyle = '#ff8a3d'
      ctx.fillText('No filament', 10, 127)
    }
  } else {
    p.spools.forEach((sid, i) => {
      const sp = getSpool(s, sid)
      ctx.fillStyle = sp ? COLORS[sp.color].hex : 'rgba(128,128,128,.25)'
      ctx.fillRect(10 + i * 30, 112, 24, 18)
      ctx.strokeStyle = m.ui.fg
      ctx.strokeRect(10 + i * 30, 112, 24, 18)
    })
  }
  if (p.status === 'error' && p.error) {
    const e = ERRORS[p.error.code]
    ctx.fillStyle = blink ? '#ff4d4f' : '#7a1a1a'
    ctx.fillRect(0, 140, W, 60)
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 17px sans-serif'
    ctx.fillText(e.title, 10, 164)
    ctx.font = '14px sans-serif'
    ctx.fillText(e.abort ? 'Print aborted' : 'Print paused', 10, 186)
    return
  }
  if (p.status === 'updating') {
    ctx.fillStyle = m.ui.fg
    ctx.font = '16px sans-serif'
    ctx.fillText('Installing firmware…', 10, 160)
    ctx.fillStyle = m.ui.accent
    ctx.fillRect(10, 170, (W - 20) * (1 - p.updateLeft / 15), 12)
    return
  }
  const job = p.job
  if (job && (p.status === 'printing' || p.status === 'paused_runout' || p.status === 'heating' || p.status === 'paused_power')) {
    const f = job.elapsedMin / job.durationMin
    ctx.fillStyle = m.ui.fg
    ctx.font = '16px sans-serif'
    ctx.fillText(`${PRODUCTS[job.productId].name.slice(0, 18)}.gcode`, 10, 152)
    ctx.fillStyle = p.modelId === 'p1s' ? '#d6d8da' : '#2a2f36'
    ctx.fillRect(10, 162, W - 20, 14)
    ctx.fillStyle = m.ui.accent
    ctx.fillRect(10, 162, (W - 20) * f, 14)
    ctx.fillStyle = m.ui.fg
    ctx.font = '15px monospace'
    ctx.fillText(`${Math.floor(f * 100)}%   ${duration(job.durationMin - job.elapsedMin)} left`, 10, 194)
  } else if (p.status === 'waiting_usb' && job) {
    ctx.fillStyle = m.ui.fg
    ctx.font = '16px sans-serif'
    ctx.fillText(`${PRODUCTS[job.productId].name}.gcode`, 10, 152)
    ctx.fillStyle = blink ? m.ui.accent : m.ui.fg
    ctx.fillText('Press knob to start ▶', 10, 180)
  } else if (p.status === 'done') {
    ctx.fillStyle = m.ui.fg
    ctx.font = '16px sans-serif'
    ctx.fillText('Remove print from the bed', 10, 160)
  }
}

export function paintLaptopScreen(ctx: CanvasRenderingContext2D, time: string, unread: number, newOrders: number) {
  const { width: W, height: H } = ctx.canvas
  const g = ctx.createLinearGradient(0, 0, W, H)
  g.addColorStop(0, '#1a1f2b')
  g.addColorStop(1, '#3a1f10')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = 'rgba(255,122,26,0.85)'
  ctx.beginPath()
  ctx.arc(W * 0.78, H * 0.35, 60, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#fff'
  ctx.font = 'bold 42px sans-serif'
  ctx.fillText(time, 24, 70)
  ctx.font = '20px sans-serif'
  ctx.fillText('LayerOS', 24, 100)
  ctx.fillStyle = 'rgba(0,0,0,0.55)'
  ctx.fillRect(0, H - 40, W, 40)
  ctx.fillStyle = '#fff'
  ctx.font = '18px sans-serif'
  ctx.fillText(`✉ ${unread}   📦 ${newOrders}`, 16, H - 14)
}
