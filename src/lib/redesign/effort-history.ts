// Effort and results in the redesign: the minutes of real search work per week, and the plain sentence
// that says what the member's best week was. One point is one minute. Pure, so it is tested without a database.

export interface SprintLike {
  weekStartDate: Date
  committedActions: unknown
}

export interface WeekEffort {
  weekStart: Date
  minutes: number
}

/** Minutes of completed work in one sprint's committed actions. Anything malformed counts as zero. */
export function minutesInSprint(committedActions: unknown): number {
  if (!Array.isArray(committedActions)) return 0
  let total = 0
  for (const a of committedActions) {
    if (!a || typeof a !== 'object') continue
    const { completed, points } = a as { completed?: unknown; points?: unknown }
    if (completed === true && typeof points === 'number' && Number.isFinite(points) && points > 0) total += points
  }
  return Math.round(total)
}

/** Oldest first, at most `limit` of the most recent weeks. */
export function weeklyEffort(sprints: SprintLike[], limit = 12): WeekEffort[] {
  return [...sprints]
    .sort((a, b) => a.weekStartDate.getTime() - b.weekStartDate.getTime())
    .slice(-limit)
    .map((s) => ({ weekStart: s.weekStartDate, minutes: minutesInSprint(s.committedActions) }))
}

/** "Your best week was the week of Oct 5, at 140 minutes." Null until there is a week with work in it. */
export function bestWeekSentence(weeks: WeekEffort[]): string | null {
  let best = -1
  weeks.forEach((w, i) => {
    if (w.minutes > 0 && (best === -1 || w.minutes >= weeks[best].minutes)) best = i
  })
  if (best === -1) return null
  const isLatest = best === weeks.length - 1 && weeks.length > 1
  const when = weeks[best].weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
  return isLatest ? `This is your best week so far, at ${weeks[best].minutes} minutes.` : `Your best week was the week of ${when}, at ${weeks[best].minutes} minutes.`
}

/** Bar heights as whole percents of the tallest week, with a floor so a small week is still visible. */
export function barHeights(weeks: WeekEffort[]): number[] {
  const max = Math.max(0, ...weeks.map((w) => w.minutes))
  if (max === 0) return weeks.map(() => 0)
  return weeks.map((w) => (w.minutes === 0 ? 0 : Math.max(8, Math.round((w.minutes / max) * 100))))
}
