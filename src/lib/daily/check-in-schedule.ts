// When the app-open check-in pop-up shows and what it asks. Pure functions
// (no database), so the rules are testable; check-in-prompt.ts feeds them.

export type CheckInKind = 'MOOD' | 'APPLY_COMMIT' | 'NETWORK_COMMIT'

const DAY = 24 * 60 * 60 * 1000
const startOfUTCDay = (d: Date) => { const c = new Date(d); c.setUTCHours(0, 0, 0, 0); return c.getTime() }

export const MAX_PROMPTS_PER_WEEK = 3

/**
 * Due when it hasn't shown today or yesterday (never two days running) and
 * has shown fewer than 3 times in the last 7 days.
 */
export function isPromptDue(shownAt: Date[], now: Date = new Date()): boolean {
  const today = startOfUTCDay(now)
  if (shownAt.some((d) => startOfUTCDay(d) >= today - DAY)) return false
  return shownAt.filter((d) => d.getTime() > now.getTime() - 7 * DAY).length < MAX_PROMPTS_PER_WEEK
}

/** Weekdays left in the week, today included (at least 1, so weekends ask for a small number). */
export function weekdaysLeft(now: Date = new Date()): number {
  const day = now.getUTCDay() // 0 Sun … 6 Sat
  if (day === 0 || day === 6) return 1
  return 6 - day // Mon → 5 … Fri → 1
}

/** How many applications to ask for today: the rest of the weekly goal spread over the weekdays left, 1–5. */
export function applicationsToAsk(appliedThisWeek: number, weeklyGoal: number, now: Date = new Date()): number {
  const remaining = Math.max(weeklyGoal - appliedThisWeek, 0)
  return Math.min(5, Math.max(1, Math.ceil(remaining / weekdaysLeft(now))))
}

/**
 * Which question to ask. A commitment the candidate is behind on comes
 * first; the mood question only when there's been no check-in this week (it
 * also earns the weekly check-in points). Among the eligible kinds, the one
 * asked least recently wins, so the questions rotate.
 */
export function chooseCheckInKind(args: {
  appliedThisWeek: number
  weeklyGoal: number
  checkedInThisWeek: boolean
  lastShownByKind: Partial<Record<CheckInKind, Date>>
}): CheckInKind {
  const eligible: CheckInKind[] = []
  if (args.appliedThisWeek < args.weeklyGoal) eligible.push('APPLY_COMMIT')
  eligible.push('NETWORK_COMMIT')
  if (!args.checkedInThisWeek) eligible.push('MOOD')
  return eligible.sort((a, b) => (args.lastShownByKind[a]?.getTime() ?? 0) - (args.lastShownByKind[b]?.getTime() ?? 0))[0]
}
