/** The pure rules of the layoff outreach backfill, kept apart from the database so they are tested on their own. */
export const BACKFILL_DAYS = 60
export const BACKFILL_MIN_EMPLOYEES = 50
/** A layoff announced this many days ago or less gets the standard email; older gets the continued-support wording. */
export const NEW_DAYS = 14
/** Layoffs drafted per click, so one request stays well inside the function time limit. */
export const BATCH = 15

export function modeForAge(noticeDate: Date, now: Date): 'new' | 'older' {
  return (now.getTime() - noticeDate.getTime()) / 86_400_000 <= NEW_DAYS ? 'new' : 'older'
}

/** The offset of America/New_York from UTC at an instant, in minutes (negative). */
function easternOffsetMinutes(at: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(at)
  const g = (t: string) => Number(parts.find((p) => p.type === t)!.value)
  const asUtc = Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute'))
  return Math.round((asUtc - Math.floor(at.getTime() / 60_000) * 60_000) / 60_000)
}

/** The next Monday 9:00 a.m. Eastern after `from` (a Monday before 9:00 counts as that day). */
export function releaseTime(from: Date): Date {
  for (let d = 0; d < 8; d++) {
    const probe = new Date(from.getTime() + d * 86_400_000)
    const ymd = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(probe).split('-').map(Number)
    const noonUtc = new Date(Date.UTC(ymd[0], ymd[1] - 1, ymd[2], 12))
    if (new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short' }).format(noonUtc) !== 'Mon') continue
    const offset = easternOffsetMinutes(noonUtc)
    const at = new Date(Date.UTC(ymd[0], ymd[1] - 1, ymd[2], 9, 0) - offset * 60_000)
    if (at.getTime() > from.getTime()) return at
  }
  throw new Error('no Monday found')
}

/**
 * The deploy-time marks that kept the layoffs filed before the live outreach started from being mailed live (outreachCheckedAt set at
 * 2026-11-13 03:08 UTC). The backfill is the owner-approved way to reach them, so a mark made before this moment does not hide a layoff
 * from it; a mark made after (the sweep looked, or the backfill found nobody) still does.
 */
export const SUPPRESSION_MARK_BEFORE = new Date('2026-11-13T03:08:00Z')

/** Most emails one send day takes (the layoff window is 8 a.m. to noon Eastern, 500 an hour, shared with the other mailings). */
export const DAY_MAX_RECIPIENTS = 1200

/** The nine-o'clock-Eastern instants of the four days (Monday to Thursday) of the week that starts on `monday` (a Date inside that Monday). */
export function weekSendTimes(monday: Date, days = 4): Date[] {
  const out: Date[] = []
  for (let d = 0; d < days; d++) {
    const probe = new Date(monday.getTime() + d * 86_400_000)
    const ymd = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(probe).split('-').map(Number)
    const noonUtc = new Date(Date.UTC(ymd[0], ymd[1] - 1, ymd[2], 12))
    out.push(new Date(Date.UTC(ymd[0], ymd[1] - 1, ymd[2], 9, 0) - easternOffsetMinutes(noonUtc) * 60_000))
  }
  return out
}

/** Which day (0-based) each edition goes on: biggest first, each to the day with the fewest recipients so far. Stable for equal sizes. */
export function assignDays(editions: { id: string; recipients: number }[], days = 4): Map<string, number> {
  const load = new Array<number>(days).fill(0)
  const out = new Map<string, number>()
  for (const e of [...editions].sort((a, b) => b.recipients - a.recipients || a.id.localeCompare(b.id))) {
    let best = 0
    for (let d = 1; d < days; d++) if (load[d] < load[best]) best = d
    out.set(e.id, best)
    load[best] += e.recipients
  }
  return out
}

/** The two headline styles each day tests, against each other within that day (so the day of the week is the same for both). */
export const HEADLINE_DAYS: readonly (readonly [string, string])[] = [['n1', 'q1'], ['loc', 'pg'], ['aud', 'quick'], ['plain', 'num2']]

/** Within one day, alternate the two arms by audience so each audience is split evenly. */
export function assignArms(items: { id: string; audience: string }[], day: number): Map<string, string> {
  const pair = HEADLINE_DAYS[day % HEADLINE_DAYS.length]
  const seen = new Map<string, number>()
  const out = new Map<string, string>()
  for (const it of [...items].sort((a, b) => a.audience.localeCompare(b.audience) || a.id.localeCompare(b.id))) {
    const i = seen.get(it.audience) ?? 0
    out.set(it.id, pair[i % 2])
    seen.set(it.audience, i + 1)
  }
  return out
}

/** The nine-o'clock-Eastern instants of `count` weekdays from the Monday `monday` falls on (weekends skipped). */
export function businessDayTimes(monday: Date, count: number): Date[] {
  const out: Date[] = []
  for (let d = 0; out.length < count && d < count * 3; d++) {
    const probe = new Date(monday.getTime() + d * 86_400_000)
    const noonUtc = (() => { const ymd = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(probe).split('-').map(Number); return new Date(Date.UTC(ymd[0], ymd[1] - 1, ymd[2], 12)) })()
    if (['Sat', 'Sun'].includes(new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short' }).format(noonUtc))) continue
    out.push(weekSendTimes(probe, 1)[0])
  }
  return out
}

/** Fills the days in order: the best editions first, each day up to its cap (one edition larger than a day still goes whole). Returns the day of each edition. */
export function assignDaysByCap(editions: { id: string; recipients: number }[], caps: readonly number[]): Map<string, number> {
  const out = new Map<string, number>()
  let day = 0
  let load = 0
  for (const e of editions) {
    while (load > 0 && load + e.recipients > caps[Math.min(day, caps.length - 1)]) { day++; load = 0 }
    out.set(e.id, day)
    load += e.recipients
  }
  return out
}
