import type { Material } from './filaments'

export type ProductId =
  | 'benchy' | 'clips' | 'phone_stand' | 'gear' | 'vase' | 'dragon' | 'suzanne' | 'planter' | 'helmet'
  | 'benchy_mc' | 'keychains' | 'dragon_mc' | 'chestplate'

export type BoxSize = 's' | 'm' | 'l'

export interface Product {
  id: ProductId
  name: string
  grams: number
  /** Hours on the reference printer (MK4) at Standard quality. */
  hours: number
  price: number
  box: BoxSize
  materials: Material[]
  /** Relative demand weight in the web shop. */
  demand: number
  /** Footprint (mm) used for the toolpath animation. */
  footprint: [number, number]
  description: string
  /** Number of colours (multicolour products need an AMS or a toolchanger) */
  colors?: number
  /** Smallest build-volume edge (mm) needed */
  minBuild?: number
  /** 3D model to show (defaults to the product id) */
  mesh?: string
}

export const PRODUCTS: Record<ProductId, Product> = {
  benchy: { id: 'benchy', name: 'Benchy Boat', grams: 15, hours: 1.0, price: 9, box: 's', materials: ['PLA', 'PETG'], demand: 14, footprint: [60, 31], description: 'The iconic torture-test tugboat. Desk toy favourite.' },
  clips: { id: 'clips', name: 'Cable Clips ×10', grams: 12, hours: 0.8, price: 7, box: 's', materials: ['PLA', 'PETG', 'TPU'], demand: 12, footprint: [75, 36], description: 'Snap-on clips for desk cable management.' },
  phone_stand: { id: 'phone_stand', name: 'Phone Stand', grams: 35, hours: 1.5, price: 12, box: 's', materials: ['PLA', 'PETG'], demand: 12, footprint: [85, 70], description: 'Sturdy angled stand for phones and small tablets.' },
  gear: { id: 'gear', name: 'Fidget Gear', grams: 25, hours: 1.5, price: 14, box: 's', materials: ['PLA', 'PETG'], demand: 9, footprint: [60, 60], description: 'Satisfying spinning gear fidget toy.' },
  vase: { id: 'vase', name: 'Spiral Vase', grams: 80, hours: 3.0, price: 24, box: 'm', materials: ['PLA', 'PETG'], demand: 8, footprint: [100, 100], description: 'Twisted single-wall vase. Looks amazing in silk colours.' },
  dragon: { id: 'dragon', name: 'Articulated Dragon', grams: 60, hours: 4.0, price: 29, box: 'm', materials: ['PLA'], demand: 10, footprint: [150, 50], description: 'Print-in-place flexi dragon. Kids love it.' },
  suzanne: { id: 'suzanne', name: 'Suzanne Bust', grams: 90, hours: 4.0, price: 27, box: 'm', materials: ['PLA'], demand: 6, footprint: [70, 65], description: 'The famous monkey on a pedestal.' },
  planter: { id: 'planter', name: 'Hex Planter', grams: 110, hours: 5.0, price: 32, box: 'm', materials: ['PLA', 'PETG'], demand: 7, footprint: [120, 104], description: 'Hexagonal planter with ribbed bands.' },
  helmet: { id: 'helmet', name: 'Cosplay Helmet', grams: 300, hours: 10.0, price: 85, box: 'l', materials: ['PLA', 'PETG', 'ABS'], demand: 3, footprint: [210, 235], description: 'Full-size sci-fi helmet shell, ready for sanding.', minBuild: 220 },
  benchy_mc: { id: 'benchy_mc', name: 'Multicolour Benchy', grams: 20, hours: 1.2, price: 19, box: 's', materials: ['PLA'], demand: 6, footprint: [60, 31], description: 'The tugboat in three colours: hull, cabin and roof.', colors: 3, mesh: 'benchy' },
  keychains: { id: 'keychains', name: 'Logo Keychains ×20', grams: 40, hours: 2.0, price: 28, box: 's', materials: ['PLA', 'PETG'], demand: 6, footprint: [120, 80], description: 'Two-colour logo keychains for a local business.', colors: 2 },
  dragon_mc: { id: 'dragon_mc', name: 'Rainbow Dragon', grams: 70, hours: 4.5, price: 45, box: 'm', materials: ['PLA'], demand: 5, footprint: [150, 50], description: 'The articulated dragon in four gradient colours.', colors: 4, mesh: 'dragon' },
  chestplate: { id: 'chestplate', name: 'Cosplay Chest Armor', grams: 900, hours: 18, price: 210, box: 'l', materials: ['PLA', 'PETG'], demand: 2, footprint: [330, 300], description: 'One-piece chest armour. Only fits an XL-class build volume.', minBuild: 340 },
}

export const PRODUCT_LIST = Object.values(PRODUCTS)

export const BOX_SIZES: Record<BoxSize, { name: string; cost: number; label: number; dims: string }> = {
  s: { name: 'Small', cost: 0.6, label: 4, dims: '15×15×10 cm' },
  m: { name: 'Medium', cost: 0.9, label: 6, dims: '25×20×15 cm' },
  l: { name: 'Large', cost: 1.5, label: 9, dims: '40×30×25 cm' },
}
export const boxFits = (item: BoxSize, box: BoxSize) => 'sml'.indexOf(box) >= 'sml'.indexOf(item)
