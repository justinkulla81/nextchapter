// Calendar weeks for the weekly layoff pages (/layoffs/week/2026-w43). ISO weeks, Monday to Sunday, in UTC, so a week's
// address never changes and the same notices always land in the same week. Pure.

const DAY = 86_400_000

/** Monday 00:00 UTC of the ISO week containing `d`. */
export function weekStart(d: Date): Date {
  const t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  const dow = (new Date(t).getUTCDay() + 6) % 7 // Monday = 0
  return new Date(t - dow * DAY)
}

/** ISO week-year and number for the week starting `monday`. */
export function isoWeek(monday: Date): { year: number; week: number } {
  const thursday = new Date(monday.getTime() + 3 * DAY)
  const year = thursday.getUTCFullYear()
  const jan1 = Date.UTC(year, 0, 1)
  const week = Math.floor((thursday.getTime() - jan1) / (7 * DAY)) + 1
  return { year, week }
}

export function weekId(monday: Date): string {
  const { year, week } = isoWeek(monday)
  return `${year}-w${String(week).padStart(2, '0')}`
}

/** Monday of "2026-w43", or null for anything that is not a real week id. */
export function parseWeekId(id: string): Date | null {
  const m = /^(\d{4})-w(\d{2})$/.exec(id)
  if (!m) return null
  const year = Number(m[1])
  const week = Number(m[2])
  if (week < 1 || week > 53 || year < 2000 || year > 2100) return null
  // ISO week 1 is the week with January 4th.
  const jan4 = new Date(Date.UTC(year, 0, 4))
  const monday = new Date(weekStart(jan4).getTime() + (week - 1) * 7 * DAY)
  return weekId(monday) === id ? monday : null
}

export const weekEnd = (monday: Date) => new Date(monday.getTime() + 7 * DAY - 1)
export const prevWeek = (monday: Date) => new Date(monday.getTime() - 7 * DAY)
export const nextWeek = (monday: Date) => new Date(monday.getTime() + 7 * DAY)

export function weekLabel(monday: Date): string {
  const end = new Date(monday.getTime() + 6 * DAY)
  const f = (d: Date, y: boolean) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(y ? { year: 'numeric' } : {}), timeZone: 'UTC' })
  return `${f(monday, false)} to ${f(end, true)}`
}
