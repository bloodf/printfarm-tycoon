import { create } from 'zustand'
import type { BoxSize } from '../data/products'

export type PackStep = 'select' | 'qc' | 'box' | 'fill' | 'tape' | 'label' | 'done'

interface PackingState {
  itemId: string | null
  box: BoxSize | null
  padded: boolean
  step: PackStep
  tape: number
  set: (p: Partial<Omit<PackingState, 'set' | 'reset'>>) => void
  reset: () => void
}

export const usePacking = create<PackingState>((set) => ({
  itemId: null,
  box: null,
  padded: false,
  step: 'select',
  tape: 0,
  set: (p) => set(p),
  reset: () => set({ itemId: null, box: null, padded: false, step: 'select', tape: 0 }),
}))
