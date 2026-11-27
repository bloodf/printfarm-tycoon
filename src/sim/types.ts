import type { ColorId, Material } from '../data/filaments'
import type { BoxSize, ProductId } from '../data/products'
import type { PrinterModelId } from '../data/printers'
import type { QualityId, SupplyId, UpgradeId } from '../data/economy'
import type { ErrorCode, PartId } from '../data/errors'
import type { IncidentType } from '../data/incidents'

/** Game time is measured in minutes since Day 1, 00:00. */
export type Minutes = number

export type PrinterStatus =
  | 'idle' // ready, bed clear
  | 'waiting_usb' // job on USB stick, waiting for the player to start it at the machine
  | 'heating'
  | 'printing'
  | 'paused_runout' // filament ran out (or paused by the player)
  | 'paused_power' // power cut: waiting for the power to come back
  | 'error' // machine error (see Printer.error)
  | 'updating' // firmware update in progress
  | 'done' // finished, print on the bed

export type FailureType = 'spaghetti' | 'clog' | 'layer_shift'

export interface Job {
  id: string
  orderId: string
  productId: ProductId
  material: Material
  /** one colour per material slot used (multicolour jobs have 2–5) */
  colors: ColorId[]
  /** printer tool index used for each colour */
  tools: number[]
  quality: QualityId
  durationMin: number
  elapsedMin: number
  heatLeftMin: number
  /** grams of model + purge */
  grams: number
  /** Pre-rolled print failure (hidden from the machine; the player must notice). */
  failure: { type: FailureType; at: number } | null
  /** Pre-rolled machine error */
  error: { code: ErrorCode; at: number } | null
  failed: boolean
  spaghettiGrams: number
  stoppedAt: number | null
  startedAt: Minutes
  /** Worst moisture of the spools used at the start (drives stringing/grade) */
  moisture: number
  /** Resumed with a different colour after a runout */
  colorMix?: boolean
  /** A machine error already happened in this job */
  errored?: boolean
}

export interface PrinterError {
  code: ErrorCode
  /** the job was lost (true) or is paused until fixed (false) */
  abort: boolean
}

export interface Printer {
  id: string
  modelId: PrinterModelId
  /** slot id, see data/garage.ts (A0–A3 bench, B0–B2 print table, X0 XL cart) */
  slot: string
  status: PrinterStatus
  job: Job | null
  /** loaded spool per tool (length = model.tools) */
  spools: (string | null)[]
  bedItemId: string | null
  needsMaintenance: boolean
  error: PrinterError | null
  wear: { nozzleH: number; beltH: number; plate: number }
  /** a firmware update is waiting (errors more likely until installed) */
  fwPending: boolean
  /** minutes left of a running firmware update */
  updateLeft: number
  /** status before a power cut paused it */
  resumeStatus: PrinterStatus | null
  printMinutesToday: number
  totalPrints: number
}

export type SpoolLoc =
  | { t: 'shelf'; slot: number }
  | { t: 'printer'; printerId: string; tool: number }
  | { t: 'held' }
  | { t: 'dryer'; dryerId: string; slot: number }

export interface Spool {
  id: string
  material: Material
  color: ColorId
  grams: number
  /** 0..1 absorbed moisture */
  moisture: number
  /** still in the vacuum bag (does not absorb moisture) */
  sealed: boolean
  loc: SpoolLoc
}

export interface Dryer {
  id: string
  /** index into DRYER_SPOTS */
  spot: number
  slots: (string | null)[]
}

export type Grade = 'A+' | 'A' | 'B' | 'C' | 'F'

export type ItemLoc =
  | { t: 'bed'; printerId: string }
  | { t: 'held' }
  | { t: 'table' }
  | { t: 'packslot' }
  | { t: 'outbox'; slot: number }
  | { t: 'floor'; x: number; y: number; z: number }
  | { t: 'gone' }

export type Defect = 'layer_shift' | 'incomplete' | 'spaghetti' | 'color_mix' | 'stringing' | 'power_loss' | 'aborted' | null

export interface Item {
  id: string
  kind: 'print' | 'box'
  orderId: string | null
  productId: ProductId
  material: Material
  /** primary colour (first of `colors`) */
  color: ColorId
  colors: ColorId[]
  grade: Grade
  defect: Defect
  fraction: number
  boxSize?: BoxSize
  padded?: boolean
  loc: ItemLoc
}

export type OrderStatus = 'new' | 'queued' | 'printing' | 'printed' | 'packed' | 'in_outbox' | 'shipped' | 'cancelled'

export interface Order {
  id: string
  number: number
  source: 'shop' | 'email'
  customer: string
  email: string
  city: string
  productId: ProductId
  material: Material
  /** primary colour (first of `colors`) */
  color: ColorId
  colors: ColorId[]
  price: number
  createdAt: Minutes
  dueDay: number
  status: OrderStatus
  attempts: number
  shippedDay: number | null
  late: boolean
  grade: Grade | null
  reviewed: boolean
  padded?: boolean
  defect?: Defect
  complained?: boolean
}

export interface MailChoice {
  id: string
  label: string
}

export interface Mail {
  id: string
  from: string
  fromName: string
  subject: string
  body: string
  time: Minutes
  read: boolean
  kind: 'info' | 'request' | 'complaint' | 'review' | 'supplier' | 'system'
  choices?: MailChoice[]
  chosen?: string
  replyText?: string
  counterAt?: Minutes
  counterResolved?: boolean
  request?: { productId: ProductId; material: Material; color: ColorId; price: number; customer: string; email: string; city: string }
  orderId?: string
}

export interface DeliveryContent {
  kind: 'spool' | 'supply' | 'printer' | 'upgrade'
  material?: Material
  color?: ColorId
  supply?: SupplyId
  printer?: PrinterModelId
  upgrade?: UpgradeId
  qty: number
}

export interface Crate {
  id: string
  contents: DeliveryContent[]
  arriveAt: Minutes
  arrived: boolean
  opened: boolean
  big: boolean
}

export interface LedgerEntry {
  day: number
  time: Minutes
  amount: number
  category: 'sales' | 'fees' | 'labels' | 'filament' | 'supplies' | 'printers' | 'electricity' | 'refunds' | 'upgrades'
  label: string
}

export interface Review {
  day: number
  orderId: string
  customer: string
  stars: number
  text: string
}

export interface DayStats {
  day: number
  shipped: number
  revenue: number
  costs: number
  repStart: number
  repEnd: number
  failures: number
  printsDone: number
  errors: number
}

export interface Incident {
  type: IncidentType
  day: number
  start: Minutes
  end: Minutes
  /** viral product / firmware printer */
  productId?: ProductId
  printerId?: string
  started?: boolean
  ended?: boolean
}

export type SimEvent =
  | { type: 'order'; orderId: string }
  | { type: 'mail'; mailId: string }
  | { type: 'print_done'; printerId: string }
  | { type: 'print_started'; printerId: string }
  | { type: 'runout'; printerId: string }
  | { type: 'failure_hidden'; printerId: string; failure: FailureType }
  | { type: 'printer_error'; printerId: string; code: ErrorCode }
  | { type: 'courier'; count: number; revenue: number }
  | { type: 'delivery'; crateId: string }
  | { type: 'money'; amount: number; label: string }
  | { type: 'goal'; goalId: string }
  | { type: 'review'; stars: number; customer: string }
  | { type: 'day_end'; forced: boolean }
  | { type: 'power'; on: boolean }
  | { type: 'internet'; on: boolean }
  | { type: 'incident'; incident: IncidentType }
  | { type: 'dried'; spoolId: string }
  | { type: 'error'; message: string }
  | { type: 'info'; message: string }

export interface SimState {
  version: number
  time: Minutes
  day: number
  money: number
  reputation: number
  seed: number
  /** Separate RNG stream for print failures (independent of order spawning / frame timing) */
  failSeed: number
  /** Jobs ever created (the very first one is a guaranteed success: tutorial grace) */
  jobsCreated: number
  nextId: number
  nextOrderNumber: number
  printers: Printer[]
  spools: Spool[]
  dryers: Dryer[]
  orders: Order[]
  items: Item[]
  mail: Mail[]
  crates: Crate[]
  supplies: { box_s: number; box_m: number; box_l: number; paper: number }
  parts: Record<PartId, number>
  upgrades: { ups: boolean }
  incidents: Incident[]
  power: boolean
  internet: boolean
  /** minutes the current power cut has lasted (UPS budget) */
  outageMin: number
  /** shop orders that could not arrive during an internet outage (delivered when it's back) */
  missedOrders: number
  courierTime: Minutes
  held: { kind: 'spool' | 'item' | 'crate'; id: string } | null
  ledger: LedgerEntry[]
  reviews: Review[]
  stats: DayStats[]
  goalsDone: string[]
  courierDoneDay: number
  dayEnded: boolean
  electricityToday: number
  events: SimEvent[]
}
