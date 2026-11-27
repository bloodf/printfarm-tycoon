import type { PrinterModel } from './printers'

export type ErrorCode = 'E101' | 'E102' | 'E201' | 'E202' | 'E301' | 'E302'
export type PartId = 'nozzle' | 'fan' | 'ipa'

export interface ErrorDef {
  code: ErrorCode
  title: string
  detail: string
  fix: string
  /** seconds of (timed) work to fix */
  seconds: number
  /** true = the job is lost; false = the printer pauses and resumes after the fix */
  abort: boolean
  part?: PartId
  weight: number
  applies: (m: PrinterModel) => boolean
}

export const ERRORS: Record<ErrorCode, ErrorDef> = {
  E101: { code: 'E101', title: 'Thermal runaway', detail: 'The hotend temperature stopped responding. Heater shut down for safety.', fix: 'Reseat the thermistor', seconds: 6, abort: true, weight: 18, applies: () => true },
  E102: { code: 'E102', title: 'Heatbed fault', detail: 'Bed temperature out of range. The bed connector is loose.', fix: 'Check the bed connector', seconds: 5, abort: true, weight: 14, applies: () => true },
  E201: { code: 'E201', title: 'AMS filament tangle', detail: 'The AMS lite could not feed filament: a spool is tangled.', fix: 'Untangle the AMS slot', seconds: 8, abort: false, weight: 35, applies: (m) => m.multi === 'ams' },
  E202: { code: 'E202', title: 'Tool change failed', detail: 'A toolhead did not lock onto the carriage.', fix: 'Recalibrate the tool offsets', seconds: 10, abort: false, weight: 35, applies: (m) => m.multi === 'toolchanger' },
  E301: { code: 'E301', title: 'MCU crash', detail: 'The main board rebooted (firmware watchdog).', fix: 'Power-cycle the printer', seconds: 4, abort: true, weight: 18, applies: () => true },
  E302: { code: 'E302', title: 'Part-cooling fan failure', detail: 'The part-cooling fan stopped spinning. Print paused.', fix: 'Replace the fan (spare part)', seconds: 8, abort: false, part: 'fan', weight: 15, applies: () => true },
}
export const ERROR_LIST = Object.values(ERRORS)

/** Wear thresholds (print-hours / prints) */
export const WEAR = { nozzleH: 250, beltH: 400, platePrints: 8 }
