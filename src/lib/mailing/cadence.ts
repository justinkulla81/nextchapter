import type { MailingCadence } from '@prisma/client'

/** Pure period maths for list cadences. Everything is in New York time. */

export const CADENCES: { value: MailingCadence; label: string }[] = [
  { value: 'DAILY', label: 'Daily' },
  { value: 'WEEKDAYS', label: 'Weekdays' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'QUARTERLY', label: 'Quarterly' },
  { value: 'ANNUALLY', label: 'Annually' },
  { value: 'AD_HOC', label: 'Ad hoc' },
]

export const CADENCE_LABEL = Object.fromEntries(CADENCES.map((c) => [c.value, c.label])) as Record<MailingCadence, string>

export function isCadence(v: string): v is MailingCadence {
  return CADENCES.some((c) => c.value === v)
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function nyParts(d: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', year: 'numeric', month: 'numeric', day: 'numeric', weekday: 'short',
  }).formatToParts(d)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'))
  return { year: Number(get('year')), month: Number(get('month')), day: Number(get('day')), weekday }
}

export interface Period {
  /** Stable id for the period: '2026-10-07', '2026-10', '2026-Q4', '2026'. */
  key: string
  /** For titles and subjects: 'Tuesday, October 7', 'October 2026', 'Q4 2026'. */
  label: string
}

/**
 * The period `at` falls in for a cadence, or null when nothing is due —
 * ad hoc lists never are, and weekday lists skip Saturday and Sunday.
 */
export function periodFor(cadence: MailingCadence, at: Date): Period | null {
  const { year, month, day, weekday } = nyParts(at)
  const mm = String(month).padStart(2, '0')
  const dd = String(day).padStart(2, '0')
  switch (cadence) {
    case 'WEEKDAYS':
      if (weekday === 0 || weekday === 6) return null
    // falls through
    case 'DAILY':
      return { key: `${year}-${mm}-${dd}`, label: `${DAYS[weekday]}, ${MONTHS[month - 1]} ${day}` }
    case 'MONTHLY':
      return { key: `${year}-${mm}`, label: `${MONTHS[month - 1]} ${year}` }
    case 'QUARTERLY': {
      const q = Math.ceil(month / 3)
      return { key: `${year}-Q${q}`, label: `Q${q} ${year}` }
    }
    case 'ANNUALLY':
      return { key: `${year}`, label: `${year}` }
    default:
      return null
  }
}

/** Whether `at` lands in the same period as `now` for this cadence. */
export function samePeriod(cadence: MailingCadence, at: Date, now: Date): boolean {
  const a = periodFor(cadence === 'WEEKDAYS' ? 'DAILY' : cadence, at)
  const b = periodFor(cadence === 'WEEKDAYS' ? 'DAILY' : cadence, now)
  return !!a && !!b && a.key === b.key
}
