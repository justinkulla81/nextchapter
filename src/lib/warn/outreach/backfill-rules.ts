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
