/**
 * Interactable registry: any Object3D can be made interactable by giving it a uid and a target function
 * that returns the hover title + prompts for the current game state.
 */
import type * as THREE from 'three'
import type { HoverTarget } from '../game/store'

export interface Interactable {
  uid: string
  object: THREE.Object3D
  /** Objects to outline when hovered */
  outline: THREE.Object3D[]
  target: () => HoverTarget | null
  /** Higher wins when several interactables are hit at about the same depth (items > furniture). */
  priority?: number
}

export const interactables = new Map<string, Interactable>()

export function register(i: Interactable) {
  i.object.userData.uid = i.uid
  i.object.traverse((o) => (o.userData.uid = i.uid))
  interactables.set(i.uid, i)
  return () => {
    if (interactables.get(i.uid) === i) interactables.delete(i.uid)
  }
}
