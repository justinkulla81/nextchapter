// Review-cycle date windows. Pure: every function takes `now` and the member's
// settings and returns dates, so the cron and the workspace share one answer.
//
// Model:
//  - A member has a cadence (twice a year by default) and a first review month
//    ("anchor"). With no anchor the default is February, so February and August.
//  - A review WINDOW is the 15th through the end of that month, unless the
//    member gave an exact date, in which case the window is that one day.
//  - PREPARE goes out 21 days before the window starts. For the default
//    February and August windows that lands on January 25 and July 25.
//  - RESPOND goes out 5 to 7 days after the window ends.
//
// All math is in UTC calendar days.

import type { ReviewCadence } from './constants'

export const DEFAULT_ANCHOR_MONTH = 2
export const WINDOW_START_DAY = 15
export const PREPARE_LEAD_DAYS = 21
// Stop offering PREPARE this many days before the window opens: a prep email
// a few days out is noise, not help.
export const PREPARE_CUTOFF_DAYS = 7
export const RESPOND_LAG_DAYS = 5
export const RESPOND_WINDOW_DAYS = 2 // eligible 5, 6 and 7 days after the window
// Do not send the same kind twice within this many days, even if the member
// changed their dates and produced a new cycle key.
export const SAME_KIND_COOLDOWN_DAYS = 60

export type ReviewScheduleInput = {
  cadence: ReviewCadence
  anchorMonth: number | null
  nextReviewDate: Date | null
}

export type ReviewCycle = {
  key: string // "YYYY-MM" of the window start
  windowStart: Date
  windowEnd: Date
  prepareOn: Date
  respondOn: Date
  exact: boolean // true when the member gave this date
}

export type OutreachKind = 'PREPARE' | 'RESPOND'

export type OutreachDecision = { kind: OutreachKind; cycle: ReviewCycle }

const DAY_MS = 86_400_000

export function utcDay(year: number, monthIndex: number, day: number): Date {
  return new Date(Date.UTC(year, monthIndex, day))
}

export function startOfUtcDay(d: Date): Date {
  return utcDay(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
}

export function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * DAY_MS)
}

function lastDayOfMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate()
}

export function cycleKeyFor(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

export function validMonth(m: number | null | undefined): m is number {
  return typeof m === 'number' && Number.isInteger(m) && m >= 1 && m <= 12
}

// The 1-12 review months implied by a cadence and its first month.
export function monthsForCadence(cadence: ReviewCadence, anchorMonth: number | null): number[] {
  const anchor = validMonth(anchorMonth) ? anchorMonth : DEFAULT_ANCHOR_MONTH
  const step = cadence === 'ANNUAL' ? 12 : cadence === 'QUARTERLY' ? 3 : 6
  const months: number[] = []
  for (let m = anchor; m < anchor + 12; m += step) months.push(((m - 1) % 12) + 1)
  return months.sort((a, b) => a - b)
}

function cycleFromWindow(windowStart: Date, windowEnd: Date, exact: boolean): ReviewCycle {
  return {
    key: cycleKeyFor(windowStart),
    windowStart,
    windowEnd,
    prepareOn: addDays(windowStart, -PREPARE_LEAD_DAYS),
    respondOn: addDays(windowEnd, RESPOND_LAG_DAYS),
    exact,
  }
}

// Every cycle with a window in the given calendar year.
export function buildCyclesForYear(input: ReviewScheduleInput, year: number): ReviewCycle[] {
  const byKey = new Map<string, ReviewCycle>()
  for (const month of monthsForCadence(input.cadence, input.anchorMonth)) {
    const start = utcDay(year, month - 1, WINDOW_START_DAY)
    const end = utcDay(year, month - 1, lastDayOfMonth(year, month - 1))
    const c = cycleFromWindow(start, end, false)
    byKey.set(c.key, c)
  }
  // An exact date replaces the month-based window for its month.
  if (input.nextReviewDate) {
    const d = startOfUtcDay(input.nextReviewDate)
    if (d.getUTCFullYear() === year) {
      const c = cycleFromWindow(d, d, true)
      for (const [k, v] of byKey) {
        if (k.slice(0, 7) === c.key.slice(0, 7) && !v.exact) byKey.delete(k)
      }
      byKey.set(c.key, c)
    }
  }
  return [...byKey.values()].sort((a, b) => a.windowStart.getTime() - b.windowStart.getTime())
}

// Cycles from last year through next year, so a December window's RESPOND
// date in January is never missed.
export function buildCycles(input: ReviewScheduleInput, now: Date): ReviewCycle[] {
  const y = now.getUTCFullYear()
  return [y - 1, y, y + 1].flatMap((year) => buildCyclesForYear(input, year))
}

// The cycle the member is in or heading to: the first whose window has not
// yet ended, so a window in progress still counts.
export function nextCycle(input: ReviewScheduleInput, now: Date): ReviewCycle | null {
  const today = startOfUtcDay(now)
  return buildCycles(input, now).find((c) => c.windowEnd.getTime() >= today.getTime()) ?? null
}

// The most recent cycle whose window has ended, for "how did it go?".
export function lastCycle(input: ReviewScheduleInput, now: Date): ReviewCycle | null {
  const today = startOfUtcDay(now)
  const past = buildCycles(input, now).filter((c) => c.windowEnd.getTime() < today.getTime())
  return past[past.length - 1] ?? null
}

export function daysUntil(target: Date, now: Date): number {
  return Math.round((startOfUtcDay(target).getTime() - startOfUtcDay(now).getTime()) / DAY_MS)
}

export type SentRecord = { cycleKey: string; kind: OutreachKind; sentAt: Date }

// What, if anything, to email this member today. Returns at most one decision.
//  - `sent`: prior sends for this member (any cycle).
//  - `outcomeCycleKeys`: cycles where the member already logged an outcome
//    (no point asking how it went).
export function decideOutreach(
  input: ReviewScheduleInput,
  now: Date,
  sent: SentRecord[],
  outcomeCycleKeys: ReadonlySet<string> = new Set(),
): OutreachDecision | null {
  const today = startOfUtcDay(now).getTime()
  const cycles = buildCycles(input, now)
  const alreadySent = (key: string, kind: OutreachKind) => sent.some((s) => s.cycleKey === key && s.kind === kind)
  const inCooldown = (kind: OutreachKind) =>
    sent.some((s) => s.kind === kind && now.getTime() - s.sentAt.getTime() < SAME_KIND_COOLDOWN_DAYS * DAY_MS)

  // RESPOND first: it is time sensitive and the answer is the most useful email.
  for (const c of cycles) {
    const from = startOfUtcDay(c.respondOn).getTime()
    const to = from + RESPOND_WINDOW_DAYS * DAY_MS
    if (today >= from && today <= to && !alreadySent(c.key, 'RESPOND') && !outcomeCycleKeys.has(c.key) && !inCooldown('RESPOND')) {
      return { kind: 'RESPOND', cycle: c }
    }
  }
  for (const c of cycles) {
    const from = startOfUtcDay(c.prepareOn).getTime()
    const until = startOfUtcDay(c.windowStart).getTime() - PREPARE_CUTOFF_DAYS * DAY_MS
    if (today >= from && today < until && !alreadySent(c.key, 'PREPARE') && !inCooldown('PREPARE')) {
      return { kind: 'PREPARE', cycle: c }
    }
  }
  return null
}

// "Early February", "Mid August": a plain label for a cycle in the UI.
export function describeWindow(c: ReviewCycle): string {
  const month = c.windowStart.toLocaleString('en-US', { month: 'long', timeZone: 'UTC' })
  if (c.exact) return `${month} ${c.windowStart.getUTCDate()}, ${c.windowStart.getUTCFullYear()}`
  return `Second half of ${month} ${c.windowStart.getUTCFullYear()}`
}
