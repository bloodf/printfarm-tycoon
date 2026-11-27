import { dayOf, minuteOfDay } from '../sim/sim'

export const money = (n: number, cents = true) =>
  (n < 0 ? '-' : '') + '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 })

export const clock = (t: number) => {
  const m = Math.floor(minuteOfDay(t))
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

const WEEKDAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']
export const weekday = (t: number) => WEEKDAYS[(dayOf(t) - 1) % 7]

export const duration = (min: number) => {
  const m = Math.max(0, Math.round(min))
  if (m < 60) return `${m}m`
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`
}

export const pct = (f: number) => `${Math.round(f * 100)}%`
