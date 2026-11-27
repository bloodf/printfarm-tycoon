/** Balance constants (GDD §3, §9, §10). */
export const DAY_START = 8 * 60
export const COURIER_TIME = 17 * 60
export const SLEEP_ALLOWED = 17 * 60
export const DAY_FORCED_END = 23 * 60
export const DELIVERY_TIME = 8 * 60 + 30
export const SHOP_OPEN = 8 * 60
export const SHOP_CLOSE = 20 * 60

export const START_MONEY = 400
export const START_REPUTATION = 3.0
export const PLATFORM_FEE = 0.05
export const ELECTRICITY_PER_KWH = 0.3
export const HEAT_MINUTES = 4

export const QUALITY = {
  draft: { name: 'Draft', time: 0.7, fail: 0.04, maxGrade: 'B' as const },
  standard: { name: 'Standard', time: 1.0, fail: 0, maxGrade: 'A' as const },
  fine: { name: 'Fine', time: 1.5, fail: -0.02, maxGrade: 'A+' as const },
}
export type QualityId = keyof typeof QUALITY

export const SUPPLIES = {
  box_s: { name: 'Small boxes ×10', price: 6, kind: 'box' as const, size: 's' as const, qty: 10 },
  box_m: { name: 'Medium boxes ×10', price: 9, kind: 'box' as const, size: 'm' as const, qty: 10 },
  box_l: { name: 'Large boxes ×10', price: 15, kind: 'box' as const, size: 'l' as const, qty: 10 },
  paper: { name: 'Kraft paper roll (20 packs)', price: 8, kind: 'paper' as const, qty: 20 },
  nozzle: { name: 'Spare hardened nozzles ×3', price: 15, kind: 'part' as const, part: 'nozzle' as const, qty: 3 },
  fan: { name: 'Spare part-cooling fan', price: 12, kind: 'part' as const, part: 'fan' as const, qty: 1 },
  ipa: { name: 'IPA 99% (20 plate cleans)', price: 9, kind: 'part' as const, part: 'ipa' as const, qty: 20 },
}

export const UPGRADES = {
  ups: { name: 'UPS battery backup (1500 VA)', price: 349, blurb: 'Keeps every printer running for the first 60 minutes of a power cut.' },
  dryer: { name: 'Filament dryer (2 spools)', price: 69, blurb: 'Dries two spools at 55 °C: about 12% moisture per hour.' },
}
export type UpgradeId = keyof typeof UPGRADES
export type SupplyId = keyof typeof SUPPLIES

export const SHELF_SPOOL_SLOTS = 30
export const OUTBOX_SLOTS = 6
