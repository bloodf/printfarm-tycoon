import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Bloom, BrightnessContrast, DepthOfField, EffectComposer, HueSaturation, N8AO, Noise, Outline, SMAA, ToneMapping, Vignette } from '@react-three/postprocessing'
import { BlendFunction, ToneMappingMode, type OutlineEffect } from 'postprocessing'
import { useGame } from '../game/store'
import { runtime } from '../game/runtime'
import type * as THREE from 'three'
import { useSettings } from '../game/settings'
import { outlineTargets } from './outline'

export function PostFX() {
  const g = useSettings((s) => s.graphics)
  const outline = useRef<OutlineEffect>(null)
  // depth of field when the camera focuses on a station (printer screen, packing table)
  const overlay = useGame((s) => s.overlay)
  const dof = (overlay === 'printer' || overlay === 'packing') && g.ssao ? runtime.focus?.look ?? null : null
  const last = useRef('')
  useFrame(() => {
    const o = outline.current
    if (!o) return
    const meshes: THREE.Object3D[] = []
    for (const t of outlineTargets) t.traverse((m) => (m as THREE.Mesh).isMesh && (m as THREE.Mesh).material && ((m as THREE.Mesh).material as THREE.Material).visible !== false && meshes.push(m))
    const key = meshes.map((m) => m.id).join(',')
    if (key !== last.current) {
      last.current = key
      o.selection.set(meshes)
    }
  })
  return (
    <EffectComposer multisampling={0} enableNormalPass={false} autoClear={false}>
      {g.ssao ? <N8AO aoRadius={0.5} intensity={2.6} distanceFalloff={0.6} halfRes quality="medium" /> : <></>}
      {dof ? <DepthOfField target={dof} focalLength={0.035} bokehScale={3.2} /> : <></>}
      <Outline ref={outline} edgeStrength={4} visibleEdgeColor={0xffa24a} hiddenEdgeColor={0x000000} blur xRay={false} pulseSpeed={0} />
      {g.bloom ? <Bloom intensity={0.55} luminanceThreshold={0.92} luminanceSmoothing={0.2} mipmapBlur /> : <></>}
      <ToneMapping mode={ToneMappingMode.AGX} />
      <BrightnessContrast brightness={0.02} contrast={0.14} />
      <HueSaturation saturation={0.06} />
      <Noise premultiply blendFunction={BlendFunction.OVERLAY} opacity={0.06} />
      <Vignette offset={0.32} darkness={0.42} />
      <SMAA />
    </EffectComposer>
  )
}
