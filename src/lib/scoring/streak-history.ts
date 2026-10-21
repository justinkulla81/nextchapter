// When a member first reached an N-week streak of meeting their weekly goal, read from
// their whole WeeklySprint history. Same rule as computeCurrentSprintStreak (effort.ts):
// a week counts once at least 30% of its committed actions are done, and weeks must be
// back to back. Used to backfill permanent Candidate+ for members who earned it by streak.

export const STREAK_WEEK_COMPLETION_THRESHOLD = 0.3
const DAY_MS = 86_400_000

type Sprint = { weekStartDate: Date; committedActions: unknown }

function weekMet(s: Sprint): boolean {
  const actions = (s.committedActions as Array<{ completed?: boolean }> | null) ?? []
  return actions.length > 0 && actions.filter((a) => a.completed).length / actions.length >= STREAK_WEEK_COMPLETION_THRESHOLD
}

/** The end of the week in which the streak first reached `weeks`, or null if it never did. */
export function firstStreakReachedAt(sprints: Sprint[], weeks: number): Date | null {
  const sorted = [...sprints].sort((a, b) => a.weekStartDate.getTime() - b.weekStartDate.getTime())
  let run = 0
  let prev: Date | null = null
  for (const s of sorted) {
    // Back to back: 7 days apart, give or take a daylight-saving hour.
    const consecutive = prev !== null && Math.round((s.weekStartDate.getTime() - prev.getTime()) / DAY_MS) === 7
    run = weekMet(s) ? (consecutive ? run + 1 : 1) : 0
    prev = s.weekStartDate
    if (run >= weeks) return new Date(s.weekStartDate.getTime() + 7 * DAY_MS)
  }
  return null
}
