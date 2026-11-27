/**
 * Garage level layout (three.js coordinates: +Y up, garage door at +Z, back wall at -Z).
 * Prop GLB roots face +Z ("front"); rotY turns them to face into the room.
 */
export const ROOM = { x0: -3, x1: 3, z0: -3.25, z1: 3.25, h: 2.7 }

import layout from '../data/layout.json'

export interface Placement {
  prop: string
  pos: [number, number, number]
  rotY: number
  collide?: boolean
  parent?: string
}

/** Shared with the Blender lightmap bake (tools/blender/bake_lightmaps.py): keep both in sync through this JSON. */
export const PLACEMENTS = layout.placements as Placement[]

/** Extra static colliders (x0, z0, x1, z1): the step in front of the house door. */
export const EXTRA_COLLIDERS = layout.extraColliders as [number, number, number, number][]

export const HOUSE_DOOR = { pos: [-2.96, 1.05, -2.3] as [number, number, number], size: [0.08, 2.0, 0.9] as [number, number, number] }
export const CRATE_ZONE = { x: -1.3, z: 2.55, step: 0.75 }
export const PLAYER_START = { x: 0, z: 1.2, yaw: 0 }
export const RADIUS = 0.28
