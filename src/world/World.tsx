import { Suspense, useEffect, useMemo } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useSettings } from '../game/settings'
import { useGame } from '../game/store'
import { runtime } from '../game/runtime'
import { Level } from './Level'
import { PostFX } from './PostFX'
import { MenuCamera } from './MenuCamera'
import { PackingStage } from './PackingStage'
import { CameraFeeds } from './CameraFeeds'
import { ClickPicker, OrbitCamera } from './ClickControls'
import { preloadModels } from './assets'

preloadModels()

/** Drives the simulation clock and collects render stats. */
function Driver() {
  const { gl } = useThree()
  const frames = useMemo(() => ({ n: 0, t: 0 }), [])
  useEffect(() => {
    gl.info.autoReset = false
  }, [gl])
  useFrame((_, dt) => {
    useGame.getState().advance(dt)
    frames.n++
    frames.t += dt
    // gl.info accumulates over all passes of the previous frame
    const calls = gl.info.render.calls
    const tris = gl.info.render.triangles
    gl.info.reset()
    if (frames.t > 0.5) {
      runtime.stats.fps = Math.round(frames.n / frames.t)
      runtime.stats.drawCalls = calls
      runtime.stats.triangles = tris
      frames.n = 0
      frames.t = 0
    }
  }, -1)
  return null
}

function ShadowToggle() {
  const { gl, scene } = useThree()
  const shadows = useSettings((s) => s.graphics.shadows)
  useEffect(() => {
    gl.shadowMap.enabled = shadows
    gl.shadowMap.type = THREE.PCFSoftShadowMap
    scene.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.Material | undefined
      if (m) m.needsUpdate = true
    })
  }, [shadows, gl, scene])
  return null
}

export function World() {
  const resScale = useSettings((s) => s.graphics.resScale)
  const dpr = Math.min(2, window.devicePixelRatio || 1) * resScale
  return (
    <Canvas
      className="world"
      dpr={dpr}
      shadows
      flat
      camera={{ fov: 75, near: 0.03, far: 60, position: [1.6, 1.55, 0.9] }}
      gl={{ antialias: false, powerPreference: 'high-performance', stencil: false, preserveDrawingBuffer: false }}
    >
      <color attach="background" args={['#0b0d10']} />
      <Suspense fallback={null}>
        <Level />
        <PackingStage />
        <PostFX />
      </Suspense>
      <Driver />
      <ShadowToggle />
      <MenuCamera />
      <CameraFeeds />
      <OrbitCamera />
      <ClickPicker />
    </Canvas>
  )
}
