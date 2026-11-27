import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { useGame } from '../game/store'
import { audio, type LoopHandle } from '../game/audio'
import { useSettings } from '../game/settings'
import { clock } from '../game/format'
import { minuteOfDay } from '../sim/sim'
import { COLORS } from '../data/filaments'
import { cloneNode, findMaterial, findNode, part, setRelScale, useModel } from './assets'
import { CRATE_ZONE, HOUSE_DOOR, PLACEMENTS } from './layout'
import { register } from './interact'
import {
  crateTarget, floorItemTarget, houseDoorTarget, laptopTarget, outboxItemTarget, outboxTarget, packedBoxTarget,
  packingTableTarget, shelfTarget, spoolTarget, tableItemTarget, trashTarget,
} from './targets'
import { PrinterEntity } from './PrinterEntity'
import { makeScreenTexture, paintLaptopScreen } from './screens'
import { ItemModel } from './ItemModel'
import { applyWeathering } from './weathering'
import { SLOTS } from '../data/garage'
import { Dryers } from './Dryers'

/** Lightmap exposure relative to the real-time lights (Cycles irradiance → three.js lightMap units). */
const LIGHTMAP_GAIN = 0.38

/** Art-directed material tweaks applied at load (lets us grade surfaces without rebuilding GLBs). */
const MATERIAL_TINT: Record<string, string> = {
  BlockWall: '#b8b3aa', // warm light-grey paint (pure off-white read as flat CG)
  Drywall: '#cfcac2',
  ConcreteFloor: '#d8d6d2',
}
function tintMaterials(root: THREE.Object3D) {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh) return
    const m = mesh.material as THREE.MeshStandardMaterial
    const key = Object.keys(MATERIAL_TINT).find((k) => m.name.startsWith(k))
    if (key && !m.userData.tinted) {
      m.color.set(MATERIAL_TINT[key])
      m.userData.tinted = true
    }
  })
}

/** Lightmapped materials + their full-power intensity: dimmed during power outages (the bake includes the ceiling
 *  lights' bounce light; with the power off only the window's share remains). */
const lightmapped: { m: THREE.MeshStandardMaterial; base: number }[] = []
/** Share of the baked indirect light that comes through the window (stays on during an outage, scaled by daylight). */
const LM_WINDOW_SHARE = 0.22

/** Apply the Cycles-baked indirect lightmaps (public/assets/lightmaps) to the garage shell, by object name. */
function useLightmaps(root: THREE.Object3D) {
  useEffect(() => {
    let cancelled = false
    fetch('/assets/lightmaps/manifest.json')
      .then((r) => (r.ok ? r.json() : {}))
      .then((manifest: Record<string, { file: string; scale: number }>) => {
        if (cancelled) return
        const loader = new THREE.TextureLoader()
        for (const [name, lm] of Object.entries(manifest)) {
          const node = findNode(root, name)
          if (!node) continue
          const tex = loader.load(lm.file)
          tex.channel = 1
          tex.flipY = false
          tex.colorSpace = THREE.SRGBColorSpace
          node.traverse((o) => {
            const mesh = o as THREE.Mesh
            if (!mesh.isMesh || !mesh.geometry.getAttribute('uv1')) return
            const m = (mesh.material as THREE.MeshStandardMaterial).clone()
            m.userData.tinted = true
            m.lightMap = tex
            m.lightMapIntensity = lm.scale * Math.PI * LIGHTMAP_GAIN
            lightmapped.push({ m, base: m.lightMapIntensity })
            m.envMapIntensity = 0.45
            applyWeathering(m)
            mesh.material = m
          })
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
      lightmapped.length = 0
    }
  }, [root])
}

RectAreaLightUniformsLib.init()

/** Named world points (slots, cameras) collected after props are placed. */
export const points = new Map<string, THREE.Object3D>()

function useEnvironment() {
  const { gl, scene } = useThree()
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl)
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    scene.environment = env
    scene.environmentIntensity = 0.18
    return () => {
      env.dispose()
      pmrem.dispose()
    }
  }, [gl, scene])
}

function Lights() {
  const shadows = useSettings((s) => s.graphics.shadows)
  const sun = useRef<THREE.DirectionalLight>(null)
  const spot = useRef<THREE.SpotLight>(null)
  const { scene } = useThree()
  useEffect(() => {
    if (sun.current) {
      sun.current.target.position.set(0.5, 0, -0.6)
      scene.add(sun.current.target)
    }
    if (spot.current) {
      spot.current.target.position.set(0, 0, -1.2)
      scene.add(spot.current.target)
    }
  }, [scene])
  const battens = useRef<THREE.RectAreaLight[]>([])
  const fill = useRef<THREE.PointLight>(null)
  const lit = useRef(1)
  // daylight colour/intensity follows the in-game time; the artificial lights follow the power (outages!)
  useFrame((_, dt) => {
    const sim = useGame.getState().sim
    lit.current += ((sim.power ? 1 : 0) - lit.current) * (1 - Math.exp(-dt * (sim.power ? 3 : 30)))
    battens.current.forEach((l) => l && (l.intensity = 5 * lit.current))
    if (spot.current) spot.current.intensity = 9 * lit.current
    if (fill.current) fill.current.intensity = 1.2 * lit.current
    setPanelGlow(lit.current)
    const m = minuteOfDay(sim.time)
    const day = THREE.MathUtils.smoothstep(m, 6.5 * 60, 9 * 60) * (1 - THREE.MathUtils.smoothstep(m, 18 * 60, 20.5 * 60))
    const lmScale = lit.current + (1 - lit.current) * LM_WINDOW_SHARE * (0.15 + 0.85 * day)
    for (const l of lightmapped) l.m.lightMapIntensity = l.base * lmScale
    scene.environmentIntensity = 0.18 * (0.35 + 0.65 * lmScale)
    if (sun.current) {
      sun.current.intensity = 1.9 * day
      const warm = THREE.MathUtils.smoothstep(m, 15 * 60, 19 * 60)
      sun.current.color.setRGB(1, 0.93 - warm * 0.2, 0.82 - warm * 0.35)
      const a = ((m - 6 * 60) / (14 * 60)) * Math.PI
      sun.current.position.set(7, 2.2 + Math.sin(a) * 3.5, -0.6 - Math.cos(a) * 3)
    }
  })
  return (
    <>
      <hemisphereLight args={['#dfe7f2', '#4a4036', 0.06]} />
      {[-1.3, 1.3].map((x, i) => (
        <rectAreaLight key={x} ref={(l) => { if (l) battens.current[i] = l }} args={['#f4f8ff', 5, 0.12, 1.2]} position={[x, 2.6, -0.3]} rotation={[-Math.PI / 2, 0, 0]} />
      ))}
      <spotLight
        ref={spot} position={[0, 2.62, -0.6]} angle={1.0} penumbra={1} intensity={9} decay={2} distance={9} color="#f3f6ff"
        castShadow={shadows} shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} shadow-normalBias={0.03}
      />
      <pointLight ref={fill} position={[0, 2.3, 2.2]} intensity={1.2} decay={2} distance={6} color="#eef3ff" />
      <directionalLight
        ref={sun} position={[7, 4.5, -0.6]} intensity={3} color="#fff1dc" castShadow={shadows} shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0006} shadow-normalBias={0.04} shadow-camera-left={-4} shadow-camera-right={4} shadow-camera-top={4}
        shadow-camera-bottom={-4} shadow-camera-near={0.5} shadow-camera-far={16}
      />
    </>
  )
}

/** Ceiling light panels (emissive) dim with the power. */
const panelMats: THREE.MeshStandardMaterial[] = []
function setPanelGlow(f: number) {
  for (const m of panelMats) m.emissiveIntensity = (m.userData.baseEmissive as number) * f
}

/** A placed prop, optionally registered as an interactable and as a collider. */
function placeProp(props: THREE.Object3D, name: string) {
  return cloneNode(part({ scene: props } as never, name))
}

export function Level() {
  useEnvironment()
  const garage = useModel('garage')
  const props = useModel('props')
  const printers = useGame((g) => g.sim.printers.map((p) => `${p.id}:${p.slot}`).join(','))
  const rev = useGame((g) => g.rev)

  // ---------------------------------------------------------------- static level
  const level = useMemo(() => {
    const root = new THREE.Group()
    const g = cloneNode(garage.scene)
    g.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      if (o.name.startsWith('OutsideView') || o.name.startsWith('LightBatten')) {
        m.castShadow = false
        m.receiveShadow = false
      }
      if (o.name === 'Floor' || o.name === 'Ceiling') m.castShadow = false
    })
    for (const mt of findMaterial(g, /^(LightPanel|WindowGlow)/)) mt.toneMapped = false
    panelMats.length = 0
    for (const mt of findMaterial(g, /^LightPanel/)) {
      mt.userData.baseEmissive = mt.emissiveIntensity
      panelMats.push(mt)
    }
    for (const mt of findMaterial(g, /^Decal_decal_outside/)) mt.emissiveIntensity = 2.6 // daylight outside reads bright
    tintMaterials(g)
    root.add(g)
    const placed = new Map<string, THREE.Object3D>()
    for (const pl of PLACEMENTS) {
      if (pl.prop === 'filament_dryer') continue // dryers are live entities (see <Dryers />)
      if (!findNode(props.scene, pl.prop)) {
        console.warn(`[level] prop "${pl.prop}" missing from props.glb — skipped (rebuild assets)`)
        continue
      }
      const obj = placeProp(props.scene, pl.prop)
      obj.position.set(...pl.pos)
      obj.rotation.y = pl.rotY
      const parent = pl.parent ? placed.get(pl.parent) : root
      parent!.add(obj)
      placed.set(pl.prop, obj)
    }
    root.updateMatrixWorld(true)
    // named points
    points.clear()
    root.traverse((o) => {
      if (/^(Slot_|SpoolSlot_|SupplySlot_|OutSlot_|StockSlot_|PackSlot|ItemSlot|PackCam|PackLook|LaptopCam|LaptopLook|HourHand|MinuteHand|LaptopScreen|TrashDrop)/.test(o.name)) points.set(o.name, o)
    })
    return { root, placed }
  }, [garage, props])

  useLightmaps(level.root)

  // ---------------------------------------------------------------- practical light: warm desk lamp
  const lamp = useMemo(() => {
    const desk = level.placed.get('desk')
    if (!desk) return null
    desk.updateMatrixWorld(true)
    return { pos: desk.localToWorld(new THREE.Vector3(0.38, 1.13, -0.1)), at: desk.localToWorld(new THREE.Vector3(0.2, 0.75, 0.05)) }
  }, [level])

  // ---------------------------------------------------------------- interactables: static furniture
  useEffect(() => {
    const unregs: (() => void)[] = []
    const add = (uid: string, obj: THREE.Object3D, target: () => ReturnType<typeof laptopTarget> | null, outline?: THREE.Object3D[]) => {
      unregs.push(register({ uid, object: obj, outline: outline ?? [obj], target }))
    }
    const proxyBox = (sx: number, sy: number, sz: number, at: THREE.Vector3) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), new THREE.MeshBasicMaterial({ visible: false }))
      m.position.copy(at)
      level.root.add(m)
      unregs.push(() => m.removeFromParent())
      return m
    }
    const P = level.placed
    const wp = (o: THREE.Object3D) => o.getWorldPosition(new THREE.Vector3())
    // laptop
    // mesh nodes carry a quantisation offset: use their world bounding-box centre, not their origin
    const lsBox = new THREE.Box3().setFromObject(points.get('LaptopScreen')!)
    add('laptop', proxyBox(0.4, 0.3, 0.4, lsBox.getCenter(new THREE.Vector3()).add(new THREE.Vector3(0, -0.05, 0))), laptopTarget, [P.get('desk')!])
    // shelf (whole unit)
    add('shelf', proxyBox(0.5, 1.85, 1.25, wp(P.get('shelf_boltless')!).add(new THREE.Vector3(0, 0.92, 0))), shelfTarget, [P.get('shelf_boltless')!])
    add('packing', proxyBox(0.85, 0.3, 1.65, wp(P.get('packing_table')!).add(new THREE.Vector3(0, 0.95, 0))), packingTableTarget, [P.get('packing_table')!])
    add('outbox', proxyBox(0.5, 1.15, 1.05, wp(P.get('outbox_shelf')!).add(new THREE.Vector3(0, 0.57, 0))), outboxTarget, [P.get('outbox_shelf')!])
    add('trash', proxyBox(0.42, 0.72, 0.42, wp(P.get('trash_bin')!).add(new THREE.Vector3(0, 0.36, 0))), trashTarget, [P.get('trash_bin')!])
    const hd = findNode(level.root, 'HouseDoorSlab')
    add('housedoor', proxyBox(HOUSE_DOOR.size[0], HOUSE_DOOR.size[1], HOUSE_DOOR.size[2], new THREE.Vector3(...HOUSE_DOOR.pos)), houseDoorTarget, hd ? [hd] : [])
    return () => unregs.forEach((u) => u())
  }, [level])

  // ---------------------------------------------------------------- laptop screen texture (world)
  // texture in a memo, material hookup in an effect (StrictMode double-runs memo bodies: no side effects there)
  const laptopTex = useMemo(() => makeScreenTexture(512, 320), [])
  useEffect(() => {
    const ls = points.get('LaptopScreen') as THREE.Mesh | undefined
    if (!ls) return
    const m = (ls.material as THREE.MeshStandardMaterial).clone()
    m.map = laptopTex.tex
    m.emissiveMap = laptopTex.tex
    m.emissive = new THREE.Color('#ffffff')
    m.emissiveIntensity = 0.9
    m.color = new THREE.Color('#000')
    m.toneMapped = false
    ls.material = m
  }, [level, laptopTex])

  // ---------------------------------------------------------------- clock, laptop screen, ambience, radio
  const amb = useRef<{ room: LoopHandle; music: LoopHandle; rain: LoopHandle } | null>(null)
  useEffect(() => {
    const radio = level.placed.get('radio')!
    const rp = radio.getWorldPosition(new THREE.Vector3())
    amb.current = {
      room: audio.loop('room_tone_loop', { bus: 'ambience', volume: 0.8 }),
      rain: audio.loop('rain_loop', { bus: 'ambience', volume: 0 }),
      music: audio.loop('music_lofi_loop', { bus: 'music', volume: 0.9, pos: [rp.x, rp.y + 0.1, rp.z], ref: 2.2 }),
    }
    return () => {
      amb.current?.room.stop(1)
      amb.current?.rain.stop(1)
      amb.current?.music.stop(1)
    }
  }, [level])

  const tick = useRef(0)
  useFrame((_, dt) => {
    const s = useGame.getState().sim
    const m = minuteOfDay(s.time)
    const hh = points.get('HourHand')
    const mh = points.get('MinuteHand')
    // Blender -Y axis → three +Z; rotate about the clock's local Z (facing axis)
    if (hh) hh.rotation.z = -((m / 60) % 12) / 12 * Math.PI * 2
    if (mh) mh.rotation.z = -(m % 60) / 60 * Math.PI * 2
    tick.current -= dt
    if (tick.current <= 0) {
      tick.current = 1
      const humid = s.incidents.some((i) => i.type === 'humid_day' && i.start <= s.time && s.time < i.end)
      amb.current?.rain.setVolume(humid ? 0.55 : 0, 2)
      amb.current?.music.setVolume(s.power ? 0.9 : 0, 0.2)
      paintLaptopScreen(laptopTex.ctx, clock(s.time), s.mail.filter((x) => !x.read).length, s.orders.filter((o) => o.status === 'new').length)
      laptopTex.tex.needsUpdate = true
    }
  })

  // ---------------------------------------------------------------- printers on the workbench
  const printerList = useMemo(() => {
    const s = useGame.getState().sim
    return s.printers.flatMap((p) => {
      const def = SLOTS.find((x) => x.id === p.slot)
      const prop = def && level.placed.get(def.prop)
      const node = prop && findNode(prop, def.node)
      if (!node || !def) return []
      const pos = node.getWorldPosition(new THREE.Vector3())
      const rotY = PLACEMENTS.find((x) => x.prop === def.prop)?.rotY ?? 0
      return [{ id: p.id, pos, rotY }]
    })
  }, [printers, level]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <primitive object={level.root} />
      <Lights />
      {lamp && <DeskLamp pos={lamp.pos} at={lamp.at} />}
      {printerList.map((p) => (
        <PrinterEntity key={p.id} printerId={p.id} position={p.pos} rotY={p.rotY} />
      ))}
      <Dryers rev={rev} />
      <ShelfSpools rev={rev} />
      <TableItems rev={rev} />
      <OutboxItems rev={rev} />
      <Crates rev={rev} />
      <FloorItems rev={rev} />
      <SupplyStacks rev={rev} />
    </>
  )
}

function DeskLamp({ pos, at }: { pos: THREE.Vector3; at: THREE.Vector3 }) {
  const ref = useRef<THREE.SpotLight>(null)
  const { scene } = useThree()
  useEffect(() => {
    if (!ref.current) return
    ref.current.target.position.copy(at)
    scene.add(ref.current.target)
    return () => {
      if (ref.current) scene.remove(ref.current.target)
    }
  }, [scene, at])
  return <spotLight ref={ref} position={pos} angle={0.75} penumbra={0.9} intensity={2.2} decay={2} distance={2.5} color="#ffc58a" />
}

// ------------------------------------------------------------------------------------------------ dynamic objects
function useSpoolSource() {
  const g = useModel('spool')
  return useMemo(() => findNode(g.scene, 'spool')!, [g])
}

function SpoolInstance({ spoolId, slot }: { spoolId: string; slot: THREE.Object3D }) {
  const src = useSpoolSource()
  const obj = useMemo(() => cloneNode(src), [src])
  const winding = useMemo(() => findNode(obj, 'FilamentWinding')!, [obj])
  const mat = useMemo(() => findMaterial(obj, /^Filament/)[0], [obj])
  const pos = useMemo(() => slot.getWorldPosition(new THREE.Vector3()), [slot])
  useEffect(() => register({ uid: `spool:${spoolId}`, object: obj, outline: [obj], target: () => spoolTarget(spoolId), priority: 2 }), [obj, spoolId])
  useFrame(() => {
    const sp = useGame.getState().sim.spools.find((x) => x.id === spoolId)
    if (!sp) return
    mat.color.set(COLORS[sp.color].hex)
    const core = 0.05 / 0.088
    const r = Math.sqrt(core * core + (1 - core * core) * Math.max(0, sp.grams) / 1000)
    setRelScale(winding, r, r, 1)
  })
  // shelf faces +X: spool axis (three Z) should run along the shelf depth → rotate 90°
  return <primitive object={obj} position={pos} rotation-y={Math.PI / 2} />
}

function ShelfSpools({ rev }: { rev: number }) {
  const list = useMemo(() => {
    const s = useGame.getState().sim
    return s.spools.filter((x) => x.loc.t === 'shelf').map((x) => ({ id: x.id, slot: points.get(`SpoolSlot_${(x.loc as { slot: number }).slot}`) }))
  }, [rev]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      {list.filter((x) => x.slot).map((x) => (
        <SpoolInstance key={x.id} spoolId={x.id} slot={x.slot!} />
      ))}
    </>
  )
}

function Registered({ uid, target, children, position, rotationY = 0 }: { uid: string; target: () => ReturnType<typeof laptopTarget> | null; children: React.ReactNode; position: THREE.Vector3; rotationY?: number }) {
  const ref = useRef<THREE.Group>(null)
  useEffect(() => {
    if (!ref.current) return
    return register({ uid, object: ref.current, outline: [ref.current], target, priority: 2 })
  }, [uid, target])
  return (
    <group ref={ref} position={position} rotation-y={rotationY}>
      {children}
    </group>
  )
}

function TableItems({ rev }: { rev: number }) {
  const s = useGame.getState().sim
  const items = useMemo(() => s.items.filter((i) => i.loc.t === 'table' || i.loc.t === 'packslot').map((i) => ({ id: i.id, t: i.loc.t })), [rev]) // eslint-disable-line react-hooks/exhaustive-deps
  const overlay = useGame((g) => g.overlay)
  const base = points.get('ItemSlot')
  const pack = points.get('PackSlot')
  if (!base || !pack) return null
  const bp = base.getWorldPosition(new THREE.Vector3())
  const pp = pack.getWorldPosition(new THREE.Vector3())
  let k = 0
  return (
    <>
      {items.map((it) => {
        if (it.t === 'packslot') {
          return (
            <Registered key={it.id} uid={`packed:${it.id}`} target={() => packedBoxTarget(it.id)} position={pp} rotationY={-Math.PI / 2}>
              <ItemModel itemId={it.id} />
            </Registered>
          )
        }
        if (overlay === 'packing' && useGame.getState().overlayArg === it.id) return null
        const i = k++
        const p = bp.clone().add(new THREE.Vector3(0.1 * (i % 2) - 0.05, 0, -0.16 * Math.floor(i / 2) + 0.12))
        return (
          <Registered key={it.id} uid={`tableitem:${it.id}`} target={() => tableItemTarget(it.id)} position={p} rotationY={-Math.PI / 2}>
            <ItemModel itemId={it.id} />
          </Registered>
        )
      })}
    </>
  )
}

function OutboxItems({ rev }: { rev: number }) {
  const s = useGame.getState().sim
  const items = useMemo(() => s.items.filter((i) => i.loc.t === 'outbox').map((i) => ({ id: i.id, slot: (i.loc as { slot: number }).slot })), [rev]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      {items.map((it) => {
        const slot = points.get(`OutSlot_${it.slot}`)
        if (!slot) return null
        return (
          <Registered key={it.id} uid={`outboxitem:${it.id}`} target={() => outboxItemTarget(it.id)} position={slot.getWorldPosition(new THREE.Vector3())} rotationY={-Math.PI / 2}>
            <ItemModel itemId={it.id} />
          </Registered>
        )
      })}
    </>
  )
}

function FloorItems({ rev }: { rev: number }) {
  const s = useGame.getState().sim
  const items = useMemo(() => s.items.filter((i) => i.loc.t === 'floor').map((i) => ({ id: i.id, loc: i.loc as { x: number; y: number; z: number } })), [rev]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      {items.map((it) => (
        <Registered key={it.id} uid={`floor:${it.id}`} target={() => floorItemTarget(it.id)} position={new THREE.Vector3(it.loc.x, it.loc.y, it.loc.z)}>
          <ItemModel itemId={it.id} />
        </Registered>
      ))}
    </>
  )
}

function Crates({ rev }: { rev: number }) {
  const boxes = useModel('boxes')
  const s = useGame.getState().sim
  const list = useMemo(() => s.crates.filter((c) => c.arrived && !c.opened).map((c) => ({ id: c.id, big: c.big })), [rev]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      {list.map((c, i) => (
        <Registered key={c.id} uid={`crate:${c.id}`} target={() => crateTarget(c.id)} position={new THREE.Vector3(CRATE_ZONE.x - i * CRATE_ZONE.step, 0, CRATE_ZONE.z)} rotationY={0.2 * (i % 2 ? 1 : -1)}>
          <CrateModel big={c.big} boxes={boxes} />
        </Registered>
      ))}
    </>
  )
}

function CrateModel({ big, boxes }: { big: boolean; boxes: ReturnType<typeof useModel> }) {
  const obj = useMemo(() => cloneNode(part(boxes, big ? 'printer_box' : 'delivery_box')), [boxes, big])
  return <primitive object={obj} />
}

/** Visual stock of flat-packed boxes under the packing table (scaled by supply count). */
function SupplyStacks({ rev }: { rev: number }) {
  const boxes = useModel('boxes')
  const s = useGame.getState().sim
  const total = s.supplies.box_s + s.supplies.box_m + s.supplies.box_l
  const slot = points.get('StockSlot_1')
  const stack = useMemo(() => cloneNode(part(boxes, 'box_flat_stack')), [boxes])
  void rev
  if (!slot || total <= 0) return null
  const p = slot.getWorldPosition(new THREE.Vector3())
  const h = Math.min(1.6, 0.3 + total / 20)
  return <primitive object={stack} position={p} rotation-y={Math.PI / 2} scale={[0.9, h, 0.9]} />
}
