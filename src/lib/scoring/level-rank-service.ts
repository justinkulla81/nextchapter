import 'server-only'
import type { CandidateProfile, WorkHistoryEntry } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { selectDisplayedWorkHistory } from '@/lib/work-history/sanitize'
import { inferLevelFromTitle } from '@/lib/jobs/infer-job-function'
import { resolveCompanySizeBand } from '@/lib/market/company-size'
import { calibratedLevelRank, scoreToLevelRankLabel } from '@/lib/scoring/level-rank'

const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000
const RECENCY_HALF_LIFE_YEARS = 5
const RECENCY_WEIGHT_FLOOR = 0.1
const TENURE_WEIGHT_FLOOR = 0.25
const TENURE_WEIGHT_CAP = 1.5

export interface LevelRankResult {
  score: number | null
  label: string | null
}

// A non-current entry with no logged endDate has a genuinely unknown
// tenure — falling back to `now` (the old behavior) treated "we don't know
// when it ended" as "it ended today," handing an old, incompletely-filled-in
// role the same max recency/tenure weight as one ending right now. This was
// a live bug, not hypothetical: a real candidate's decade-old IC roles with
// missing end dates were outweighing their genuinely current senior titles
// in the blend. startDate is the conservative fallback — it can only ever
// understate an unknown tenure, never overstate it.
function effectiveEnd(entry: WorkHistoryEntry, now: Date): Date {
  if (entry.isCurrent) return now
  return entry.endDate ?? entry.startDate
}

function recencyWeight(entry: WorkHistoryEntry, now: Date): number {
  if (entry.isCurrent) return 1
  const end = effectiveEnd(entry, now)
  const yearsSinceEnd = Math.max(0, (now.getTime() - end.getTime()) / MS_PER_YEAR)
  return Math.max(RECENCY_WEIGHT_FLOOR, Math.pow(0.5, yearsSinceEnd / RECENCY_HALF_LIFE_YEARS))
}

function tenureWeight(entry: WorkHistoryEntry, now: Date): number {
  const end = effectiveEnd(entry, now)
  const tenureMonths = Math.max(0, (end.getTime() - entry.startDate.getTime()) / (MS_PER_YEAR / 12))
  return Math.min(TENURE_WEIGHT_CAP, Math.max(TENURE_WEIGHT_FLOOR, tenureMonths / 12))
}

// Blends a candidate's work history into a single calibrated score: each
// qualifying entry's title-derived level is adjusted by its company's
// resolved size band, then weighted by recency (5-year half-life) and
// tenure (floored/capped) before averaging. The most recent entry uses the
// candidate's own confirmed highestLevelReached (a stronger signal than a
// title-keyword guess for their current/most recent standing); every other
// entry falls back to inferLevelFromTitle. Falls back to title-only
// (anchor band, no size adjustment) when there's no work history on file,
// and to null (never fabricated) when there's no level signal at all.
async function computeLevelRankLive(
  candidate: Pick<CandidateProfile, 'id' | 'highestLevelReached'>,
  rawWorkHistory: WorkHistoryEntry[]
): Promise<LevelRankResult> {
  const qualifying = rawWorkHistory.filter((e) => e.engagementType !== 'INTERNSHIP')
  const entries = selectDisplayedWorkHistory(qualifying)

  if (entries.length === 0) {
    const score = calibratedLevelRank(candidate.highestLevelReached, null)
    return { score, label: scoreToLevelRankLabel(score) }
  }

  const now = new Date()
  const mostRecentId = [...entries].sort((a, b) => b.startDate.getTime() - a.startDate.getTime())[0].id

  let weightedSum = 0
  let totalWeight = 0
  for (const entry of entries) {
    const entryLevel =
      entry.id === mostRecentId && candidate.highestLevelReached
        ? candidate.highestLevelReached
        : inferLevelFromTitle(entry.roleTitle)
    const { band } = await resolveCompanySizeBand(entry.companyName)
    const entryScore = calibratedLevelRank(entryLevel, band)
    if (entryScore === null) continue

    const weight = recencyWeight(entry, now) * tenureWeight(entry, now)
    weightedSum += entryScore * weight
    totalWeight += weight
  }

  if (totalWeight === 0) {
    const score = calibratedLevelRank(candidate.highestLevelReached, null)
    return { score, label: scoreToLevelRankLabel(score) }
  }

  const score = Math.max(1, Math.min(100, Math.round(weightedSum / totalWeight)))
  return { score, label: scoreToLevelRankLabel(score) }
}

// Lazy-backfill read — mirrors getCategoryBaseline() in dossier-competencies.ts:
// returns the persisted baseline if one exists, otherwise computes it live
// once and persists it. Never recomputes on a read once a value exists —
// safe to call from any ordinary page render or matching query.
export async function getCandidateLevelRank(candidateId: string): Promise<LevelRankResult> {
  const candidate = await prisma.candidateProfile.findUniqueOrThrow({
    where: { id: candidateId },
    include: { workHistory: true },
  })
  if (candidate.levelRankUpdatedAt !== null) {
    return { score: candidate.levelRankScore, label: candidate.levelRankLabel }
  }

  const result = await computeLevelRankLive(candidate, candidate.workHistory)
  await prisma.candidateProfile.update({
    where: { id: candidateId },
    data: { levelRankScore: result.score, levelRankLabel: result.label, levelRankUpdatedAt: new Date() },
  })
  return result
}

// Explicit recompute — called ONLY from real trigger events (work history
// added/deleted/re-primaried, resume parse completing, highestLevelReached
// confirmed), never from an ordinary page load. Always overwrites, unlike
// the lazy-backfill read above.
export async function recomputeCandidateLevelRank(candidateId: string): Promise<void> {
  const candidate = await prisma.candidateProfile.findUniqueOrThrow({
    where: { id: candidateId },
    include: { workHistory: true },
  })
  const result = await computeLevelRankLive(candidate, candidate.workHistory)
  await prisma.candidateProfile.update({
    where: { id: candidateId },
    data: { levelRankScore: result.score, levelRankLabel: result.label, levelRankUpdatedAt: new Date() },
  })
}
