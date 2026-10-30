import { PERSON_GROUP_LABEL, type PersonGroup } from './person-groups'

/** How a touch went out. Calls and LinkedIn are always by hand; email is split by who pressed send. */
export type TouchChannel = 'email' | 'call' | 'linkedin' | 'text'
export type TouchMode = 'automated' | 'manual'

export interface Touch {
  at: Date
  channel: TouchChannel
  mode: TouchMode
  /** Where it came from, in plain words ("Cold outreach", "Mailing list", "Phone call"). */
  source: string
  group: PersonGroup
  personId: string | null
  responded: boolean
  /** Interested, or pointed us to someone. Emails only. */
  positive: boolean
  /** False when the time of day was never known (a call logged for an earlier day with no time). */
  hasTime: boolean
}

/** How a call went. Only "Connected" counts as a response. */
export const CALL_OUTCOMES = ['Connected', 'Voicemail', 'No answer', 'Wrong number'] as const

export const CHANNEL_LABEL: Record<TouchChannel, string> = { email: 'Email', call: 'Calls', linkedin: 'LinkedIn', text: 'Texts' }

const TZ = 'America/New_York'
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const
export { WEEKDAYS }

const parts = new Intl.DateTimeFormat('en-US', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23', weekday: 'short' })

/** Eastern-time calendar date, hour and weekday (0 = Monday) of an instant. */
export function easternParts(at: Date): { date: string; hour: number; weekday: number } {
  const p = Object.fromEntries(parts.formatToParts(at).map((x) => [x.type, x.value]))
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour), weekday: WEEKDAYS.indexOf(p.weekday as (typeof WEEKDAYS)[number]) }
}

/** The instant for a wall-clock date (YYYY-MM-DD) and time (HH:mm) in Eastern time; null when either is malformed. */
export function easternToUtc(date: string, time: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date), t = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time)
  if (!m || !t) return null
  const guess = Date.UTC(+m[1], +m[2] - 1, +m[3], +t[1], +t[2])
  for (const offset of [4, 5]) { // EDT, then EST
    const at = new Date(guess + offset * 3_600_000)
    const e = easternParts(at)
    if (e.date === date && e.hour === +t[1]) return at
  }
  return null
}

const addDays = (date: string, n: number) => new Date(Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10) + n)).toISOString().slice(0, 10)

/** The Monday (YYYY-MM-DD, Eastern) of the week an instant falls in. */
export function weekStart(at: Date): string {
  const { date, weekday } = easternParts(at)
  return addDays(date, -weekday)
}

/** The last `n` week starts, oldest first, ending with the week containing `now`. */
export function lastWeeks(now: Date, n: number): string[] {
  const cur = weekStart(now)
  return Array.from({ length: n }, (_, i) => addDays(cur, -7 * (n - 1 - i)))
}

export interface Tally { sent: number; responded: number; positive: number }
export const emptyTally = (): Tally => ({ sent: 0, responded: 0, positive: 0 })
function add(t: Tally, x: Touch) { t.sent++; if (x.responded) t.responded++; if (x.positive) t.positive++ }
export const rate = (t: Tally) => (t.sent ? t.responded / t.sent : 0)

/** Touches in a window: [from, to) by instant. */
export const within = (touches: Touch[], from: Date, to: Date) => touches.filter((t) => t.at >= from && t.at < to)

export interface WeekRow { week: string; automatedEmail: number; manualEmail: number; calls: number; linkedinText: number; total: number; responded: number }

export function byWeek(touches: Touch[], weeks: string[]): WeekRow[] {
  const rows = new Map<string, WeekRow>(weeks.map((w) => [w, { week: w, automatedEmail: 0, manualEmail: 0, calls: 0, linkedinText: 0, total: 0, responded: 0 }]))
  for (const t of touches) {
    const r = rows.get(weekStart(t.at))
    if (!r) continue
    if (t.channel === 'email') { if (t.mode === 'automated') r.automatedEmail++; else r.manualEmail++ }
    else if (t.channel === 'call') r.calls++
    else r.linkedinText++
    r.total++
    if (t.responded) r.responded++
  }
  return weeks.map((w) => rows.get(w)!)
}

export interface GroupRow {
  group: PersonGroup
  automatedEmail: number; manualEmail: number; calls: number; linkedinText: number
  all: Tally
}

export function byGroup(touches: Touch[]): GroupRow[] {
  const rows = new Map<PersonGroup, GroupRow>()
  for (const t of touches) {
    const r = rows.get(t.group) ?? { group: t.group, automatedEmail: 0, manualEmail: 0, calls: 0, linkedinText: 0, all: emptyTally() }
    if (t.channel === 'email') { if (t.mode === 'automated') r.automatedEmail++; else r.manualEmail++ }
    else if (t.channel === 'call') r.calls++
    else r.linkedinText++
    add(r.all, t)
    rows.set(t.group, r)
  }
  return [...rows.values()]
}

/** One row per channel and mode, so "what kind" reads as a short list. */
export function bySource(touches: Touch[]): { source: string; mode: TouchMode; tally: Tally }[] {
  const rows = new Map<string, { source: string; mode: TouchMode; tally: Tally }>()
  for (const t of touches) {
    const r = rows.get(t.source) ?? { source: t.source, mode: t.mode, tally: emptyTally() }
    add(r.tally, t)
    rows.set(t.source, r)
  }
  return [...rows.values()].sort((a, b) => b.tally.sent - a.tally.sent)
}

/** Touches with a known time, bucketed by Eastern hour (0 to 23) or weekday (0 = Monday). */
export function byHour(touches: Touch[]): Tally[] {
  const out = Array.from({ length: 24 }, emptyTally)
  for (const t of touches) if (t.hasTime) add(out[easternParts(t.at).hour], t)
  return out
}
export function byWeekday(touches: Touch[]): Tally[] {
  const out = Array.from({ length: 7 }, emptyTally)
  for (const t of touches) add(out[easternParts(t.at).weekday], t)
  return out
}

export interface QuotaRule { groupKey: PersonGroup | 'ALL'; channel: TouchChannel | 'ALL'; weeklyTarget: number }

export const QUOTA_CHANNEL_LABEL: Record<TouchChannel | 'ALL', string> = { ALL: 'All kinds', email: 'Email', call: 'Calls', linkedin: 'LinkedIn messages', text: 'Texts' }
export const quotaLabel = (q: Pick<QuotaRule, 'groupKey' | 'channel'>) =>
  `${q.groupKey === 'ALL' ? 'Everyone' : PERSON_GROUP_LABEL[q.groupKey]} · ${QUOTA_CHANNEL_LABEL[q.channel].toLowerCase()}`

export const quotaId = (q: Pick<QuotaRule, 'groupKey' | 'channel'>) => `${q.groupKey}:${q.channel}`

const matchesQuota = (t: Touch, q: QuotaRule) => (q.groupKey === 'ALL' || t.group === q.groupKey) && (q.channel === 'ALL' || t.channel === q.channel)

export interface QuotaProgress {
  rule: QuotaRule
  thisWeek: number
  /** Actual per week over the last weeks, oldest first, the current (unfinished) week last. */
  history: number[]
  /** Finished weeks (not the current one) that reached the target, out of those shown. */
  weeksHit: number
  weeksShown: number
}

export function quotaProgress(touches: Touch[], rules: QuotaRule[], weeks: string[]): QuotaProgress[] {
  return rules.map((rule) => {
    const counts = new Map(weeks.map((w) => [w, 0]))
    for (const t of touches) if (matchesQuota(t, rule)) { const w = weekStart(t.at); if (counts.has(w)) counts.set(w, counts.get(w)! + 1) }
    const history = weeks.map((w) => counts.get(w)!)
    const finished = history.slice(0, -1)
    return { rule, thisWeek: history[history.length - 1] ?? 0, history, weeksHit: finished.filter((n) => n >= rule.weeklyTarget).length, weeksShown: finished.length }
  })
}
