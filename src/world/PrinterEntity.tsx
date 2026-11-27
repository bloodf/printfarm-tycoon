import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useGame } from '../game/store'
import { runtime } from '../game/runtime'
import { audio, type LoopHandle } from '../game/audio'
import { getItem, getPrinter, getSpool } from '../sim/sim'
import { PRODUCTS, type ProductId } from '../data/products'
import { COLORS, SPOOL_GRAMS } from '../data/filaments'
import { PRINTERS } from '../data/printers'
import type { Printer } from '../sim/types'
import { cloneNode, findMaterial, findNode, part, setRelScale, useModel } from './assets'
import { makePrintMaterial, setBands } from './printMaterial'
import { makeSpaghettiGeometry, setSpaghettiAmount } from './spaghetti'
import { makeScreenTexture, paintPrinterScreen, screenOn } from './screens'
import { register } from './interact'
import { printerTarget } from './targets'

interface Rig {
  root: THREE.Object3D
  bed?: THREE.Object3D
  gz?: THREE.Object3D
  gy?: THREE.Object3D
  cx?: THREE.Object3D
  origin: THREE.Object3D
  mounts: THREE.Object3D[]
  entry?: THREE.Object3D
  inlet?: THREE.Object3D
  door?: THREE.Object3D
  usb?: THREE.Object3D
  tools: THREE.Object3D[]
  kind: 'bedslinger' | 'corexy'
  xr: [number, number]
  yr: [number, number]
  zr: [number, number]
}

const LED_COLORS: Record<Printer['status'], string> = {
  idle: '#3dff7a', waiting_usb: '#4aa8ff', heating: '#ff8a3d', printing: '#4aa8ff', paused_runout: '#ff2a2a', done: '#ffd23a',
  paused_power: '#000000', error: '#ff2a2a', updating: '#b48cff',
}

const tmpV = new THREE.Vector3()
const tmpV2 = new THREE.Vector3()

/** Pseudo toolpath over the part footprint: perimeters, then zig-zag infill (local metres). */
function toolpath(t: number, fw: number, fd: number): [number, number] {
  const u = (t * 0.32) % 1
  if (u < 0.3) {
    const a = (u / 0.3) * Math.PI * 2
    return [Math.cos(a) * fw * 0.5, Math.sin(a) * fd * 0.5]
  }
  const v = (u - 0.3) / 0.7
  const lines = 9
  const li = Math.min(lines - 1, Math.floor(v * lines))
  const along = v * lines - li
  const x = (li % 2 ? 1 - along : along) * fw - fw / 2
  const y = (li / (lines - 1)) * fd - fd / 2
  return [x * 0.85, y * 0.85]
}

const meshOf = (pid: ProductId) => PRODUCTS[pid].mesh ?? pid

export function PrinterEntity({ printerId, position, rotY = 0 }: { printerId: string; position: THREE.Vector3; rotY?: number }) {
  const printer = useGame.getState().sim.printers.find((p) => p.id === printerId)!
  const modelId = printer.modelId
  const model = PRINTERS[modelId]
  const gltf = useModel(modelId)
  const products = useModel('products')
  const spoolGltf = useModel('spool')

  const rig = useMemo<Rig>(() => {
    const root = cloneNode(gltf.scene, /^(Filament|Screen|LED|ToolColor)/)
    const top = findNode(root, modelId)!
    const ex = top.userData as Record<string, unknown>
    const single = findNode(root, 'SpoolMount')
    const mounts = single ? [single] : [0, 1, 2, 3, 4].map((i) => findNode(root, `SpoolMount_${i}`)).filter(Boolean) as THREE.Object3D[]
    const tools = [0, 1, 2, 3, 4].map((i) => findNode(root, `Tool_${i}`)).filter(Boolean) as THREE.Object3D[]
    return {
      root, bed: findNode(root, 'Bed'), gz: findNode(root, 'GantryZ'), gy: findNode(root, 'GantryY'), cx: findNode(root, 'CarriageX'),
      origin: findNode(root, 'PrintOrigin')!, mounts, tools,
      entry: findNode(root, 'FilamentEntry'), inlet: findNode(root, 'ToolheadInlet'), door: findNode(root, 'Door'), usb: findNode(root, 'USBPort'),
      kind: (ex.kind as Rig['kind']) ?? 'bedslinger',
      xr: (ex.x_range as [number, number]) ?? [-0.1, 0.1], yr: ((ex.bed_range ?? ex.y_range) as [number, number]) ?? [-0.1, 0.1],
      zr: (ex.z_range as [number, number]) ?? [0, 0.2],
    }
  }, [gltf, modelId])

  // ---------------------------------------------------------------- screen + LED + tool colour rings
  // texture in a memo, material hookup in an effect (StrictMode double-runs memo bodies: no side effects there)
  const screen = useMemo(() => makeScreenTexture(320, 200), [])
  useEffect(() => {
    for (const m of findMaterial(rig.root, /^Screen$/)) {
      m.map = screen.tex
      m.emissiveMap = screen.tex
      m.emissive = new THREE.Color('#ffffff')
      m.emissiveIntensity = 1.1
      m.color = new THREE.Color('#000000')
      m.toneMapped = false
      m.needsUpdate = true
    }
  }, [rig, screen])
  const ledMats = useMemo(() => findMaterial(rig.root, /^LED$/), [rig])
  const toolMats = useMemo(() => [0, 1, 2, 3, 4].map((i) => findMaterial(rig.root, new RegExp(`^ToolColor_${i}$`))[0]), [rig])
  const activeMat = useMemo(() => findMaterial(rig.root, /^ToolColor_Active$/)[0], [rig])
  const strandMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.35 }), [])

  // ---------------------------------------------------------------- spools (one per tool mount)
  const spools = useMemo(
    () =>
      rig.mounts.map(() => {
        const s = cloneNode(findNode(spoolGltf.scene, 'spool')!)
        return { obj: s, winding: findNode(s, 'FilamentWinding')!, mat: findMaterial(s, /^Filament/)[0], spin: 0 }
      }),
    [spoolGltf, rig],
  )
  useEffect(() => {
    spools.forEach((sp, i) => rig.mounts[i]?.add(sp.obj))
    return () => spools.forEach((sp) => sp.obj.removeFromParent())
  }, [rig, spools])

  // ---------------------------------------------------------------- USB stick
  const usbStick = useMemo(() => {
    const g = new THREE.Group()
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.006, 0.012), new THREE.MeshStandardMaterial({ color: '#1e5bd6', roughness: 0.4 }))
    body.position.x = 0.012
    const plug = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.004, 0.01), new THREE.MeshStandardMaterial({ color: '#c9ccd0', metalness: 1, roughness: 0.3 }))
    g.add(body, plug)
    g.visible = false
    return g
  }, [])
  useEffect(() => {
    rig.usb?.add(usbStick)
    return () => {
      usbStick.removeFromParent()
    }
  }, [rig, usbStick])

  // ---------------------------------------------------------------- bed content (print object, spaghetti)
  const bedRef = useRef<{ key: string; group: THREE.Group; mat: ReturnType<typeof makePrintMaterial> | null; spag: THREE.Mesh | null; height: number; part: THREE.Object3D | null } | null>(null)

  function buildBed(key: string, productId: ProductId | null, color: string, withSpaghetti: boolean, seed: number) {
    const prev = bedRef.current
    if (prev) {
      prev.group.removeFromParent()
      prev.group.traverse((o) => {
        const m = o as THREE.Mesh
        if (m.isMesh && m.geometry && o.userData.ownGeo) m.geometry.dispose()
      })
      prev.mat?.dispose()
    }
    const group = new THREE.Group()
    let mat: ReturnType<typeof makePrintMaterial> | null = null
    let height = 0
    let partObj: THREE.Object3D | null = null
    if (productId) {
      const src = part(products, meshOf(productId))
      height = (src.userData.height as number) ?? 0.05
      partObj = src.clone(true)
      partObj.position.set(0, 0, 0)
      mat = makePrintMaterial(color)
      partObj.traverse((o) => {
        const m = o as THREE.Mesh
        if (m.isMesh) {
          m.material = mat!
          m.castShadow = true
          m.receiveShadow = true
        }
      })
      group.add(partObj)
    }
    let spag: THREE.Mesh | null = null
    if (withSpaghetti) {
      const geo = makeSpaghettiGeometry(seed)
      spag = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.4 }))
      spag.userData.ownGeo = true
      spag.castShadow = true
      group.add(spag)
    }
    rig.origin.add(group)
    bedRef.current = { key, group, mat, spag, height, part: partObj }
  }

  // ---------------------------------------------------------------- filament strand (single-tool printers)
  const strand = useMemo(() => {
    const mesh = new THREE.Mesh(new THREE.BufferGeometry(), strandMat)
    mesh.frustumCulled = false
    return mesh
  }, [strandMat])

  // ---------------------------------------------------------------- power cable to the nearest outlet (bench printers)
  const power = useMemo(() => {
    const wp = position
    const grp = new THREE.Group()
    if (wp.z > -2.4) return grp // island table / XL cart: cables run under the table (not modelled)
    const outlets = [-1.0, 0.0, 1.0]
    const ox = outlets.reduce((a, b) => (Math.abs(b - wp.x) < Math.abs(a - wp.x) ? b : a))
    const pts = [
      new THREE.Vector3(wp.x + 0.09, wp.y + 0.035, wp.z - 0.16), new THREE.Vector3(wp.x + 0.11, wp.y + 0.012, wp.z - 0.3),
      new THREE.Vector3((wp.x + ox) / 2 + 0.05, wp.y + 0.008, -3.19), new THREE.Vector3(ox + 0.03, 1.02, -3.222),
      new THREE.Vector3(ox + 0.015, 1.095, -3.222),
    ]
    const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, 0.0032, 6, false)
    const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: '#161616', roughness: 0.55 }))
    mesh.castShadow = true
    const plug = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.034, 0.024), new THREE.MeshStandardMaterial({ color: '#f0efea', roughness: 0.4 }))
    plug.position.set(ox + 0.015, 1.1, -3.215)
    grp.add(mesh, plug)
    return grp
  }, [position])
  // chamber light for enclosed printers
  const chamber = useMemo(() => {
    if (!model.enclosed) return null
    const l = new THREE.PointLight('#fff1dc', 0.5, 0.7, 2)
    l.position.set(0, 0.39, 0.09)
    return l
  }, [model.enclosed])

  // ---------------------------------------------------------------- audio loops + interaction proxy
  const proxy = useMemo(() => {
    const box = new THREE.Box3().setFromObject(rig.root)
    const size = box.getSize(new THREE.Vector3())
    const center = box.getCenter(new THREE.Vector3())
    const h = Math.min(size.y, 0.9)
    const m = new THREE.Mesh(new THREE.BoxGeometry(size.x * 0.92, h, size.z * 0.9), new THREE.MeshBasicMaterial({ visible: false }))
    m.position.set(center.x, h / 2, center.z)
    return m
  }, [rig])

  const loops = useRef<{ steppers: LoopHandle; fan: LoopHandle } | null>(null)
  useEffect(() => {
    const unreg = register({ uid: `printer:${printerId}`, object: proxy, outline: [rig.root], target: () => printerTarget(printerId) })
    const wp = position.clone()
    runtime.printerPos.set(printerId, wp)
    runtime.printerFacing.set(printerId, new THREE.Vector3(Math.sin(rotY), 0, Math.cos(rotY)))
    const camNode = findNode(rig.root, 'Camera')
    if (camNode) runtime.printerCam.set(printerId, { cam: camNode, look: rig.origin })
    const p: [number, number, number] = [wp.x, wp.y + 0.25, wp.z]
    loops.current = {
      steppers: audio.loop('printer_steppers_loop', { pos: p, volume: 0, ref: 0.7 }),
      fan: audio.loop('printer_fan_loop', { pos: p, volume: 0, ref: 0.6 }),
    }
    return () => {
      unreg()
      loops.current?.steppers.stop()
      loops.current?.fan.stop()
      runtime.printerPos.delete(printerId)
      runtime.printerFacing.delete(printerId)
      runtime.printerCam.delete(printerId)
    }
  }, [printerId, proxy, rig, position, rotY])

  const anim = useRef({ x: 0, y: 0, z: 0.02, screenT: 0, strandT: 0, door: 0, windR: 1, activeTool: -1, lastBand: -1 })

  useFrame((state, dt) => {
    const s = useGame.getState().sim
    const p = getPrinter(s, printerId)
    if (!p) return
    const a = anim.current
    const t = state.clock.elapsedTime
    const ff = useGame.getState().fastForward
    const job = p.job
    const frac = job ? Math.min(1, job.elapsedMin / job.durationMin) : 0
    const powered = screenOn(s)

    // ---- what is on the bed
    let key = 'empty'
    let productId: ProductId | null = null
    let colors: string[] = ['#ffffff']
    let showH = 0
    let spaghetti = 0
    let knocked = false
    let shiftAt = -1
    let hot = 0
    if (job && ['printing', 'paused_runout', 'heating', 'paused_power', 'error'].includes(p.status)) {
      productId = job.productId
      colors = job.colors.map((c) => COLORS[c].hex)
      const stop = job.failed && job.failure?.type !== 'layer_shift' ? job.stoppedAt ?? frac : frac
      showH = Math.min(frac, stop)
      const isSpag = job.failed && job.failure?.type === 'spaghetti'
      if (isSpag) {
        knocked = true
        spaghetti = Math.min(1, job.spaghettiGrams / 25)
      }
      if (job.failed && job.failure?.type === 'layer_shift') shiftAt = job.failure.at
      hot = p.status === 'printing' && !(job.failed && job.failure?.type === 'clog') ? 1 : 0
      key = `job:${job.id}:${isSpag ? 's' : ''}`
    } else if (p.bedItemId) {
      const it = getItem(s, p.bedItemId)
      if (it) {
        productId = it.productId
        colors = it.colors.map((c) => COLORS[c].hex)
        showH = it.fraction
        if (it.defect === 'spaghetti') {
          knocked = true
          spaghetti = 1
        }
        if (it.defect === 'layer_shift') shiftAt = 0.5
        key = `item:${it.id}:${it.defect === 'spaghetti' ? 's' : ''}`
      }
    }
    if (!bedRef.current || bedRef.current.key !== key) {
      buildBed(key, productId, colors[0], spaghetti > 0 || key.endsWith(':s'), (job?.id ?? p.bedItemId ?? 'x').split('').reduce((h, c) => h * 31 + c.charCodeAt(0), 7))
    }
    const bed = bedRef.current!
    if (bed.mat) {
      rig.origin.getWorldPosition(tmpV)
      const h = bed.height * showH
      const u = bed.mat.userData.u
      setBands(bed.mat, colors, tmpV.y, bed.height)
      u.uClipY.value = knocked ? 1e6 : tmpV.y + h + 0.00001
      u.uHot.value = hot
      if (shiftAt >= 0 && showH > shiftAt) {
        u.uShiftY.value = tmpV.y + bed.height * shiftAt
        u.uShiftX.value = 0.004
      } else {
        u.uShiftY.value = 1e6
        u.uShiftX.value = 0
      }
      if (bed.part) {
        if (knocked) {
          setRelScale(bed.part, 1, Math.max(0.05, showH), 1)
          bed.part.rotation.set(Math.PI / 2.3, 0, 0.4)
          bed.part.position.set(0.035, 0.012, 0.02)
        } else {
          setRelScale(bed.part, 1, 1, 1)
          bed.part.rotation.set(0, 0, 0)
          bed.part.position.set(0, 0, 0)
        }
        bed.part.visible = showH > 0.002
      }
    }
    if (bed.spag) setSpaghettiAmount(bed.spag.geometry as THREE.TubeGeometry, Math.max(spaghetti, 0.02))

    // ---- multicolour: which tool is active (colour band of the current layer)
    const band = job && job.colors.length > 1 ? Math.min(job.colors.length - 1, Math.floor(showH * job.colors.length)) : 0
    const activeTool = job && p.status === 'printing' ? job.tools[band] ?? 0 : -1
    if (job && job.colors.length > 1 && band !== a.lastBand && p.status === 'printing' && a.lastBand >= 0) {
      const wp = runtime.printerPos.get(printerId)
      if (wp) audio.play(model.multi === 'ams' ? 'ams_feed' : 'toolchange', { pos: [wp.x, wp.y + 0.3, wp.z], volume: 0.8 })
    }
    a.lastBand = job ? band : -1

    // ---- motion
    const prod = productId ? PRODUCTS[productId] : null
    const fw = prod ? prod.footprint[0] / 1000 : 0.05
    const fd = prod ? prod.footprint[1] / 1000 : 0.05
    let tx = rig.xr[0] + 0.01
    let ty = rig.yr[1] * 0.9
    let tz = 0.03
    const layerZ = bed.height * showH
    const moving = p.status === 'printing' && powered
    if (moving && job) {
      const [x, y] = toolpath(t * (ff ? 2.2 : 1), fw, fd)
      tx = x
      ty = y
      tz = knocked ? layerZ + 0.02 + Math.min(0.05, (frac - (job.stoppedAt ?? 0)) * 0.2) : layerZ + 0.0003
    } else if (p.status === 'heating') {
      tx = 0
      ty = 0
      tz = 0.006
    } else if (p.status === 'paused_runout' || p.status === 'error' || p.status === 'paused_power') {
      tx = p.status === 'paused_power' ? a.x : rig.xr[0] + 0.02
      ty = p.status === 'paused_power' ? a.y : rig.yr[1] * 0.8
      tz = layerZ + 0.012
    } else if (p.status === 'done') {
      tx = rig.xr[0] + 0.01
      ty = rig.kind === 'bedslinger' ? -rig.yr[1] : rig.yr[1] * 0.9
      tz = bed.height + 0.03
    }
    const k = 1 - Math.exp(-dt * (moving ? 28 : 5))
    a.x += (tx - a.x) * k
    a.y += (ty - a.y) * k
    a.z += (tz - a.z) * (1 - Math.exp(-dt * 6))
    if (rig.kind === 'bedslinger') {
      if (rig.cx) rig.cx.position.x = a.x
      if (rig.bed) rig.bed.position.z = -a.y
      if (rig.gz) rig.gz.position.y = a.z
    } else {
      if (rig.cx) rig.cx.position.x = a.x
      if (rig.gy) rig.gy.position.z = -a.y
      if (rig.bed) rig.bed.position.y = -a.z
    }

    // ---- spools on their mounts + tool colour rings
    p.spools.forEach((sid, i) => {
      const sp = getSpool(s, sid)
      const vis = spools[i]
      if (vis) {
        vis.obj.visible = !!sp
        if (sp) {
          vis.mat.color.set(COLORS[sp.color].hex)
          const core = 0.05 / 0.088
          const r = Math.sqrt(core * core + (1 - core * core) * Math.max(0, sp.grams) / SPOOL_GRAMS)
          setRelScale(vis.winding, r, r, 1)
          vis.winding.visible = sp.grams > 1
          if (i === 0) a.windR = r
          if (moving && (activeTool === i || (job?.colors.length === 1 && i === (job?.tools[0] ?? 0)))) vis.spin += dt * (ff ? 0.9 : 0.12)
          vis.obj.rotation.z = vis.spin
        }
      }
      const tm = toolMats[i]
      if (tm) {
        const c = sp ? COLORS[sp.color].hex : '#333333'
        tm.color.set(c)
        tm.emissive.set(c)
        tm.emissiveIntensity = powered && sp ? 0.9 : 0
      }
    })
    if (activeMat) {
      const c = job && activeTool >= 0 ? COLORS[job.colors[band]].hex : '#555555'
      activeMat.color.set(c)
      activeMat.emissive.set(c)
      activeMat.emissiveIntensity = powered && activeTool >= 0 ? 1.2 : 0.1
    }
    // toolchangers: the docked head that is on the carriage disappears from the dock
    rig.tools.forEach((tn, i) => (tn.visible = !(model.multi === 'toolchanger' && activeTool === i)))
    if (p.spools.length === 1 && spools[0]) strandMat.color.set(spools[0].mat.color)

    // ---- USB stick, door, LED, chamber light
    usbStick.visible = p.status === 'waiting_usb' || (p.modelId === 'ender3v3' && !!job && p.status !== 'done')
    if (rig.door) {
      const want = runtime.doorOpen.get(printerId) ?? 0
      a.door += (want - a.door) * (1 - Math.exp(-dt * 5))
      rig.door.rotation.y = -a.door * 1.75
    }
    const blink = ['paused_runout', 'waiting_usb', 'error'].includes(p.status) ? Math.sin(t * 8) > 0 : true
    for (const m of ledMats) {
      m.emissive.set(LED_COLORS[p.status])
      m.emissiveIntensity = powered ? (blink ? 3 : 0.2) : 0
      m.color.set(powered ? LED_COLORS[p.status] : '#111111')
    }
    if (chamber) chamber.intensity = powered ? 0.5 : 0

    // ---- screen (4 Hz)
    a.screenT -= dt
    if (a.screenT <= 0) {
      a.screenT = 0.25
      paintPrinterScreen(screen.ctx, s, p, Math.sin(t * 6) > 0)
      screen.tex.needsUpdate = true
    }

    // ---- filament strand (single-tool printers, 10 Hz)
    const sp0 = p.spools.length === 1 ? getSpool(s, p.spools[0]) : undefined
    a.strandT -= dt
    if (a.strandT <= 0 && sp0 && sp0.grams > 1 && rig.entry && rig.inlet && rig.mounts[0]) {
      a.strandT = moving ? 0.05 : 0.5
      rig.entry.getWorldPosition(tmpV)
      rig.inlet.getWorldPosition(tmpV2)
      const spoolC = rig.mounts[0].getWorldPosition(new THREE.Vector3())
      const toEntry = tmpV.clone().sub(spoolC).setZ(0).normalize().multiplyScalar(0.085 * a.windR)
      const A = spoolC.clone().add(toEntry)
      const mid = tmpV.clone().lerp(tmpV2, 0.5)
      mid.y -= 0.02
      strand.geometry.dispose()
      strand.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([A, tmpV.clone(), mid, tmpV2.clone()]), 40, 0.0009, 5, false)
      strand.visible = true
    } else if (!sp0 || sp0.grams <= 1) strand.visible = false

    // ---- audio
    if (loops.current) {
      const clogged = !!job?.failed && job.failure?.type === 'clog'
      loops.current.steppers.setVolume(moving ? 0.55 : 0)
      loops.current.steppers.setRate(ff ? 1.25 : 1)
      loops.current.fan.setVolume(moving ? (clogged ? 0.25 : 0.5) : p.status === 'heating' && powered ? 0.25 : 0)
    }
  })

  return (
    <>
      <group position={position} rotation-y={rotY}>
        <primitive object={rig.root} />
        <primitive object={proxy} />
        {chamber && <primitive object={chamber} />}
      </group>
      <primitive object={strand} />
      <primitive object={power} />
    </>
  )
}
