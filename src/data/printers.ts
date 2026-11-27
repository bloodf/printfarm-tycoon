/**
 * Printer catalogue. Visual models are built from the real machines (docs/specs/ART.md, docs/M2_PLAN.md);
 * names are parody brands (decision D3). Change `name`/`brand` here to use real names.
 */
export type PrinterModelId = 'ender3v3' | 'mk4' | 'p1s' | 'a1' | 'u1' | 'k1' | 'xl'
/** Footprint class (decision D12): M fits any slot, L needs a wide slot, XL needs the floor cart. */
export type SizeClass = 'm' | 'l' | 'xl'

export interface PrinterModel {
  id: PrinterModelId
  name: string
  brand: string
  reference: string
  price: number
  /** Print-time multiplier relative to the reference printer (MK4 = 1). */
  speed: number
  /** Base print-failure chance per job (spaghetti/clog/layer shift). */
  baseFail: number
  /** Chance per job of a machine error (thermal runaway, MCU crash, fan…). */
  errorRate: number
  link: 'usb' | 'wifi'
  camera: boolean
  enclosed: boolean
  buildMm: [number, number, number]
  /** Filament slots: 1 = single extruder, 4 = AMS lite / 4-head toolchanger, 5 = XL 5T */
  tools: number
  /** Multi-material hardware type (changes time/waste per colour change) */
  multi: 'none' | 'ams' | 'toolchanger'
  /** Resumes after a power cut (otherwise the print is lost) */
  powerRecovery: boolean
  size: SizeClass
  /** Power draw while printing, kW (electricity cost). */
  kw: number
  model: string
  blurb: string
  /** Screen UI colours for the painted on-printer display. */
  ui: { bg: string; fg: string; accent: string }
}

export const PRINTERS: Record<PrinterModelId, PrinterModel> = {
  ender3v3: {
    id: 'ender3v3', name: 'Endr-3 V3 SE', brand: 'Kreality', reference: 'Creality Ender-3 V3 SE',
    price: 199, speed: 1.35, baseFail: 0.12, errorRate: 0.05, link: 'usb', camera: false, enclosed: false,
    buildMm: [220, 220, 250], tools: 1, multi: 'none', powerRecovery: false, size: 'm', kw: 0.12,
    model: '/assets/models/printer_ender3v3.glb',
    blurb: 'The printer that started it all. Cheap, loud, USB-only, and it loses prints in a power cut.',
    ui: { bg: '#0b1420', fg: '#e6f0ff', accent: '#2f8cff' },
  },
  k1: {
    id: 'k1', name: 'K1', brand: 'Kreality', reference: 'Creality K1',
    price: 399, speed: 0.55, baseFail: 0.09, errorRate: 0.07, link: 'wifi', camera: false, enclosed: true,
    buildMm: [220, 220, 250], tools: 1, multi: 'none', powerRecovery: true, size: 'm', kw: 0.16,
    model: '/assets/models/printer_k1.glb',
    blurb: 'Enclosed CoreXY that is fast and cheap, but temperamental. Expect error codes.',
    ui: { bg: '#101114', fg: '#f0f2f5', accent: '#19c37d' },
  },
  a1: {
    id: 'a1', name: 'A1 + AMS lite', brand: 'Bamboo Lab', reference: 'Bambu Lab A1 Combo',
    price: 559, speed: 0.6, baseFail: 0.05, errorRate: 0.04, link: 'wifi', camera: true, enclosed: false,
    buildMm: [256, 256, 256], tools: 4, multi: 'ams', powerRecovery: true, size: 'l', kw: 0.11,
    model: '/assets/models/printer_a1.glb',
    blurb: 'Friendly bed-slinger with a 4-colour AMS lite. Multicolour prints, but every colour change purges filament.',
    ui: { bg: '#f2f3f4', fg: '#1c1d1f', accent: '#00ae42' },
  },
  p1s: {
    id: 'p1s', name: 'P1S', brand: 'Bamboo Lab', reference: 'Bambu Lab P1S',
    price: 699, speed: 0.55, baseFail: 0.06, errorRate: 0.03, link: 'wifi', camera: true, enclosed: true,
    buildMm: [256, 256, 256], tools: 1, multi: 'none', powerRecovery: true, size: 'm', kw: 0.14,
    model: '/assets/models/printer_p1s.glb',
    blurb: 'Enclosed CoreXY speed demon with a chamber camera. Prints ABS without warping.',
    ui: { bg: '#f2f3f4', fg: '#1c1d1f', accent: '#00ae42' },
  },
  u1: {
    id: 'u1', name: 'U1', brand: 'Snapmakr', reference: 'Snapmaker U1',
    price: 999, speed: 0.65, baseFail: 0.06, errorRate: 0.05, link: 'wifi', camera: true, enclosed: false,
    buildMm: [270, 270, 270], tools: 4, multi: 'toolchanger', powerRecovery: true, size: 'l', kw: 0.2,
    model: '/assets/models/printer_u1.glb',
    blurb: 'Four-toolhead toolchanger: fast colour swaps with almost no purge waste.',
    ui: { bg: '#0e1116', fg: '#eef2f7', accent: '#2f7cf6' },
  },
  mk4: {
    id: 'mk4', name: 'MK4', brand: 'Prusla', reference: 'Prusa MK4',
    price: 1099, speed: 1.0, baseFail: 0.04, errorRate: 0.02, link: 'wifi', camera: false, enclosed: false,
    buildMm: [250, 210, 220], tools: 1, multi: 'none', powerRecovery: true, size: 'm', kw: 0.09,
    model: '/assets/models/printer_mk4.glb',
    blurb: 'The reliable workhorse. Load-cell levelling, Wi-Fi, prints that just work.',
    ui: { bg: '#111111', fg: '#f5f5f5', accent: '#ff5512' },
  },
  xl: {
    id: 'xl', name: 'XL 5T', brand: 'Prusla', reference: 'Prusa XL (5 toolheads)',
    price: 3499, speed: 0.85, baseFail: 0.03, errorRate: 0.03, link: 'wifi', camera: false, enclosed: false,
    buildMm: [360, 360, 360], tools: 5, multi: 'toolchanger', powerRecovery: true, size: 'xl', kw: 0.3,
    model: '/assets/models/printer_xl.glb',
    blurb: 'Huge, precise, five toolheads. The only machine for XL parts. Needs the floor cart.',
    ui: { bg: '#111111', fg: '#f5f5f5', accent: '#ff5512' },
  },
}

export const PRINTER_LIST = Object.values(PRINTERS)
export const printerLabel = (id: PrinterModelId) => `${PRINTERS[id].brand} ${PRINTERS[id].name}`
export const SIZE_LABEL: Record<SizeClass, string> = { m: 'M (bench)', l: 'L (wide table)', xl: 'XL (floor cart)' }
