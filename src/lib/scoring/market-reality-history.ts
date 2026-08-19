import 'server-only'
import { prisma } from '@/lib/prisma'
import { GRADE_VALUE, type Grade } from '@/lib/scoring/grade'

// Everything here derives "what moved," "best week," and streaks straight
// from real archived data (MarketRealitySnapshot.grade, WeeklySprint,
// WeeklyBadgeEarned) — never a fabricated causal story. See spec §9.3: the
// mockup's "you narrowed your target from three functions to one" ties a
// grade movement to a specific real-world action, but there's no field-
// level change history to attribute that honestly from, so "what moved"
// here reports the real grade movement only (direction + from/to grade),
// not an invented cause.
//
// Used to compute off the six-category MarketRealitySnapshot.dimensions
// array — that field has been written as an empty array since the Market
// Reality Grade became a single composite score (see
// generateMarketRealitySnapshot in market-reality-snapshot.ts), so every
// function below now reads the one grade the snapshot always carries
// instead.

export interface MarketRealitySnapshotLike {
  weekStartDate: Date
  grade: string
}

function gradeScore(snapshot: MarketRealitySnapshotLike): number {
  return GRADE_VALUE[snapshot.grade as Grade] ?? 0
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
  const scores = snapshots.map(gradeScore)
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

export interface GradeMovement {
  direction: 'up' | 'down'
  fromGrade: Grade
  toGrade: Grade
}

// Whether (and how) the single Market Reality Grade moved since the prior
// snapshot — replaces the old per-category "what moved this week" list now
// that there's one grade, not six. Snapshots must be sorted oldest to newest.
export function computeGradeMovement(snapshots: MarketRealitySnapshotLike[]): GradeMovement | null {
  if (snapshots.length < 2) return null
  const fromGrade = snapshots[snapshots.length - 2].grade as Grade
  const toGrade = snapshots[snapshots.length - 1].grade as Grade
  if (fromGrade === toGrade) return null
  return { direction: GRADE_VALUE[toGrade] > GRADE_VALUE[fromGrade] ? 'up' : 'down', fromGrade, toGrade }
}

// Consecutive weeks (most recent backward) where the grade rose vs. the
// week before. Snapshots must be sorted oldest to newest.
export function computeWeeksOfImprovement(snapshots: MarketRealitySnapshotLike[]): number {
  if (snapshots.length < 2) return 0
  const scores = snapshots.map(gradeScore)
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

export interface AGradeWeekCount {
  aWeeks: number
  totalWeeks: number
}

// Full-history count of closed-out weeks graded A vs. total closed-out
// weeks — powers the Dossier's "How I Operate" grit/consistency stat
// (dossier-sections.ts), paired with milestone-badges.ts's
// countOverDeliveringWeeks.
export async function countAGradeWeeks(candidateId: string): Promise<AGradeWeekCount> {
  const rows = await prisma.marketRealitySnapshot.findMany({
    where: { candidateId },
    select: { grade: true },
  })
  return {
    aWeeks: rows.filter((r) => r.grade === 'A').length,
    totalWeeks: rows.length,
  }
}
