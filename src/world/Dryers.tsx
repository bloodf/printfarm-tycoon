import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useGame } from '../game/store'
import { audio, type LoopHandle } from '../game/audio'
import { getSpool } from '../sim/sim'
import { COLORS } from '../data/filaments'
import { DRYER_SPOTS } from '../data/garage'
import { cloneNode, findMaterial, findNode, part, setRelScale, useModel } from './assets'
import { makeScreenTexture } from './screens'
import { register } from './interact'
import { dryerTarget } from './targets'

function DryerEntity({ dryerId, spot }: { dryerId: string; spot: number }) {
  const props = useModel('props')
  const spoolGltf = useModel('spool')
  const obj = useMemo(() => cloneNode(part(props, 'filament_dryer'), /^(Filament|DryerScreen)/), [props])
  const slots = useMemo(() => [0, 1].map((i) => findNode(obj, `DryerSlot_${i}`)!), [obj])
  const spools = useMemo(
    () => [0, 1].map(() => {
      const s = cloneNode(findNode(spoolGltf.scene, 'spool')!)
      s.scale.setScalar(0.88)
      return { obj: s, winding: findNode(s, 'FilamentWinding')!, mat: findMaterial(s, /^Filament/)[0] }
    }),
    [spoolGltf],
  )
  // the canvas is created in a memo, but attached to the materials in an effect: StrictMode runs memo bodies twice,
  // and a side effect there left the material showing the discarded (never painted) canvas
  const screen = useMemo(() => makeScreenTexture(160, 110), [])
  useEffect(() => {
    // the LCD is a thin box: give its faces planar 0..1 UVs over the screen's width/height so the whole canvas shows
    obj.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (!mesh.isMesh || !/^DryerScreen/.test((mesh.material as THREE.Material).name) || mesh.userData.lcdUv) return
      const geo = mesh.geometry.clone()
      const pos = geo.getAttribute('position')
      geo.computeBoundingBox()
      const bb = geo.boundingBox!
      const uv = new Float32Array(pos.count * 2)
      for (let i = 0; i < pos.count; i++) {
        uv[i * 2] = (pos.getX(i) - bb.min.x) / Math.max(1e-6, bb.max.x - bb.min.x)
        uv[i * 2 + 1] = (pos.getY(i) - bb.min.y) / Math.max(1e-6, bb.max.y - bb.min.y)
      }
      geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
      mesh.geometry = geo
      mesh.userData.lcdUv = true
    })
    for (const m of findMaterial(obj, /^DryerScreen/)) {
      m.map = screen.tex
      m.emissiveMap = screen.tex
      m.emissive = new THREE.Color('#ffffff')
      m.emissiveIntensity = 1
      m.color = new THREE.Color('#000')
      m.toneMapped = false
      m.needsUpdate = true
    }
  }, [obj, screen])
  const [x, y, z, rot] = DRYER_SPOTS[spot]
  const pos = useMemo(() => new THREE.Vector3(x, y, z), [x, y, z])
  const hum = useRef<LoopHandle | null>(null)
  const paintT = useRef(0)

  useEffect(() => {
    spools.forEach((sp, i) => slots[i].add(sp.obj))
    const proxy = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 0.3), new THREE.MeshBasicMaterial({ visible: false }))
    proxy.position.set(0, 0.14, 0)
    obj.add(proxy)
    const unreg = register({ uid: `dryer:${dryerId}`, object: proxy, outline: [obj], target: () => dryerTarget(dryerId), priority: 1 })
    hum.current = audio.loop('dryer_hum_loop', { pos: [x, y + 0.1, z], volume: 0, ref: 0.5 })
    return () => {
      unreg()
      proxy.removeFromParent()
      spools.forEach((sp) => sp.obj.removeFromParent())
      hum.current?.stop()
    }
  }, [obj, slots, spools, dryerId, x, y, z])

  useFrame((_, dt) => {
    const s = useGame.getState().sim
    const d = s.dryers.find((q) => q.id === dryerId)
    if (!d) return
    const loaded = d.slots.map((sid) => getSpool(s, sid))
    loaded.forEach((sp, i) => {
      const v = spools[i]
      v.obj.visible = !!sp
      if (sp) {
        v.mat.color.set(COLORS[sp.color].hex)
        const core = 0.05 / 0.088
        const r = Math.sqrt(core * core + (1 - core * core) * Math.max(0, sp.grams) / 1000)
        setRelScale(v.winding, r, r, 1)
        v.obj.rotation.z += dt * 0.05
      }
    })
    const running = s.power && loaded.some(Boolean)
    hum.current?.setVolume(running ? 0.35 : 0)
    paintT.current -= dt
    if (paintT.current <= 0) {
      paintT.current = 0.5
      const c = screen.ctx
      c.fillStyle = s.power ? '#071018' : '#000'
      c.fillRect(0, 0, 160, 110)
      if (s.power) {
        c.fillStyle = running ? '#ff9a3d' : '#5b6673'
        c.font = 'bold 30px monospace'
        c.fillText(running ? '55°C' : '--°C', 10, 40)
        c.font = '15px monospace'
        c.fillStyle = '#cfe3ff'
        c.fillText(running ? 'DRYING' : 'IDLE', 10, 64)
        loaded.forEach((sp, i) => {
          if (!sp) return
          c.fillStyle = sp.moisture < 0.1 ? '#3ddc84' : sp.moisture < 0.35 ? '#ffc53d' : '#ff4d4f'
          c.fillText(`S${i + 1} ${Math.round(sp.moisture * 100)}%`, 10 + i * 75, 94)
        })
      }
      screen.tex.needsUpdate = true
    }
  })
  return <primitive object={obj} position={pos} rotation-y={rot} />
}

export function Dryers({ rev }: { rev: number }) {
  const props = useModel('props')
  const list = useMemo(() => useGame.getState().sim.dryers.map((d) => ({ id: d.id, spot: d.spot })), [rev]) // eslint-disable-line react-hooks/exhaustive-deps
  const hasModel = useMemo(() => !!findNode(props.scene, 'filament_dryer'), [props])
  useEffect(() => {
    if (!hasModel) console.warn('[level] prop "filament_dryer" missing from props.glb — dryers not shown (rebuild assets)')
  }, [hasModel])
  if (!hasModel) return null
  return (
    <>
      {list.map((d) => (
        <DryerEntity key={d.id} dryerId={d.id} spot={d.spot} />
      ))}
    </>
  )
}
