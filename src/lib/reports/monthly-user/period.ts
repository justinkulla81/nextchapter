// Calendar-month helpers for the monthly member report. Everything is UTC so
// the cron, the stored monthKey and the admin page always agree on which
// month a moment belongs to.

const DAY_MS = 24 * 60 * 60 * 1000

export interface MonthWindow {
  key: string // "2026-10"
  label: string // "October 2026"
  start: Date // first instant of the month (UTC)
  end: Date // first instant of the next month (UTC), exclusive
}

export function monthKeyOf(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

export function isValidMonthKey(key: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(key)
}

export function monthWindow(key: string): MonthWindow {
  if (!isValidMonthKey(key)) throw new Error(`Invalid month key: ${key}`)
  const [y, m] = key.split('-').map(Number)
  const start = new Date(Date.UTC(y, m - 1, 1))
  const end = new Date(Date.UTC(y, m, 1))
  const label = start.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
  return { key, label, start, end }
}

export function previousMonthKey(key: string): string {
  const { start } = monthWindow(key)
  return monthKeyOf(new Date(start.getTime() - DAY_MS))
}

/** The `count` month keys ending at (and including) `key`, oldest first. */
export function trailingMonthKeys(key: string, count: number): string[] {
  const keys = [key]
  while (keys.length < count) keys.unshift(previousMonthKey(keys[0]))
  return keys
}

/** True when `now` falls on the last calendar day of its month (UTC). */
export function isLastDayOfMonth(now: Date): boolean {
  return new Date(now.getTime() + DAY_MS).getUTCDate() === 1
}

export function inWindow(d: Date | null | undefined, w: { start: Date; end: Date }): boolean {
  return !!d && d >= w.start && d < w.end
}
