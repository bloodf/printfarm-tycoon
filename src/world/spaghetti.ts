import * as THREE from 'three'
import { nextRandom } from '../sim/rng'

/**
 * Procedural "spaghetti": a tangled filament bird's-nest built as one long tube.
 * Grows by increasing the index draw range (cheap, no geometry rebuilds).
 */
export function makeSpaghettiGeometry(seed: number, radius = 0.07, height = 0.06): THREE.TubeGeometry {
  let s = seed >>> 0 || 1
  const r = () => {
    const [v, n] = nextRandom(s)
    s = n
    return v
  }
  const pts: THREE.Vector3[] = []
  let p = new THREE.Vector3(0, 0.002, 0)
  let dir = new THREE.Vector3(1, 0, 0)
  const N = 420
  for (let i = 0; i < N; i++) {
    const grow = i / N
    // wander with a bias back toward the centre (forms a nest), rising as it grows
    const toC = new THREE.Vector3(-p.x, 0, -p.z).multiplyScalar(2.2)
    dir.add(new THREE.Vector3(r() - 0.5, (r() - 0.45) * 0.6, r() - 0.5).multiplyScalar(1.4)).add(toC).normalize()
    p = p.clone().addScaledVector(dir, 0.012 + r() * 0.01)
    const lim = radius * (0.4 + 0.6 * grow)
    const d = Math.hypot(p.x, p.z)
    if (d > lim) {
      p.x *= lim / d
      p.z *= lim / d
    }
    p.y = THREE.MathUtils.clamp(p.y, 0.001, 0.004 + height * grow)
    pts.push(p)
  }
  const curve = new THREE.CatmullRomCurve3(pts)
  return new THREE.TubeGeometry(curve, N * 3, 0.0009, 5, false)
}

/** Set how much of the nest is visible (0..1). */
export function setSpaghettiAmount(g: THREE.TubeGeometry, f: number) {
  const total = g.index ? g.index.count : 0
  const n = Math.floor(THREE.MathUtils.clamp(f, 0, 1) * total / 6) * 6
  g.setDrawRange(0, n)
}
