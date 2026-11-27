import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useGame } from '../game/store'
import { PRINTERS } from '../data/printers'
import { runtime } from '../game/runtime'

/** Printer id → 2D canvas with the latest chamber-camera frame (read by the Farm app). */
export const feeds = new Map<string, HTMLCanvasElement>()
const W = 320
const H = 200

/** Renders each camera-equipped printer's chamber view at ~3 fps while the Farm app is open. */
export function CameraFeeds() {
  const { gl, scene } = useThree()
  const rt = useMemo(() => {
    const t = new THREE.WebGLRenderTarget(W, H, { samples: 2 })
    t.texture.colorSpace = THREE.SRGBColorSpace
    return t
  }, [])
  const cam = useMemo(() => new THREE.PerspectiveCamera(62, W / H, 0.01, 10), [])
  const buf = useMemo(() => new Uint8Array(W * H * 4), [])
  const timer = useRef(0)
  useEffect(() => () => rt.dispose(), [rt])
  useFrame((_, dt) => {
    const st = useGame.getState()
    if (st.overlay !== 'laptop' || st.laptopApp !== 'farm') return
    timer.current -= dt
    if (timer.current > 0) return
    timer.current = 0.33
    for (const p of st.sim.printers) {
      if (!PRINTERS[p.modelId].camera) continue
      const rig = runtime.printerCam.get(p.id)
      if (!rig || !st.sim.internet) continue
      // the printer's own camera node (P1S chamber cam, A1 tower cam, U1 frame cam) looking at the build plate
      rig.cam.getWorldPosition(cam.position)
      const look = rig.look.getWorldPosition(new THREE.Vector3())
      cam.lookAt(look.x, look.y + 0.03, look.z)
      const prevTM = gl.toneMapping
      gl.toneMapping = THREE.ACESFilmicToneMapping
      gl.setRenderTarget(rt)
      gl.render(scene, cam)
      gl.readRenderTargetPixels(rt, 0, 0, W, H, buf)
      gl.setRenderTarget(null)
      gl.toneMapping = prevTM
      let c = feeds.get(p.id)
      if (!c) {
        c = document.createElement('canvas')
        c.width = W
        c.height = H
        feeds.set(p.id, c)
      }
      const ctx = c.getContext('2d')!
      const img = ctx.createImageData(W, H)
      for (let y = 0; y < H; y++) {
        const src = (H - 1 - y) * W * 4
        img.data.set(buf.subarray(src, src + W * 4), y * W * 4)
      }
      ctx.putImageData(img, 0, 0)
      // camera overlay: timestamp + REC
      ctx.fillStyle = 'rgba(0,0,0,.45)'
      ctx.fillRect(0, H - 20, W, 20)
      ctx.fillStyle = '#ff4d4f'
      ctx.beginPath()
      ctx.arc(10, H - 10, 4, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#fff'
      ctx.font = '11px monospace'
      ctx.fillText(`LIVE  ${PRINTERS[p.modelId].name} chamber cam`, 20, H - 6)
    }
  })
  return null
}
