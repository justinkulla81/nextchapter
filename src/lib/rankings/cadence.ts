// How often each ranking is published. The best places for white-collar professionals is quarterly: most of its score comes from
// public data published once a year, so monthly editions would move on job-board noise. Every other ranking is monthly. Pure.
import type { BuildGroup } from '@/lib/rankings/types'

export const QUARTERLY_GROUPS: ReadonlySet<BuildGroup> = new Set(['metro'])
/** Months a quarterly edition is published in (January, April, July, October). */
export const QUARTER_MONTHS = [1, 4, 7, 10]

export const isQuarterlyMeasure = (measure: string) => measure.startsWith('wp_')



/** Whether the scheduled monthly run builds this group in the month of `now`. */
export const builtThisMonth = (group: BuildGroup, now: Date) => !QUARTERLY_GROUPS.has(group) || QUARTER_MONTHS.includes(now.getUTCMonth() + 1)

/**
 * The edition a build writes: the month of `now`, except that a quarterly group rebuilt between quarters (a method fix) rewrites
 * its current edition instead of starting a new one.
 */
export function editionFor(group: BuildGroup, now: Date, current: string | null): string {
  const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
  if (!QUARTERLY_GROUPS.has(group) || QUARTER_MONTHS.includes(now.getUTCMonth() + 1) || !current) return month
  return current
}

/** "Q1 2027" for a quarterly edition published in a quarter's first month, else "November 2026". */
export function editionName(edition: string, quarterly: boolean): string {
  const [y, m] = edition.split('-').map(Number)
  if (quarterly && QUARTER_MONTHS.includes(m)) return `Q${(m - 1) / 3 + 1} ${y}`
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

/** When the next edition is published: the 2nd of the next month, or of the next quarter's first month. */
export function nextEditionDate(edition: string, quarterly: boolean): string {
  const [y, m] = edition.split('-').map(Number)
  let next = m + 1
  if (quarterly) while (!QUARTER_MONTHS.includes(((next - 1) % 12) + 1)) next++
  return new Date(Date.UTC(y, next - 1, 2)).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}


