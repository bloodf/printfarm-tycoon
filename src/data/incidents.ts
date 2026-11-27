export type IncidentType =
  | 'power_outage' | 'internet_outage' | 'humid_day' | 'heat_wave' | 'courier_late' | 'supplier_delay' | 'viral_product'
  | 'firmware_update'

export interface IncidentDef {
  type: IncidentType
  name: string
  icon: string
  /** daily chance (from day 2) */
  chance: number
  /** announced in the morning (true) or a surprise when it starts (false) */
  announced: boolean
  /** the whole day (true) or a window [start, start+duration] */
  allDay: boolean
  blurb: string
}

export const INCIDENTS: Record<IncidentType, IncidentDef> = {
  power_outage: { type: 'power_outage', name: 'Power outage', icon: '⚡', chance: 0.14, announced: false, allDay: false, blurb: 'The lights go out. Printers without power-loss recovery lose their prints. A UPS keeps everything running for 60 minutes.' },
  internet_outage: { type: 'internet_outage', name: 'Internet down', icon: '📶', chance: 0.16, announced: false, allDay: false, blurb: 'No new orders or emails, Wi-Fi printers can’t receive jobs, the Shop is offline. Print from USB instead.' },
  humid_day: { type: 'humid_day', name: 'Humid day', icon: '💧', chance: 0.2, announced: true, allDay: true, blurb: 'Opened spools absorb moisture 3× faster today. Keep the dryers busy.' },
  heat_wave: { type: 'heat_wave', name: 'Heat wave', icon: '🌡', chance: 0.1, announced: true, allDay: true, blurb: 'It’s hot in the garage: nozzle clogs are twice as likely.' },
  courier_late: { type: 'courier_late', name: 'Courier running late', icon: '🚚', chance: 0.1, announced: true, allDay: true, blurb: 'Pickup today at 19:00 instead of 17:00.' },
  supplier_delay: { type: 'supplier_delay', name: 'Supplier delay', icon: '📦', chance: 0.08, announced: true, allDay: true, blurb: 'Deliveries due today arrive tomorrow.' },
  viral_product: { type: 'viral_product', name: 'Viral product', icon: '🔥', chance: 0.12, announced: true, allDay: true, blurb: 'One product is trending: 5× orders at +20% price today.' },
  firmware_update: { type: 'firmware_update', name: 'Firmware update', icon: '⬆', chance: 0.15, announced: true, allDay: true, blurb: 'A printer wants a firmware update (15 min). Skipping it makes errors more likely.' },
}
export const INCIDENT_LIST = Object.values(INCIDENTS)
