import { useMemo } from 'react'
import * as THREE from 'three'
import { useGame } from '../game/store'
import { getItem } from '../sim/sim'
import { COLORS } from '../data/filaments'
import type { BoxSize, ProductId } from '../data/products'
import { cloneNode, findNode, part, setRelScale, useModel } from './assets'
import { makeFinishedMaterial, setBands } from './printMaterial'
import { PRODUCTS } from '../data/products'
import { makeSpaghettiGeometry, setSpaghettiAmount } from './spaghetti'

export type BoxStage = 'open' | 'filled' | 'closed' | 'taped' | 'labelled'

/** A cardboard box rig with packing-stage visibility. */
export function BoxModel({ size, stage = 'labelled' }: { size: BoxSize; stage?: BoxStage }) {
  const boxes = useModel('boxes')
  const obj = useMemo(() => cloneNode(part(boxes, `box_${size}`)), [boxes, size])
  const set = (name: string, v: boolean) => {
    const n = findNode(obj, name)
    if (n) n.visible = v
  }
  const open = stage === 'open' || stage === 'filled'
  set('BoxOpen', open)
  set('Fill', stage === 'filled')
  set('BoxClosedNode', !open)
  set('BoxClosed', !open)
  set('Tape', stage === 'taped' || stage === 'labelled')
  set('Label', stage === 'labelled')
  return <primitive object={obj} />
}

/** A finished print (or failed blob) of a product in a colour. */
export function PrintModel({ productId, color, colors, fraction = 1, failed = false }: { productId: ProductId; color: string; colors?: string[]; fraction?: number; failed?: boolean }) {
  const products = useModel('products')
  const obj = useMemo(() => {
    const g = new THREE.Group()
    if (failed) {
      const geo = makeSpaghettiGeometry(productId.length * 97 + 13, 0.05, 0.04)
      setSpaghettiAmount(geo, 1)
      const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.4 }))
      m.castShadow = true
      g.add(m)
      return g
    }
    const src = part(products, PRODUCTS[productId].mesh ?? productId)
    const height = (src.userData.height as number) ?? 0.05
    const c = src.clone(true)
    c.position.set(0, 0, 0)
    const mat = makeFinishedMaterial(color)
    const bands = colors && colors.length > 1 ? colors : null
    const base = new THREE.Vector3()
    c.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.isMesh) {
        m.material = mat
        m.castShadow = true
        m.receiveShadow = true
        // multicolour: colour bands by height, measured from the item's base in world space
        if (bands) m.onBeforeRender = () => setBands(mat, bands, c.getWorldPosition(base).y, height * c.getWorldScale(base).y)
      }
    })
    if (fraction < 1) setRelScale(c, 1, Math.max(0.05, fraction), 1)
    g.add(c)
    return g
  }, [products, productId, color, fraction, failed, colors?.join(',')]) // eslint-disable-line react-hooks/exhaustive-deps
  return <primitive object={obj} />
}

export function ItemModel({ itemId }: { itemId: string }) {
  const it = useGame((g) => getItem(g.sim, itemId))
  if (!it) return null
  if (it.kind === 'box') return <BoxModel size={it.boxSize ?? 's'} stage="labelled" />
  return <PrintModel productId={it.productId} color={COLORS[it.color].hex} colors={it.colors.map((c) => COLORS[c].hex)} fraction={it.fraction} failed={it.defect === 'spaghetti'} />
}
