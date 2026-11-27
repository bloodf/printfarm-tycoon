import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useGame } from '../game/store'

/** Slow cinematic drift through the garage behind the main menu. */
export function MenuCamera() {
  const { camera } = useThree()
  useFrame((state) => {
    const scr = useGame.getState().screen
    if (scr === 'game') return
    const t = state.clock.elapsedTime * 0.05
    camera.position.set(1.6 + Math.sin(t) * 0.6, 1.55 + Math.sin(t * 1.7) * 0.08, 0.9 + Math.cos(t) * 0.4)
    const look = new THREE.Vector3(-0.4 + Math.sin(t * 0.8) * 0.5, 1.0, -2.8)
    camera.lookAt(look)
    const cam = camera as THREE.PerspectiveCamera
    if (cam.fov !== 55) {
      cam.fov = 55
      cam.updateProjectionMatrix()
    }
  })
  return null
}
