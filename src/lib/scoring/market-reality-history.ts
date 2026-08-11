import 'server-only'
import { prisma } from '@/lib/prisma'
import { GRADE_VALUE, type CategoryGrade, type CategoryKey } from '@/lib/scoring/grade'

// Everything here derives "what moved," "best week," and streaks straight
// from real archived data (MarketRealitySnapshot.dimensions, WeeklySprint,
// WeeklyBadgeEarned) — never a fabricated causal story. See spec §9.3: the
// mockup's "you narrowed your target from three functions to one" ties a
// grade movement to a specific real-world action, but there's no field-
// level change history to attribute that honestly from, so "what moved"
// here reports the real grade movement only (category + direction +
// from/to grade), not an invented cause.

export interface MarketRealitySnapshotLike {
  weekStartDate: Date
  dimensions: unknown
}

function parseCategories(snapshot: MarketRealitySnapshotLike): CategoryGrade[] {
  return snapshot.dimensions as unknown as CategoryGrade[]
}

function averageScore(snapshot: MarketRealitySnapshotLike): number {
  const categories = parseCategories(snapshot)
  if (categories.length === 0) return 0
  return categories.reduce((sum, c) => sum + c.score, 0) / categories.length
}

// Per-category score series, oldest to newest, for sparklines — snapshots
// must already be sorted oldest-to-newest.
export function getCategoryScoreHistory(snapshots: MarketRealitySnapshotLike[], key: CategoryKey): number[] {
  return snapshots
    .map((s) => parseCategories(s).find((c) => c.key === key)?.score)
    .filter((score): score is number => score !== undefined)
}

const ORDINAL_SUFFIX = (n: number): string => {
  if (n % 10 === 1 && n % 100 !== 11) return `${n}st`
  if (n % 10 === 2 && n % 100 !== 12) return `${n}nd`
  if (n % 10 === 3 && n % 100 !== 13) return `${n}rd`
  return `${n}th`
}

// One true sentence, or null if none of the real patterns apply — never a
// filler sentence. Snapshots must be sorted oldest to newest.
export function computeBestWeekSentence(snapshots: MarketRealitySnapshotLike[]): string | null {
  if (snapshots.length < 2) return null
  const scores = snapshots.map(averageScore)
  const latest = scores[scores.length - 1]

  if (latest >= Math.max(...scores)) {
    return 'Best week since you started.'
  }

  let upStreak = 1
  for (let i = scores.length - 1; i > 0; i--) {
    if (scores[i] > scores[i - 1]) upStreak++
    else break
  }
  if (upStreak >= 3) return `${ORDINAL_SUFFIX(upStreak)} straight week up.`

  let flatStreak = 1
  for (let i = scores.length - 1; i > 0; i--) {
    if (scores[i] === scores[i - 1]) flatStreak++
    else break
  }
  if (flatStreak >= 4) return `Flat for ${flatStreak} weeks.`

  return null
}

export interface CategoryMover {
  key: CategoryKey
  label: string
  direction: 'up' | 'down'
  fromGrade: CategoryGrade['grade']
  toGrade: CategoryGrade['grade']
}

// Up to 3 categories whose letter grade changed since last week, biggest
// movers first. Snapshots must be sorted oldest to newest.
export function computeWhatMovedThisWeek(snapshots: MarketRealitySnapshotLike[]): CategoryMover[] {
  if (snapshots.length < 2) return []
  const prev = parseCategories(snapshots[snapshots.length - 2])
  const curr = parseCategories(snapshots[snapshots.length - 1])
  const prevByKey = new Map(prev.map((c) => [c.key, c]))

  const movers: CategoryMover[] = []
  for (const c of curr) {
    const p = prevByKey.get(c.key)
    if (!p || p.grade === c.grade) continue
    movers.push({
      key: c.key,
      label: c.label,
      direction: GRADE_VALUE[c.grade] > GRADE_VALUE[p.grade] ? 'up' : 'down',
      fromGrade: p.grade,
      toGrade: c.grade,
    })
  }

  movers.sort(
    (a, b) =>
      Math.abs(GRADE_VALUE[b.toGrade] - GRADE_VALUE[b.fromGrade]) -
      Math.abs(GRADE_VALUE[a.toGrade] - GRADE_VALUE[a.fromGrade])
  )
  return movers.slice(0, 3)
}

// Consecutive weeks (most recent backward) where the average score rose
// vs. the week before. Snapshots must be sorted oldest to newest.
export function computeWeeksOfImprovement(snapshots: MarketRealitySnapshotLike[]): number {
  if (snapshots.length < 2) return 0
  const scores = snapshots.map(averageScore)
  let streak = 0
  for (let i = scores.length - 1; i > 0; i--) {
    if (scores[i] > scores[i - 1]) streak++
    else break
  }
  return streak
}

export interface SprintCompletionStreaks {
  currentStreak: number
  longestStreak: number
}

// "Weeks of consecutive Sprint completion" — walks every week the
// candidate has had a Weekly Sprint at all (so a gap week breaks the
// streak, not just a missed target), checking which ones earned
// WEEKLY_SPRINT_TARGET_HIT. Real data only; no such reusable streak
// existed before this (computeOverDeliveringStreak in milestone-badges.ts
// tracks a different bar — beating the points target — not just hitting
// it, and only reports the current streak, not the longest).
export async function computeSprintCompletionStreaks(candidateId: string): Promise<SprintCompletionStreaks> {
  const [sprintWeeks, hitWeeks] = await Promise.all([
    prisma.weeklySprint.findMany({
      where: { candidateId },
      select: { weekStartDate: true },
      orderBy: { weekStartDate: 'asc' },
    }),
    prisma.weeklyBadgeEarned.findMany({
      where: { candidateId, badgeKey: 'WEEKLY_SPRINT_TARGET_HIT' },
      select: { weekStartDate: true },
    }),
  ])

  const hitSet = new Set(hitWeeks.map((w) => w.weekStartDate.getTime()))
  const hits = sprintWeeks.map((w) => hitSet.has(w.weekStartDate.getTime()))

  let longestStreak = 0
  let running = 0
  for (const hit of hits) {
    running = hit ? running + 1 : 0
    longestStreak = Math.max(longestStreak, running)
  }

  let currentStreak = 0
  for (let i = hits.length - 1; i >= 0; i--) {
    if (!hits[i]) break
    currentStreak++
  }

  return { currentStreak, longestStreak }
}
