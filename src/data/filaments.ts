export type Material = 'PLA' | 'PETG' | 'ABS' | 'TPU'
export type ColorId = 'black' | 'white' | 'grey' | 'red' | 'blue' | 'orange' | 'green' | 'yellow'

/** `moisture` = fraction absorbed per hour once the vacuum bag is opened (× the day's humidity). */
export const MATERIALS: Record<Material, { price: number; failMod: number; openWarp: number; moisture: number; note: string }> = {
  PLA: { price: 20, failMod: 0, openWarp: 0, moisture: 0.004, note: 'Easy, everyday material' },
  PETG: { price: 23, failMod: 0.01, openWarp: 0, moisture: 0.008, note: 'Tough, slightly stringy. Absorbs moisture' },
  ABS: { price: 22, failMod: 0.02, openWarp: 0.25, moisture: 0.006, note: 'Heat resistant. Warps on open printers' },
  TPU: { price: 32, failMod: 0.03, openWarp: 0, moisture: 0.015, note: 'Flexible. Very hygroscopic: dry before use' },
}

/** Moisture effects (see docs/M2_PLAN.md §2) */
export const MOISTURE = { failFrom: 0.3, gradeB: 0.35, gradeC: 0.6, dryPerHour: 0.12 }
export const moistureLabel = (m: number) => (m < 0.15 ? 'Dry' : m < 0.35 ? 'Slightly damp' : m < 0.6 ? 'Damp' : 'Wet')

export const COLORS: Record<ColorId, { name: string; hex: string }> = {
  black: { name: 'Black', hex: '#1b1b1d' },
  white: { name: 'White', hex: '#eeeeea' },
  grey: { name: 'Grey', hex: '#8a8f96' },
  red: { name: 'Red', hex: '#d42a23' },
  blue: { name: 'Blue', hex: '#2160d0' },
  orange: { name: 'Orange', hex: '#ff6a13' },
  green: { name: 'Green', hex: '#2fa84f' },
  yellow: { name: 'Yellow', hex: '#f3c21b' },
}

/** How often customers ask for each colour (weights). */
export const COLOR_DEMAND: Record<ColorId, number> = {
  black: 30, white: 20, grey: 14, red: 10, blue: 9, orange: 7, green: 5, yellow: 5,
}

export const SPOOL_GRAMS = 1000
export const filamentLabel = (m: Material, c: ColorId) => `${COLORS[c].name} ${m}`
