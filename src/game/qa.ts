/**
 * QA automation hooks (used by the scripted Playwright playthrough, docs/qa/).
 * Drives the real input + interaction code paths; only time-skipping bypasses the clock.
 */
import * as THREE from 'three'
import { useGame } from './store'
import { runtime } from './runtime'
import { input } from './input'
import { audio } from './audio'
import * as simApi from '../sim/sim'
import { tick, drainEvents, triggerError } from '../sim/sim'
import type { ErrorCode } from '../data/errors'
import type { IncidentType } from '../data/incidents'
import { interactables } from '../world/interact'


export const qa = {
  /** Call a sim action by name with the live state, e.g. run('sendJob', orderId, printerId, 'standard') */
  run(name: string, ...args: unknown[]) {
    const fn = (simApi as unknown as Record<string, (...a: unknown[]) => unknown>)[name]
    const r = fn(useGame.getState().sim, ...args)
    drainEvents(useGame.getState().sim)
    useGame.getState().bump()
    return r
  },
  audio() {
    return audio.status()
  },
  input() {
    return input.debug()
  },
  press(code: string, holdMs = 80) {
    input.inject(code, true)
    setTimeout(() => input.inject(code, false), holdMs)
  },
  down(code: string) { input.inject(code, true) },
  up(code: string) { input.inject(code, false) },
  /** Skip game time (minutes) in 1-minute steps, keeping all sim rules. */
  skip(minutes: number) {
    const s = useGame.getState().sim
    tick(s, minutes)
    drainEvents(s)
    useGame.getState().bump()
  },
  /** Make printer #i throw an error code now (it must be printing). Harness shortcut: errors are random in play. */
  forceError(i: number, code: ErrorCode) {
    const s = useGame.getState().sim
    const p = s.printers[i]
    if (!p?.job) return false
    triggerError(s, p, code) // the event is left for the game loop → toast + alarm like a real error
    useGame.getState().bump()
    return true
  },
  /** Start an incident on the next game minute for `minutes` (harness shortcut: incidents are rolled each morning). */
  forceIncident(type: IncidentType, minutes = 30) {
    const s = useGame.getState().sim
    const start = Math.floor(s.time) + 1
    s.incidents.push({ type, day: s.day, start, end: start + minutes })
    useGame.getState().bump()
  },
  state() {
    const g = useGame.getState()
    return { screen: g.screen, overlay: g.overlay, hover: g.hover?.title ?? null, prompts: g.hover?.prompts.map((p) => p.label) ?? [], held: g.sim.held, time: g.sim.time, money: g.sim.money }
  },
  /** World position of an interactable by uid (prefix match) */
  where(uid: string) {
    for (const [k, v] of interactables) {
      if (k === uid || k.startsWith(uid)) {
        const w = v.object.getWorldPosition(new THREE.Vector3())
        return [w.x, w.y, w.z]
      }
    }
    return null
  },
  /** Screen position (CSS px) of an interactable's visual centre, for mouse-only automation. */
  screenPos(uid: string) {
    const cam = runtime.camera as THREE.PerspectiveCamera | null
    if (!cam) return null
    for (const [k, v] of interactables) {
      if (k === uid || k.startsWith(uid)) {
        const c = new THREE.Box3().setFromObject(v.object).getCenter(new THREE.Vector3())
        const p = c.project(cam)
        if (p.z > 1) return null
        const el = document.querySelector('canvas')!.getBoundingClientRect()
        return [el.left + (p.x * 0.5 + 0.5) * el.width, el.top + (-p.y * 0.5 + 0.5) * el.height]
      }
    }
    return null
  },
  orbitTo(x: number, y: number, z: number, dist = 1.8, yaw?: number) {
    const o = (window as unknown as { __orbit: { goal: { target: THREE.Vector3; dist: number; yaw: number } } }).__orbit
    o.goal.target.set(x, y, z)
    o.goal.dist = dist
    if (yaw !== undefined) o.goal.yaw = yaw
  },
  orbitSettled() {
    const o = (window as unknown as { __orbit: { target: THREE.Vector3; dist: number; goal: { target: THREE.Vector3; dist: number } } }).__orbit
    return o.target.distanceTo(o.goal.target) < 0.02 && Math.abs(o.dist - o.goal.dist) < 0.02
  },
  rayHits() {
    const cam = runtime.camera!
    const r = new THREE.Raycaster()
    r.setFromCamera(new THREE.Vector2(0, 0), cam)
    const objs = [...interactables.values()].map((i) => i.object)
    return r.intersectObjects(objs, true).slice(0, 5).map((h) => ({ uid: h.object.userData.uid, name: h.object.name, d: +h.distance.toFixed(2) }))
  },
  debugRay(uid: string) {
    const cam = runtime.camera!
    const r = new THREE.Raycaster()
    r.setFromCamera(new THREE.Vector2(0, 0), cam)
    const it = interactables.get(uid)!
    const o = it.object as THREE.Mesh
    return {
      origin: r.ray.origin.toArray(), dir: r.ray.direction.toArray(), camMW: cam.matrixWorld.elements.slice(12, 15),
      objMW: o.matrixWorld.elements, parent: o.parent?.type, inScene: !!o.parent?.parent, type: o.type, isMesh: o.isMesh,
      geo: o.geometry?.type, layers: o.layers.mask, hitSelf: r.intersectObject(o, false).length,
    }
  },
  cam() {
    const c = runtime.camera!
    const d = new THREE.Vector3(0, 0, -1).applyQuaternion(c.quaternion)
    return { pos: c.position.toArray().map((v) => +v.toFixed(2)), dir: d.toArray().map((v) => +v.toFixed(2)) }
  },
  /** Scene root (found through any interactable), for inspecting the world graph from automation. */
  sceneRoot() {
    const first = interactables.values().next().value
    let o: THREE.Object3D | null = first ? first.object : null
    while (o && o.parent) o = o.parent
    return o
  },
  uids() {
    return [...interactables.keys()]
  },
  printerPos(i = 0) {
    const s = useGame.getState().sim
    const p = s.printers[i]
    const v = p && runtime.printerPos.get(p.id)
    return v ? [v.x, v.y, v.z] : null
  },
}

;(window as unknown as { __qa: typeof qa }).__qa = qa
