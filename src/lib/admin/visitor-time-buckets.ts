import { classifyUserAgent } from '@/lib/http/user-agent'

// Pure bucketing of HomepageVisitEvent rows for the admin Visitor activity
// page: hourly, daily, day-of-week and hour-of-day series, all in Eastern time
// (the convention the Visitors page already uses). Human page views only; a
// "unique visitor" is one IP inside one bucket, the same dedupe the daily chart
// has always used.

export const ET_TIME_ZONE = 'America/New_York'
const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS

export interface TrafficEvent {
  createdAt: Date
  userAgent: string | null
  ip: string | null
  eventType: string
}

export interface BucketCount {
  key: string
  count: number
}

// en-CA formats as YYYY-MM-DD, a sortable ET-anchored day key.
export function etDateKey(date: Date): string {
  return date.toLocaleDateString('en-CA', { timeZone: ET_TIME_ZONE })
}

export function etHourOfDay(date: Date): number {
  const h = Number(date.toLocaleString('en-US', { timeZone: ET_TIME_ZONE, hour: 'numeric', hour12: false }))
  return h === 24 ? 0 : h
}

// "2026-10-26 20" — ET calendar day plus the ET hour (00-23).
export function etHourKey(date: Date): string {
  return `${etDateKey(date)} ${String(etHourOfDay(date)).padStart(2, '0')}`
}

// 0 = Monday ... 6 = Sunday.
export function etWeekdayIndex(date: Date): number {
  const name = date.toLocaleDateString('en-US', { timeZone: ET_TIME_ZONE, weekday: 'short' })
  return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(name)
}

export const WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

function humanPageViews(events: TrafficEvent[]): TrafficEvent[] {
  return events.filter((e) => e.eventType === 'PAGE_VIEW' && classifyUserAgent(e.userAgent) === 'human')
}

// Counts page views, or distinct IPs, per key. Events with no IP cannot be
// deduped, so they are left out of the unique count rather than guessed at.
function countByKey(events: TrafficEvent[], keyFor: (d: Date) => string, unique: boolean): Map<string, number> {
  const counts = new Map<string, number>()
  const seen = new Map<string, Set<string>>()
  for (const e of humanPageViews(events)) {
    const key = keyFor(e.createdAt)
    if (unique) {
      if (!e.ip) continue
      const ips = seen.get(key) ?? new Set<string>()
      if (ips.has(e.ip)) continue
      ips.add(e.ip)
      seen.set(key, ips)
    }
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return counts
}

// One bucket per step going back from `now`, oldest first, zero-filled so a
// quiet stretch reads as zero rather than as missing data.
function trailingKeys(now: Date, steps: number, stepMs: number, keyFor: (d: Date) => string): string[] {
  const keys: string[] = []
  for (let i = steps - 1; i >= 0; i--) {
    const key = keyFor(new Date(now.getTime() - i * stepMs))
    if (keys[keys.length - 1] !== key) keys.push(key)
  }
  return keys
}

export function perDaySeries(events: TrafficEvent[], now: Date, days: number, unique: boolean): BucketCount[] {
  const counts = countByKey(events, etDateKey, unique)
  return trailingKeys(now, days, DAY_MS, etDateKey).map((key) => ({ key, count: counts.get(key) ?? 0 }))
}

/** Days from the first human page view to today (ET, inclusive), at least `min`, so "all time" starts where the data does. */
export function allTimeDayCount(events: TrafficEvent[], now: Date, min = 30): number {
  let earliest: Date | null = null
  for (const e of humanPageViews(events)) if (!earliest || e.createdAt < earliest) earliest = e.createdAt
  if (!earliest) return min
  const first = Date.parse(`${etDateKey(earliest)}T12:00:00Z`)
  const last = Date.parse(`${etDateKey(now)}T12:00:00Z`)
  return Math.max(min, Math.round((last - first) / DAY_MS) + 1)
}

export function perHourSeries(events: TrafficEvent[], now: Date, hours: number, unique: boolean): BucketCount[] {
  const counts = countByKey(events, etHourKey, unique)
  return trailingKeys(now, hours, HOUR_MS, etHourKey).map((key) => ({ key, count: counts.get(key) ?? 0 }))
}

export interface AverageBucket {
  label: string
  average: number
}

// Mean per calendar day of each day-of-week (Mon..Sun) over the trailing
// window, so a Monday that occurs five times is not inflated against a
// Sunday that occurs four.
export function byWeekday(events: TrafficEvent[], now: Date, windowDays: number, unique: boolean): AverageBucket[] {
  const dayCounts = countByKey(events, etDateKey, unique)
  const totals = new Array<number>(7).fill(0)
  const occurrences = new Array<number>(7).fill(0)
  for (const dateKey of trailingKeys(now, windowDays, DAY_MS, etDateKey)) {
    const idx = etWeekdayIndex(new Date(`${dateKey}T12:00:00-05:00`))
    occurrences[idx] += 1
    totals[idx] += dayCounts.get(dateKey) ?? 0
  }
  return WEEKDAY_NAMES.map((name, i) => ({ label: name, average: occurrences[i] ? totals[i] / occurrences[i] : 0 }))
}

// Mean per hour-of-day (0-23) across the weekdays (Mon-Fri) or the weekend
// days (Sat-Sun) in the trailing window.
export function byHourOfDay(
  events: TrafficEvent[],
  now: Date,
  windowDays: number,
  unique: boolean,
  dayType: 'weekday' | 'weekend'
): AverageBucket[] {
  const wantWeekend = dayType === 'weekend'
  const isWanted = (d: Date) => etWeekdayIndex(d) >= 5 === wantWeekend
  const counts = countByKey(events.filter((e) => isWanted(e.createdAt)), etHourKey, unique)
  const dateKeys = trailingKeys(now, windowDays, DAY_MS, etDateKey).filter((k) =>
    isWanted(new Date(`${k}T12:00:00-05:00`))
  )
  const totals = new Array<number>(24).fill(0)
  for (const dateKey of dateKeys) {
    for (let h = 0; h < 24; h++) totals[h] += counts.get(`${dateKey} ${String(h).padStart(2, '0')}`) ?? 0
  }
  return totals.map((total, h) => ({ label: hourLabel(h), average: dateKeys.length ? total / dateKeys.length : 0 }))
}

export function hourLabel(h: number): string {
  const suffix = h < 12 ? 'AM' : 'PM'
  return `${h % 12 === 0 ? 12 : h % 12} ${suffix}`
}
