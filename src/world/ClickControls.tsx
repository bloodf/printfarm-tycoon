/**
 * Pointer controls: no avatar, with mouse and touch navigation.
 * Touch drag rotates; two fingers pan and pinch to zoom. The toolbar also provides zoom buttons.
 *  - OrbitCamera: orbit (left/right-drag), pan (middle-drag or Shift+drag, WASD), zoom (wheel), double-click floor to
 *    re-centre. Kept inside the garage. Eases into close-up poses for the laptop, packing station and printers.
 *  - ClickPicker: hover → outline + cursor tooltip; click → action popover with the object's actions.
 */
import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useGame, type HoverTarget } from '../game/store'
import { useSettings } from '../game/settings'
import { runtime } from '../game/runtime'
import { audio } from '../game/audio'
import { input } from '../game/input'
import { interactables, type Interactable } from './interact'
import { outlineTargets } from './outline'
import { ROOM } from './layout'
import { points } from './Level'
import { dropHeld } from '../sim/sim'

export const orbit = {
  target: new THREE.Vector3(0, 0.85, -1.6),
  yaw: 0.35,
  pitch: 0.62,
  dist: 3.4,
  goal: { target: new THREE.Vector3(0, 0.85, -1.6), yaw: 0.35, pitch: 0.62, dist: 3.4 },
  /** true while the current mouse gesture is a drag (so the picker ignores the click) */
  dragged: false,
  reset() {
    this.goal.target.set(0, 0.85, -1.2)
    this.goal.yaw = 0.35
    this.goal.pitch = 0.62
    this.goal.dist = 3.6
  },
  frame(p: THREE.Vector3, dist: number) {
    this.goal.target.copy(p)
    this.goal.dist = dist
    this.goal.pitch = Math.min(Math.max(this.goal.pitch, 0.35), 0.75)
  },
  zoom(factor: number) {
    this.goal.dist = THREE.MathUtils.clamp(this.goal.dist * factor, 0.7, 6)
  },
}

;(window as unknown as { __orbit: typeof orbit }).__orbit = orbit

const clampTarget = (t: THREE.Vector3) => {
  t.x = THREE.MathUtils.clamp(t.x, ROOM.x0 + 0.3, ROOM.x1 - 0.3)
  t.z = THREE.MathUtils.clamp(t.z, ROOM.z0 + 0.3, ROOM.z1 - 0.3)
  t.y = THREE.MathUtils.clamp(t.y, 0.2, 1.7)
}

/** Moves the camera into close-up poses for the laptop, packing station and printer screens. */
function useStationFocus() {
  useEffect(
    () =>
      useGame.subscribe((s, prev) => {
        if (s.overlay === prev.overlay && s.overlayArg === prev.overlayArg) return
        const wp = (n: string) => points.get(n)?.getWorldPosition(new THREE.Vector3())
        if (s.overlay === 'laptop') {
          const c = wp('LaptopCam')
          const l = wp('LaptopLook')
          runtime.focus = c && l ? { pos: c, look: l } : null
        } else if (s.overlay === 'packing') {
          const c = wp('PackCam')
          const l = wp('PackLook')
          runtime.focus = c && l ? { pos: c, look: l } : null
        } else if (s.overlay === 'printer' && s.overlayArg) {
          const p = runtime.printerPos.get(s.overlayArg)
          const f = runtime.printerFacing.get(s.overlayArg) ?? new THREE.Vector3(0, 0, 1)
          runtime.focus = p ? { pos: p.clone().addScaledVector(f, 0.8).add(new THREE.Vector3(0, 0.45, 0)), look: p.clone().add(new THREE.Vector3(0, 0.25, 0)) } : null
        } else if (!s.overlay) runtime.focus = null
      }),
    [],
  )
}

export function OrbitCamera() {
  const { camera, gl } = useThree()
  useStationFocus()
  const drag = useRef<{ mode: 'rotate' | 'pan'; x: number; y: number; moved: number; button: number } | null>(null)
  const focusBlend = useRef(0)
  const floor = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0))

  useEffect(() => {
    const el = gl.domElement
    const active = () => useGame.getState().screen === 'game' && !useGame.getState().overlay
    const touches = new Map<number, { x: number; y: number }>()
    let pinch: { x: number; y: number; distance: number } | null = null
    const touchPair = () => {
      const [a, b] = [...touches.values()]
      return a && b ? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, distance: Math.hypot(b.x - a.x, b.y - a.y) } : null
    }
    const down = (e: PointerEvent) => {
      if (!active()) return
      if (e.pointerType === 'touch') {
        el.setPointerCapture(e.pointerId)
        touches.set(e.pointerId, { x: e.clientX, y: e.clientY })
        pinch = touchPair()
        if (pinch) { drag.current = null; orbit.dragged = true; return }
      }
      const pan = e.button === 1 || (e.button === 0 && e.shiftKey)
      drag.current = { mode: pan ? 'pan' : 'rotate', x: e.clientX, y: e.clientY, moved: 0, button: e.button }
      orbit.dragged = false
    }
    const move = (e: PointerEvent) => {
      if (touches.has(e.pointerId)) {
        touches.set(e.pointerId, { x: e.clientX, y: e.clientY })
        const pair = touchPair()
        if (pair && pinch && active()) {
          const k = orbit.goal.dist * 0.0016
          orbit.goal.target.addScaledVector(new THREE.Vector3(Math.cos(orbit.yaw), 0, -Math.sin(orbit.yaw)), -(pair.x - pinch.x) * k)
          orbit.goal.target.addScaledVector(new THREE.Vector3(-Math.sin(orbit.yaw), 0, -Math.cos(orbit.yaw)), (pair.y - pinch.y) * k)
          clampTarget(orbit.goal.target)
          if (pair.distance > 0 && pinch.distance > 0) orbit.goal.dist = THREE.MathUtils.clamp(orbit.goal.dist * pinch.distance / pair.distance, 0.7, 6)
          pinch = pair
          orbit.dragged = true
          return
        }
      }
      const d = drag.current
      if (!d || !active()) return
      const dx = e.clientX - d.x
      const dy = e.clientY - d.y
      d.x = e.clientX
      d.y = e.clientY
      d.moved += Math.abs(dx) + Math.abs(dy)
      if (d.moved < 5) return
      orbit.dragged = true
      const sens = useSettings.getState().controls.sensitivity
      if (d.mode === 'rotate') {
        orbit.goal.yaw -= dx * 0.006 * sens
        orbit.goal.pitch = THREE.MathUtils.clamp(orbit.goal.pitch + dy * 0.005 * sens * (useSettings.getState().controls.invertY ? -1 : 1), 0.12, 1.35)
      } else {
        const k = orbit.goal.dist * 0.0016
        const right = new THREE.Vector3(Math.cos(orbit.yaw), 0, -Math.sin(orbit.yaw))
        const fwd = new THREE.Vector3(-Math.sin(orbit.yaw), 0, -Math.cos(orbit.yaw))
        orbit.goal.target.addScaledVector(right, -dx * k).addScaledVector(fwd, dy * k)
        clampTarget(orbit.goal.target)
      }
    }
    const up = (e: PointerEvent) => {
      touches.delete(e.pointerId)
      pinch = null
      drag.current = null
      setTimeout(() => (orbit.dragged = false), 0)
    }
    const wheel = (e: WheelEvent) => {
      if (!active()) return
      e.preventDefault()
      orbit.zoom(Math.exp(e.deltaY * 0.0012))
    }
    const dbl = (e: MouseEvent) => {
      if (!active()) return
      const r = el.getBoundingClientRect()
      const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
      const rc = new THREE.Raycaster()
      rc.setFromCamera(ndc, camera)
      const hit = new THREE.Vector3()
      if (rc.ray.intersectPlane(floor.current, hit)) {
        orbit.goal.target.set(hit.x, 0.7, hit.z)
        clampTarget(orbit.goal.target)
      }
    }
    const ctx = (e: Event) => e.preventDefault()
    el.addEventListener('pointerdown', down)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    el.addEventListener('wheel', wheel, { passive: false })
    el.addEventListener('dblclick', dbl)
    el.addEventListener('contextmenu', ctx)
    return () => {
      el.removeEventListener('pointerdown', down)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      el.removeEventListener('wheel', wheel)
      el.removeEventListener('dblclick', dbl)
      el.removeEventListener('contextmenu', ctx)
    }
  }, [gl, camera])

  useFrame((_, raw) => {
    const st = useGame.getState()
    if (st.screen !== 'game') return
    runtime.camera = camera
    const dt = Math.min(raw, 0.05)
    const free = !st.overlay
    input.setEnabled(free)
    // keyboard is optional: WASD pans, T fast-forward, G drop, Esc pause, F5 quick save
    if (free) {
      const fwd = new THREE.Vector3(-Math.sin(orbit.yaw), 0, -Math.cos(orbit.yaw))
      const right = new THREE.Vector3(Math.cos(orbit.yaw), 0, -Math.sin(orbit.yaw))
      const sp = 2.2 * dt
      if (input.held('forward')) orbit.goal.target.addScaledVector(fwd, sp)
      if (input.held('back')) orbit.goal.target.addScaledVector(fwd, -sp)
      if (input.held('left')) orbit.goal.target.addScaledVector(right, -sp)
      if (input.held('right')) orbit.goal.target.addScaledVector(right, sp)
      clampTarget(orbit.goal.target)
      if (input.pressed('fastforward')) st.toggleFastForward()
      if (input.pressed('quicksave')) st.save()
      if (input.pressed('pause')) {
        if (st.popover) st.setPopover(null)
        else st.open('pause')
      }
      if (input.pressed('drop') && st.sim.held) dropAtView()
    }
    const k = 1 - Math.exp(-dt * 9)
    orbit.target.lerp(orbit.goal.target, k)
    orbit.yaw += (orbit.goal.yaw - orbit.yaw) * k
    orbit.pitch += (orbit.goal.pitch - orbit.pitch) * k
    orbit.dist += (orbit.goal.dist - orbit.dist) * k
    const pos = new THREE.Vector3(
      orbit.target.x + Math.sin(orbit.yaw) * Math.cos(orbit.pitch) * orbit.dist,
      orbit.target.y + Math.sin(orbit.pitch) * orbit.dist,
      orbit.target.z + Math.cos(orbit.yaw) * Math.cos(orbit.pitch) * orbit.dist,
    )
    pos.x = THREE.MathUtils.clamp(pos.x, ROOM.x0 + 0.12, ROOM.x1 - 0.12)
    pos.z = THREE.MathUtils.clamp(pos.z, ROOM.z0 + 0.12, ROOM.z1 - 0.12)
    pos.y = THREE.MathUtils.clamp(pos.y, 0.35, ROOM.h - 0.12)
    const look = orbit.target.clone()
    const orbitQuat = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(pos, look, new THREE.Vector3(0, 1, 0)))
    // UI focus (laptop, packing, printer screen): blend from the orbit pose into the close-up pose
    const focus = runtime.focus
    focusBlend.current += ((focus ? 1 : 0) - focusBlend.current) * (1 - Math.exp(-dt * 7))
    if (focus && focusBlend.current > 0.001) {
      const fq = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(focus.pos, focus.look, new THREE.Vector3(0, 1, 0)))
      camera.position.lerpVectors(pos, focus.pos, focusBlend.current)
      camera.quaternion.copy(orbitQuat).slerp(fq, focusBlend.current)
    } else {
      camera.position.copy(pos)
      camera.quaternion.copy(orbitQuat)
    }
    const cam = camera as THREE.PerspectiveCamera
    const fov = useSettings.getState().controls.fov - (focus ? 8 * focusBlend.current : 0)
    if (Math.abs(cam.fov - fov) > 0.05) {
      cam.fov += (fov - cam.fov) * (1 - Math.exp(-dt * 8))
      cam.updateProjectionMatrix()
    }
    // audio listener at the camera
    const f = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion)
    audio.setListener([camera.position.x, camera.position.y, camera.position.z], [f.x, f.y, f.z])
  })
  return null
}

/** Drop the held item on the floor in front of the view (G / the held-item card). */
export function dropAtView() {
  const st = useGame.getState()
  const t = orbit.target
  st.act((s) => dropHeld(s, t.x, 0, t.z), { sound: 'box_place' })
}

const sig = (h: HoverTarget | null) => (h ? `${h.uid}|${h.title}|${h.subtitle}|${h.prompts.map((p) => p.label + (p.disabled ?? '')).join(',')}` : '')

function pickInteractable(camera: THREE.Camera, point: THREE.Vector2): { it: Interactable; target: HoverTarget } | null {
  const ray = new THREE.Raycaster()
  ray.setFromCamera(point, camera)
  ray.far = 12
  const hits = ray.intersectObjects([...interactables.values()].map((it) => it.object), true)
  const near = hits[0]?.distance ?? 0
  const candidates: { it: Interactable; distance: number }[] = []
  const seen = new Set<string>()
  for (const hit of hits) {
    const uid: unknown = hit.object.userData.uid
    const it = typeof uid === 'string' ? interactables.get(uid) : undefined
    if (!it || seen.has(it.uid) || hit.distance > near + 0.6) continue
    seen.add(it.uid)
    candidates.push({ it, distance: hit.distance })
  }
  candidates.sort((a, b) => (b.it.priority ?? 0) - (a.it.priority ?? 0) || a.distance - b.distance)
  for (const { it } of candidates) {
    const target = it.target()
    if (target) return { it, target }
  }
  return null
}

/** Mouse picking for Point & Click. */
export function ClickPicker() {
  const { camera, gl } = useThree()
  const ndc = useRef(new THREE.Vector2(9, 9))
  const over = useRef(false)
  const scan = useRef(0)
  const last = useRef('')

  useEffect(() => {
    const el = gl.domElement
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect()
      ndc.current.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
      over.current = true
      useGame.setState({ cursor: { x: e.clientX, y: e.clientY } })
    }
    const leave = () => {
      over.current = false
    }
    const click = (e: MouseEvent) => {
      const st = useGame.getState()
      if (st.screen !== 'game' || st.overlay || e.button !== 0 || orbit.dragged) return
      const rect = el.getBoundingClientRect()
      const point = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1)
      // Touch has no preceding hover; pick at the tap instead of using the last mouse target.
      const it = pickInteractable(camera, point)?.it
      if (it) {
        const t = it.target()
        if (t) {
          audio.play('ui_click', { bus: 'ui' })
          st.setPopover({ uid: it.uid, x: e.clientX, y: e.clientY })
          // glide the camera towards what was clicked
          const box = new THREE.Box3().setFromObject(it.object)
          const c = box.getCenter(new THREE.Vector3())
          const size = box.getSize(new THREE.Vector3()).length()
          if (orbit.goal.target.distanceTo(c) > 0.25 || orbit.goal.dist > 2.6) orbit.frame(new THREE.Vector3(c.x, Math.min(c.y, 1.4), c.z), THREE.MathUtils.clamp(size * 1.8, 1.1, 2.6))
        }
      } else st.setPopover(null)
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerleave', leave)
    el.addEventListener('click', click)
    return () => {
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerleave', leave)
      el.removeEventListener('click', click)
    }
  }, [camera, gl])

  useFrame((_, dt) => {
    const st = useGame.getState()
    if (st.screen !== 'game' || st.overlay) {
      if (st.hover) st.setHover(null)
      outlineTargets.length = 0
      return
    }
    scan.current -= dt
    if (scan.current > 0) return
    scan.current = 0.05
    let found: HoverTarget | null = null
    let best: Interactable | null = null
    if (over.current && !orbit.dragged) {
      const picked = pickInteractable(camera, ndc.current)
      found = picked?.target ?? null
      best = picked?.it ?? null
    }
    // keep the outline on the object whose popover is open
    const pop = st.popover ? interactables.get(st.popover.uid) : null
    outlineTargets.length = 0
    outlineTargets.push(...(best?.outline ?? pop?.outline ?? []))
    gl.domElement.style.cursor = best ? 'pointer' : 'grab'
    const s = sig(found)
    if (s !== last.current) {
      last.current = s
      st.setHover(found)
    }
    // doors of enclosed printers open when you point at them
    for (const k of runtime.doorOpen.keys()) runtime.doorOpen.set(k, 0)
    const pid = (found?.uid ?? st.popover?.uid ?? '').startsWith('printer:') ? (found?.uid ?? st.popover!.uid).slice(8) : null
    if (pid) {
      const p = st.sim.printers.find((x) => x.id === pid)
      if (p?.modelId === 'p1s' && (p.status === 'done' || p.status === 'idle' || p.status === 'paused_runout')) runtime.doorOpen.set(pid, 1)
    }
  })
  return null
}
