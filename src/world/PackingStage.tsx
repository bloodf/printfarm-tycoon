import * as THREE from 'three'
import { useGame } from '../game/store'
import { usePacking } from '../game/packing'
import { getItem } from '../sim/sim'
import { COLORS } from '../data/filaments'
import { BoxModel, PrintModel, type BoxStage } from './ItemModel'
import { points } from './Level'

/** The 3D box being packed on the packing station (follows the packing UI steps). */
export function PackingStage() {
  const overlay = useGame((s) => s.overlay)
  const { itemId, box, step, padded } = usePacking()
  const item = useGame((s) => (itemId ? getItem(s.sim, itemId) : undefined))
  const slot = points.get('PackSlot')
  if (overlay !== 'packing' || !slot || !item || step === 'done' || item.loc.t === 'gone') return null
  const p = slot.getWorldPosition(new THREE.Vector3())
  const stage: BoxStage = step === 'fill' ? (padded ? 'filled' : 'open') : step === 'tape' ? 'closed' : step === 'label' ? 'taped' : 'open'
  const showItem = !box || step === 'box' || step === 'fill' || step === 'qc'
  return (
    <group position={p} rotation-y={-Math.PI / 2}>
      {box && step !== 'qc' && <BoxModel size={box} stage={stage} />}
      {showItem && (
        <group position={box && step !== 'qc' ? [0, 0.012, 0] : [0.0, 0, 0]} scale={box && step !== 'qc' ? 1 : 1.6}>
          <PrintModel productId={item.productId} color={COLORS[item.color].hex} colors={item.colors.map((c) => COLORS[c].hex)} fraction={item.fraction} failed={item.defect === 'spaghetti'} />
        </group>
      )}
    </group>
  )
}
