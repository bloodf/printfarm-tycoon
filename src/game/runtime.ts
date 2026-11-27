/**
 * Shared mutable runtime state for the 3D world (not React state: read every frame, never re-renders).
 */
import * as THREE from 'three'

export const runtime = {
  /** When set, the camera eases to this pose (laptop, packing station, printer close-up). */
  focus: null as null | { pos: THREE.Vector3; look: THREE.Vector3 },
  /** World positions of printers (audio + toasts) */
  printerPos: new Map<string, THREE.Vector3>(),
  /** Direction each printer faces (for close-up framing) */
  printerFacing: new Map<string, THREE.Vector3>(),
  /** Built-in chamber/tower camera of camera-equipped printers (Farm app live feed) */
  printerCam: new Map<string, { cam: THREE.Object3D; look: THREE.Object3D }>(),
  /** The active 3D camera (set by the camera controller) */
  camera: null as THREE.Camera | null,
  /** Animated P1S door openness per printer id (0..1) */
  doorOpen: new Map<string, number>(),
  /** Frame stats for the FPS counter / QA */
  stats: { fps: 0, drawCalls: 0, triangles: 0 },
}
