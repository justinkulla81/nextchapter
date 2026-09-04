import 'server-only'
import type { CandidateProfile, WorkHistoryEntry } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { selectDisplayedWorkHistory } from '@/lib/work-history/sanitize'
import { inferLevelFromTitle, isAmbiguousPartnerTitle } from '@/lib/jobs/infer-job-function'
import { resolveCompanySizeBand } from '@/lib/market/company-size'
import { calibratedLevelRank, scoreToLevelRankLabel } from '@/lib/scoring/level-rank'
import { resolveContextualLevel, type ConcurrentRoleCandidate } from '@/lib/scoring/seniority/resolve-contextual-level'

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

// A bare "Partner" title is genuinely ambiguous (see isAmbiguousPartnerTitle's
// own comment) — inferLevelFromTitle's context-free default of C-Suite is
// wrong often enough here that it's worth resolving properly, since this is
// the one call site with real candidate history to resolve it against.
// Below this years-in-career bar, and with no earlier role that already
// resolved to VP/C-Suite via an unambiguous keyword, a bare Partner title
// reads as Director-equivalent rather than C-Suite.
const AMBIGUOUS_PARTNER_YEARS_THRESHOLD = 15

function resolveAmbiguousPartnerLevel(entry: WorkHistoryEntry, entriesSortedAsc: WorkHistoryEntry[]): string {
  const yearsUpToRole = (entry.startDate.getTime() - entriesSortedAsc[0].startDate.getTime()) / MS_PER_YEAR
  const priorUnambiguousSenior = entriesSortedAsc
    .filter((e) => e.startDate.getTime() < entry.startDate.getTime())
    .some((e) => {
      if (isAmbiguousPartnerTitle(e.roleTitle)) return false // an earlier ambiguous Partner can't corroborate this one
      const level = inferLevelFromTitle(e.roleTitle)
      return level === 'VP' || level === 'C-Suite'
    })
  if (yearsUpToRole >= AMBIGUOUS_PARTNER_YEARS_THRESHOLD || priorUnambiguousSenior) return 'C-Suite'
  return 'Director'
}

// Roles whose date ranges overlap `entry`, drawn from the FULL pre-
// collapse work history (not `entries`/selectDisplayedWorkHistory, which
// has already hidden concurrent non-full-time siblings behind the primary
// one) — resolveContextualLevel's Advisor/Consultant branch specifically
// needs to see those hidden siblings to tell a sole advisory seat from a
// multi-seat portfolio, or from a genuine concurrent full-time job.
function buildConcurrentRoles(entry: WorkHistoryEntry, rawWorkHistory: WorkHistoryEntry[], now: Date): ConcurrentRoleCandidate[] {
  const entryEnd = effectiveEnd(entry, now).getTime()
  const entryStart = entry.startDate.getTime()
  return rawWorkHistory
    .filter((other) => other.id !== entry.id)
    .filter((other) => {
      const otherEnd = effectiveEnd(other, now).getTime()
      return other.startDate.getTime() < entryEnd && otherEnd > entryStart
    })
    .map((other) => ({
      title: other.roleTitle,
      startDateMs: other.startDate.getTime(),
      endDateMs: other.isCurrent ? null : (other.endDate?.getTime() ?? null),
      isDeclaredFullTime: other.engagementType === 'FULL_TIME',
      tenureMonths: (effectiveEnd(other, now).getTime() - other.startDate.getTime()) / (MS_PER_YEAR / 12),
    }))
}

// See the plan's "generous reconciliation" addendum: when a candidate's
// career shows real title/company-size inconsistency (a max individual
// entry score far above the blended average), nudge the final score
// partway toward that max rather than letting a handful of lower-scoring
// entries flatten out a genuinely senior signal. 15 points = one
// LEVEL_STEP_POINTS unit — a real full-level-equivalent gap, not ordinary
// variation between roles.
const RECONCILIATION_THRESHOLD = 15
const RECONCILIATION_PULL = 0.3

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
  const entriesSortedAsc = [...entries].sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
  const mostRecentId = [...entries].sort((a, b) => b.startDate.getTime() - a.startDate.getTime())[0].id

  let weightedSum = 0
  let totalWeight = 0
  let maxEntryScore: number | null = null
  for (const entry of entries) {
    const tenureMonthsInRole = (effectiveEnd(entry, now).getTime() - entry.startDate.getTime()) / (MS_PER_YEAR / 12)
    const yearsIntoCareerAtStart = (entry.startDate.getTime() - entriesSortedAsc[0].startDate.getTime()) / MS_PER_YEAR
    const { band } = await resolveCompanySizeBand(entry.companyName)

    const contextual = resolveContextualLevel({
      title: entry.roleTitle,
      companyName: entry.companyName,
      freeformIndustry: entry.companyIndustry,
      tenureMonthsInRole,
      yearsIntoCareerAtStart,
      companySizeBand: band,
      concurrentRoles: buildConcurrentRoles(entry, rawWorkHistory, now),
    })

    let entryLevel: string | null
    if (contextual) {
      entryLevel =
        contextual.level ??
        (entry.id === mostRecentId && candidate.highestLevelReached
          ? candidate.highestLevelReached
          : inferLevelFromTitle(entry.roleTitle))
    } else if (entry.id === mostRecentId && candidate.highestLevelReached) {
      entryLevel = candidate.highestLevelReached
    } else {
      const inferred = inferLevelFromTitle(entry.roleTitle)
      entryLevel =
        inferred === 'C-Suite' && isAmbiguousPartnerTitle(entry.roleTitle)
          ? resolveAmbiguousPartnerLevel(entry, entriesSortedAsc)
          : inferred
    }

    const entryScore = calibratedLevelRank(entryLevel, band, contextual?.scoreNudge ?? 0)
    if (entryScore === null) continue

    const weight = recencyWeight(entry, now) * tenureWeight(entry, now) * (contextual?.weightMultiplier ?? 1)
    if (weight <= 0) continue
    weightedSum += entryScore * weight
    totalWeight += weight
    maxEntryScore = maxEntryScore === null ? entryScore : Math.max(maxEntryScore, entryScore)
  }

  if (totalWeight === 0) {
    const score = calibratedLevelRank(candidate.highestLevelReached, null)
    return { score, label: scoreToLevelRankLabel(score) }
  }

  const average = weightedSum / totalWeight
  const reconciled =
    maxEntryScore !== null && maxEntryScore - average > RECONCILIATION_THRESHOLD
      ? average + (maxEntryScore - average) * RECONCILIATION_PULL
      : average
  const score = Math.max(1, Math.min(100, Math.round(reconciled)))
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
