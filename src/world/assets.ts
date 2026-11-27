import * as THREE from 'three'
import { useGLTF } from '@react-three/drei'
import type { GLTF } from 'three-stdlib'
import { applyWeathering } from './weathering'

export const MODEL_URLS = {
  garage: '/assets/models/garage.glb',
  props: '/assets/models/props.glb',
  products: '/assets/models/products.glb',
  spool: '/assets/models/spool.glb',
  boxes: '/assets/models/boxes.glb',
  ender3v3: '/assets/models/printer_ender3v3.glb',
  mk4: '/assets/models/printer_mk4.glb',
  p1s: '/assets/models/printer_p1s.glb',
  a1: '/assets/models/printer_a1.glb',
  u1: '/assets/models/printer_u1.glb',
  k1: '/assets/models/printer_k1.glb',
  xl: '/assets/models/printer_xl.glb',
} as const

export type ModelKey = keyof typeof MODEL_URLS

/** All GLBs are meshopt-compressed (tools/optimize_models.mjs); drei decodes them locally. */
export function useModel(key: ModelKey): GLTF {
  return useGLTF(MODEL_URLS[key], false, true) as unknown as GLTF
}

export function preloadModels() {
  for (const url of Object.values(MODEL_URLS)) useGLTF.preload(url, false, true)
}

const GLASS_RE = /^(Glass|WindowGlass|BinClear|NozzleBox|PTFE)/

/** Cheap, good-looking glass (real transmission is too expensive for many instances). */
function glassFrom(m: THREE.MeshStandardMaterial) {
  const g = new THREE.MeshPhysicalMaterial({
    name: m.name, color: m.name.startsWith('Glass') ? new THREE.Color('#c9d4d8') : m.color.clone(), roughness: 0.04, metalness: 0,
    transparent: true, opacity: m.name.startsWith('Glass') ? 0.16 : Math.min(m.opacity, 0.55), depthWrite: false,
    envMapIntensity: 1.4, clearcoat: 1, clearcoatRoughness: 0.05, side: THREE.DoubleSide,
  })
  return g
}

const glassCache = new Map<string, THREE.Material>()

/**
 * Deep-clone a node for placement in the world.
 * - meshes cast/receive shadows (except emissive/glass)
 * - materials matching `unique` are cloned per instance (recoloured/animated at runtime)
 */
export function cloneNode(src: THREE.Object3D, unique: RegExp = /^(Filament|Screen|LED)/): THREE.Object3D {
  const c = src.clone(true)
  c.position.set(0, 0, 0)
  c.rotation.set(0, 0, 0)
  c.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh) return
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    const out = mats.map((mm) => {
      const m = mm as THREE.MeshStandardMaterial
      if (GLASS_RE.test(m.name)) {
        if (!glassCache.has(m.name)) glassCache.set(m.name, glassFrom(m))
        mesh.castShadow = false
        return glassCache.get(m.name)!
      }
      const emissive = m.emissive && (m.emissive.r + m.emissive.g + m.emissive.b > 0.05) && (m.emissiveIntensity ?? 1) > 0.3
      mesh.castShadow = !emissive
      mesh.receiveShadow = true
      for (const key of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'aoMap'] as const) {
        const t = (m as unknown as Record<string, THREE.Texture | null>)[key]
        if (t && t.anisotropy < 8) {
          t.anisotropy = 8
          t.needsUpdate = true
        }
      }
      const out = unique.test(m.name) ? m.clone() : m
      applyWeathering(out)
      return out
    })
    mesh.material = Array.isArray(mesh.material) ? out : out[0]
  })
  return c
}

/**
 * Find a node by name inside `root`. Exact match first; otherwise accept the name Blender gives a duplicate
 * ("Slot_0.001", one per prop that reuses a rig name) as it arrives after GLTFLoader sanitising ("Slot_0001").
 * Only that 3-digit form: a looser alias (e.g. "_1") would make "SpoolMount" match "SpoolMount_0".
 * Lookups are always scoped to one prop/asset subtree, so this stays unambiguous.
 */
export function findNode(root: THREE.Object3D, name: string): THREE.Object3D | undefined {
  let found: THREE.Object3D | undefined
  let alias: THREE.Object3D | undefined
  const re = new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\d{3}$`)
  root.traverse((o) => {
    if (found) return
    if (o.name === name) found = o
    else if (!alias && re.test(o.name)) alias = o
  })
  return found ?? alias
}

export function findMaterial(root: THREE.Object3D, name: RegExp): THREE.MeshStandardMaterial[] {
  const out = new Set<THREE.MeshStandardMaterial>()
  root.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh) return
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    for (const m of mats) if (name.test(m.name)) out.add(m as THREE.MeshStandardMaterial)
  })
  return [...out]
}

/** Child of a multi-asset GLB (props.glb, products.glb, boxes.glb) by root name. */
export function part(gltf: GLTF, name: string): THREE.Object3D {
  const n = findNode(gltf.scene, name)
  if (!n) throw new Error(`asset part not found: ${name}`)
  return n
}

/** Set a scale relative to the node's authored scale (meshopt quantisation stores a scale on mesh nodes). */
export function setRelScale(o: THREE.Object3D, x: number, y: number, z: number) {
  if (!o.userData.baseScale) o.userData.baseScale = o.scale.clone()
  const b = o.userData.baseScale as THREE.Vector3
  o.scale.set(b.x * x, b.y * y, b.z * z)
}
