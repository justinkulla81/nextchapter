import 'server-only'
import { prisma } from '@/lib/prisma'
import {
  computeDossierCompleteness,
  getDossierLadderTier,
  isDossierUnlocked,
  getModuleGateStatus,
  DOSSIER_UNLOCK_REFERENCE_TARGET,
  DOSSIER_UNLOCK_OUTREACH_TARGET,
  DOSSIER_UNLOCK_APPLICATION_TARGET,
  type DossierCompleteness,
  type DossierLadderTier,
  type DossierUnlockStatus,
  type ModuleGateStatus,
} from '@/lib/scoring/dossier-unlock'
import { computeProbabilityGrade, type ProbabilityGradeResult } from '@/lib/scoring/market-reality/probability'
import { computeSearchStrategyChecklist, type SearchStrategyChecklist } from '@/lib/weekly/search-strategy-checklist'
import { getLeaderboardBadgeHistory, type LeaderboardBadgeHistoryEntry } from '@/lib/leaderboard/badges'

/**
 * Everything one candidate has done, in a single read.
 *
 * The candidate's own dashboard already computes each of these, but nothing in
 * admin ever asked for them — so a support view could see who someone is and
 * not what they had done. This is that view's data layer, and it deliberately
 * calls the same functions the dashboard does rather than re-deriving
 * anything: if the Dossier rules change, both move together.
 */

export interface ConnectionStatus {
  connected: boolean
  label: string
  detail: string | null
  since: Date | null
  /** Set when a connection existed and stopped working — the interesting case. */
  problem: string | null
}

export interface AssessmentStatus {
  key: string
  label: string
  completedAt: Date | null
  /** A short, readable summary of what they answered, when we have one. */
  summary: string | null
  /** Set when the instrument itself flagged the responses. */
  flag: string | null
}

export interface ActivityCount {
  key: string
  label: string
  count: number
  lastAt: Date | null
}

export interface EarnedBadge {
  key: string
  label: string
  earnedAt: Date
  source: 'milestone' | 'weekly' | 'learning' | 'leaderboard'
  detail: string | null
}

export interface CandidateProgress {
  /** How likely they are to land, on the same model the candidate sees. */
  likelihood: ProbabilityGradeResult | null
  dossier: {
    tier: DossierLadderTier
    completeness: DossierCompleteness
    unlock: DossierUnlockStatus
  }
  moduleGates: ModuleGateStatus[]
  connections: ConnectionStatus[]
  searchStrategy: {
    checklist: SearchStrategyChecklist
    answeredCount: number
    totalCount: number
  }
  assessments: AssessmentStatus[]
  activity: ActivityCount[]
  badges: EarnedBadge[]
}

/** Weekly badge keys are stored as strings so the table does not churn. */
export function humanizeKey(key: string): string {
  return key
    .toLowerCase()
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ')
}

/** Describes a Gmail or LinkedIn connection, including the ways it can go wrong. */
export function describeConnection(
  label: string,
  row: { connectedAt: Date; disconnectedAt: Date | null; needsReconnectAt?: Date | null; detail?: string | null } | null
): ConnectionStatus {
  if (!row) {
    return { connected: false, label, detail: null, since: null, problem: null }
  }
  if (row.disconnectedAt) {
    return {
      connected: false,
      label,
      detail: row.detail ?? null,
      since: row.connectedAt,
      problem: `Disconnected ${row.disconnectedAt.toISOString().slice(0, 10)}`,
    }
  }
  if (row.needsReconnectAt) {
    return {
      connected: false,
      label,
      detail: row.detail ?? null,
      since: row.connectedAt,
      // This is the state that matters most in support: it looks connected to
      // everyone and has silently stopped returning data.
      problem: `Needs reconnect since ${row.needsReconnectAt.toISOString().slice(0, 10)}`,
    }
  }
  return { connected: true, label, detail: row.detail ?? null, since: row.connectedAt, problem: null }
}

export async function getCandidateProgress(candidateId: string): Promise<CandidateProgress> {
  const [
    likelihood,
    ladder,
    unlock,
    moduleGates,
    profile,
    email,
    linkedIn,
    operatingProfile,
    personalityProfile,
    assessmentResults,
    trackRecord,
    whatINeed,
    interviewResponses,
    courseActivity,
    walkthroughs,
    outreach,
    applications,
    references,
    sprints,
    milestoneBadges,
    weeklyBadges,
    learningBadges,
    leaderboardBadges,
  ] = await Promise.all([
    // A candidate with too little history has no probability grade yet; that
    // is a real state, not an error.
    computeProbabilityGrade(candidateId).catch(() => null),
    getDossierLadderTier(candidateId),
    isDossierUnlocked(candidateId),
    getModuleGateStatus(candidateId),
    prisma.candidateProfile.findUniqueOrThrow({
      where: { id: candidateId },
      select: {
        gapDuration: true, targetIndustries: true, primaryFunction: true, highestLevelReached: true,
        targetRoleType: true, remotePreference: true, skillsAssessmentCompletedAt: true,
        linkedinConnectionsImportedAt: true,
      },
    }),
    prisma.emailConnection.findUnique({ where: { candidateId } }),
    prisma.linkedInConnection.findUnique({ where: { candidateId } }),
    prisma.candidateAssessmentResponse.findFirst({ where: { candidateId }, orderBy: { completedAt: 'desc' } }),
    prisma.performanceAssessmentResponse.findFirst({ where: { candidateId }, orderBy: { completedAt: 'desc' } }),
    prisma.assessmentResult.findMany({ where: { candidateId }, orderBy: { completedAt: 'desc' } }),
    prisma.trackRecordResponse.findFirst({ where: { candidateId }, orderBy: { createdAt: 'desc' } }),
    prisma.whatINeedResponse.findFirst({ where: { candidateId }, orderBy: { createdAt: 'desc' } }),
    prisma.interviewResponse.count({ where: { candidateId } }),
    prisma.candidateCourseActivity.findMany({ where: { candidateId }, orderBy: { detectedAt: 'desc' }, take: 1 }),
    prisma.resumeWalkthroughSession.findMany({ where: { candidateId }, orderBy: { startedAt: 'desc' }, take: 1 }),
    prisma.outreachLog.findMany({ where: { candidateId }, orderBy: { loggedAt: 'desc' }, take: 1 }),
    prisma.jobPosting.findMany({ where: { candidateId, appliedAt: { not: null } }, orderBy: { appliedAt: 'desc' }, take: 1 }),
    prisma.reference.findMany({ where: { candidateId }, orderBy: { requestedAt: 'desc' } }),
    prisma.weeklySprint.findMany({ where: { candidateId }, orderBy: { weekStartDate: 'desc' } }),
    prisma.milestoneBadge.findMany({ where: { candidateId }, orderBy: { earnedAt: 'desc' } }),
    prisma.weeklyBadgeEarned.findMany({ where: { candidateId }, orderBy: { earnedAt: 'desc' } }),
    prisma.learningBadge.findMany({ where: { candidateId }, orderBy: { completedAt: 'desc' } }),
    getLeaderboardBadgeHistory(candidateId).catch((): LeaderboardBadgeHistoryEntry[] => []),
  ])

  const [outreachCount, applicationCount, courseCount, walkthroughCount] = await Promise.all([
    prisma.outreachLog.count({ where: { candidateId } }),
    prisma.jobPosting.count({ where: { candidateId, appliedAt: { not: null } } }),
    prisma.candidateCourseActivity.count({ where: { candidateId } }),
    prisma.resumeWalkthroughSession.count({ where: { candidateId } }),
  ])

  const checklist = computeSearchStrategyChecklist(profile)
  const SEARCH_STRATEGY_FIELD_COUNT = 6 // the fields computeSearchStrategyChecklist inspects

  const assessments: AssessmentStatus[] = [
    {
      key: 'operating',
      label: 'Operating Profile',
      completedAt: operatingProfile?.completedAt ?? null,
      summary: operatingProfile ? describeVectors(operatingProfile.dimensionVectors) : null,
      // Surfaced because an inconsistent or gamed response changes how much
      // weight anyone should put on the result.
      flag: operatingProfile?.manipulationRiskFlag
        ? 'Manipulation risk flagged'
        : operatingProfile?.inconsistencyScore != null && operatingProfile.inconsistencyScore > 1
          ? `Inconsistent responses (${operatingProfile.inconsistencyScore.toFixed(2)})`
          : null,
    },
    {
      key: 'personality',
      label: 'Personality Profile',
      completedAt: personalityProfile?.completedAt ?? null,
      summary: null,
      flag: null,
    },
    {
      key: 'skills',
      label: 'Skills assessment',
      completedAt: profile.skillsAssessmentCompletedAt,
      summary: null,
      flag: null,
    },
    ...assessmentResults.map((r) => ({
      key: `result-${r.id}`,
      label: humanizeKey(r.assessmentType),
      completedAt: r.completedAt,
      summary: describeTranslatedOutput(r.translatedOutput),
      flag: null,
    })),
    {
      key: 'track-record',
      label: 'Track record',
      completedAt: trackRecord?.createdAt ?? null,
      summary: null,
      flag: null,
    },
    {
      key: 'what-i-need',
      label: 'What I need',
      completedAt: whatINeed?.createdAt ?? null,
      summary: null,
      flag: null,
    },
  ]

  const completedSprints = sprints.filter((s) =>
    ((s.committedActions as Array<{ completed?: boolean }> | null) ?? []).some((a) => a.completed)
  )

  const activity: ActivityCount[] = [
    { key: 'outreach', label: 'Outreach messages sent', count: outreachCount, lastAt: outreach[0]?.loggedAt ?? null },
    { key: 'applications', label: 'Applications submitted', count: applicationCount, lastAt: applications[0]?.appliedAt ?? null },
    {
      key: 'references-requested',
      label: 'References requested',
      count: references.length,
      lastAt: references[0]?.requestedAt ?? null,
    },
    {
      key: 'references-returned',
      label: 'References returned',
      count: references.filter((r) => r.status === 'COMPLETED').length,
      lastAt: references.find((r) => r.status === 'COMPLETED')?.completedAt ?? null,
    },
    { key: 'sprints', label: 'Weekly sprints with a completed action', count: completedSprints.length, lastAt: completedSprints[0]?.weekStartDate ?? null },
    { key: 'interview-prep', label: 'Interview prep answers', count: interviewResponses, lastAt: null },
    { key: 'courses', label: 'Course activity', count: courseCount, lastAt: courseActivity[0]?.detectedAt ?? null },
    { key: 'walkthroughs', label: 'Resume walkthroughs', count: walkthroughCount, lastAt: walkthroughs[0]?.startedAt ?? null },
  ]

  const badges: EarnedBadge[] = [
    ...milestoneBadges.map((b) => ({
      key: b.badgeKey, label: humanizeKey(b.badgeKey), earnedAt: b.earnedAt, source: 'milestone' as const, detail: null,
    })),
    ...weeklyBadges.map((b) => ({
      key: b.badgeKey, label: humanizeKey(b.badgeKey), earnedAt: b.earnedAt, source: 'weekly' as const,
      detail: `Week of ${b.weekStartDate.toISOString().slice(0, 10)}`,
    })),
    ...learningBadges.map((b) => ({
      key: b.badgeType, label: b.title, earnedAt: b.completedAt, source: 'learning' as const,
      detail: [b.provider, b.verified ? 'verified' : null].filter(Boolean).join(' · ') || null,
    })),
    // Leaderboard badges are dated by the week they were won, not a moment.
    ...leaderboardBadges.map((b) => ({
      key: b.badgeKey, label: b.label, earnedAt: b.weekStartDate, source: 'leaderboard' as const,
      detail: `Week of ${b.weekStartDate.toISOString().slice(0, 10)}`,
    })),
  ].sort((a, b) => b.earnedAt.getTime() - a.earnedAt.getTime())

  return {
    likelihood,
    dossier: { tier: ladder.tier, completeness: ladder.completeness, unlock },
    moduleGates,
    connections: [
      describeConnection('Gmail', email ? { ...email, detail: email.connectedEmail } : null),
      describeConnection('LinkedIn (posting)', linkedIn),
      {
        connected: profile.linkedinConnectionsImportedAt !== null,
        label: 'LinkedIn connections imported',
        detail: null,
        since: profile.linkedinConnectionsImportedAt,
        problem: null,
      },
    ],
    searchStrategy: {
      checklist,
      answeredCount: SEARCH_STRATEGY_FIELD_COUNT - checklist.incomplete.length,
      totalCount: SEARCH_STRATEGY_FIELD_COUNT,
    },
    assessments,
    activity,
    badges,
  }
}

/** Turns the Operating Profile's dimension vector into a readable line. */
export function describeVectors(vectors: unknown): string | null {
  if (!vectors || typeof vectors !== 'object') return null
  const entries = Object.entries(vectors as Record<string, unknown>).filter(([, v]) => typeof v === 'number')
  if (!entries.length) return null
  // These are scored on a -2..+2 scale; full float precision is noise.
  return entries
    .map(([k, v]) => {
      const n = v as number
      return `${humanizeKey(k)} ${n > 0 ? '+' : ''}${n.toFixed(1)}`
    })
    .join(' · ')
}

/** Assessment results store a plain-English block for employer reports. */
function describeTranslatedOutput(output: unknown): string | null {
  if (!output || typeof output !== 'object') return null
  const values = Object.values(output as Record<string, unknown>).filter((v) => typeof v === 'string') as string[]
  if (!values.length) return null
  return values.join(' · ').slice(0, 240)
}

export interface DossierGateSummary {
  met: number
  total: number
  /** The gates still outstanding, named — so a list cell can say why. */
  missing: string[]
  unlocked: boolean
}

const GATE_TOTAL = 3

/**
 * The Dossier unlock gates for many candidates at once.
 *
 * The per-candidate version runs six queries and is fine on one profile and
 * ruinous on a hundred-row list, so this answers the same question with six
 * grouped queries regardless of how many candidates are asked about. It reads
 * the same three gates and the same constants as isDossierUnlocked, so the
 * list and the detail page cannot disagree.
 *
 * It does not evaluate the sprint-streak alternate path, which needs a
 * per-candidate walk of weekly sprints; the Market Reality grade half of that
 * path is included, being a single column.
 */
export async function getDossierGateSummaries(candidateIds: string[]): Promise<Map<string, DossierGateSummary>> {
  const summaries = new Map<string, DossierGateSummary>()
  if (candidateIds.length === 0) return summaries

  const where = { candidateId: { in: candidateIds } }
  const [references, operating, personality, profiles, outreach, applications, grades] = await Promise.all([
    prisma.reference.groupBy({ by: ['candidateId'], where: { ...where, status: 'COMPLETED' }, _count: { _all: true } }),
    prisma.candidateAssessmentResponse.groupBy({ by: ['candidateId'], where, _count: { _all: true } }),
    prisma.performanceAssessmentResponse.groupBy({ by: ['candidateId'], where, _count: { _all: true } }),
    prisma.candidateProfile.findMany({
      where: { id: { in: candidateIds } },
      select: { id: true, skillsAssessmentCompletedAt: true },
    }),
    prisma.outreachLog.groupBy({ by: ['candidateId'], where, _count: { _all: true } }),
    prisma.jobPosting.groupBy({ by: ['candidateId'], where: { ...where, appliedAt: { not: null } }, _count: { _all: true } }),
    prisma.marketRealityComponentScore.findMany({
      where: { candidateId: { in: candidateIds } },
      select: { candidateId: true, probabilityGrade: true },
    }),
  ])

  const countOf = (rows: { candidateId: string; _count: { _all: number } }[]) =>
    new Map(rows.map((r) => [r.candidateId, r._count._all]))

  const referenceCount = countOf(references)
  const operatingSet = new Set(operating.map((r) => r.candidateId))
  const personalitySet = new Set(personality.map((r) => r.candidateId))
  const skillsAt = new Map(profiles.map((p) => [p.id, p.skillsAssessmentCompletedAt]))
  const outreachCount = countOf(outreach)
  const applicationCount = countOf(applications)
  const gradeOf = new Map(grades.map((g) => [g.candidateId, g.probabilityGrade]))

  for (const id of candidateIds) {
    const referencesMet = (referenceCount.get(id) ?? 0) >= DOSSIER_UNLOCK_REFERENCE_TARGET
    const evidenceMet = operatingSet.has(id) || personalitySet.has(id) || skillsAt.get(id) != null
    const effortMet =
      (outreachCount.get(id) ?? 0) >= DOSSIER_UNLOCK_OUTREACH_TARGET &&
      (applicationCount.get(id) ?? 0) >= DOSSIER_UNLOCK_APPLICATION_TARGET

    const grade = gradeOf.get(id)
    const gradeAlternate = grade === 'A' || grade === 'B'

    const missing = [
      referencesMet ? null : 'references',
      evidenceMet ? null : 'assessment',
      effortMet ? null : 'effort',
    ].filter((v): v is string => v !== null)

    summaries.set(id, {
      met: GATE_TOTAL - missing.length,
      total: GATE_TOTAL,
      missing,
      unlocked: missing.length === 0 || gradeAlternate,
    })
  }
  return summaries
}
