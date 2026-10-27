// The complete unlock schema — Master Build Script §7. Governing principle
// (§7.1): gate on WORK DONE, never grade achieved — grade is partly a
// function of pedigree the candidate can't change, so gating on grade
// would lock out exactly who needs the platform most. Every check below
// reads real activity/data, never a score.
//
// This is a new, additive module — it does not touch the live six-category
// blended grade (dossier-competencies.ts) or its weekly-effort economy.

import 'server-only'
import { cache } from 'react'
import { prisma } from '@/lib/prisma'
import { isGmailConnected } from '@/lib/dashboard/access-gate'
import { isGoogleConnectOn } from '@/lib/google/connect-switch'
import { isLinkedInConnected } from '@/lib/dashboard/linkedin-connection'
import { computeCurrentSprintStreak } from '@/lib/scoring/market-reality/effort'
import { getLifetimeEffortMinutes, sumEffortMinutes } from '@/lib/scoring/effort-minutes'
import {
  effortTargetFor,
  DOSSIER_UNLOCK_REFERENCE_TARGET,
  DOSSIER_UNLOCK_OUTREACH_TARGET,
  DOSSIER_UNLOCK_APPLICATION_TARGET,
} from '@/lib/scoring/dossier-targets'
import type { SeniorityBand } from '@/lib/scoring/resume-analysis/types'

// §7.3 — band adjustment. Executive is told applications are lowest-yield
// (requiring 5 would contradict that advice), so it alone gets a lower
// application target and a higher outreach target. Early/Mid/Senior share
// one set — this groups differently from composite.ts's Early/Mid vs.
// Senior/Executive weighting split; that's intentional, not a copy-paste
// of the same grouping, since these are different axes (comp math vs.
// realistic outreach volume).
export const DOSSIER_REFERENCE_TARGET = 3
const OUTREACH_TARGET_BY_BAND: Record<SeniorityBand, number> = { EARLY: 15, MID: 15, SENIOR: 15, EXECUTIVE: 20 }
const APPLICATION_TARGET_BY_BAND: Record<SeniorityBand, number> = { EARLY: 5, MID: 5, SENIOR: 5, EXECUTIVE: 2 }

// §7.4 — self-report intake for outreach/applications doesn't exist yet
// anywhere in the codebase (no numeric self-reported-history field on
// CandidateProfile; onboarding only captures qualitative buckets like
// "Under 10," and that onboarding rebuild is separate follow-up work,
// §10). Until that intake exists, this gate is platform-logged-count-only
// — stricter than the spec's "self-report can cover half," never more
// lenient, so it can't hand out false credit. Revisit once real
// self-reported counts exist to add the capped blend §7.4 describes.

// Read-only; cache() dedupes repeat calls within one request (this file's
// completeness and ladder helpers both ask for it).
const getSeniorityBand = cache(async (candidateId: string): Promise<SeniorityBand | null> => {
  const analysis = await prisma.resumeAnalysis.findFirst({
    where: { candidateId },
    orderBy: { createdAt: 'desc' },
    select: { seniorityBand: true },
  })
  return (analysis?.seniorityBand as SeniorityBand | undefined) ?? null
})

export interface DossierRequirement {
  key: string
  label: string
  met: boolean
  current: number // 0/1 for boolean items, a real count for numeric items
  target: number
}

export interface DossierCompleteness {
  requirements: DossierRequirement[]
  metCount: number
  totalCount: number
  isComplete: boolean
}

// §7.2 — all six required for Dossier complete. A "4 consecutive Weekly
// Search Sprints" requirement used to sit here too ("the grit test") — cut
// per direct instruction: a hard calendar-time wait contradicts letting
// someone who's actually doing the work accelerate to Candidate+ faster.
// The separate alternate unlock path below (hasAlternateUnlockPath) still
// offers a sprint-streak route for candidates who haven't hit the primary
// reference/outreach/application targets — that one's untouched, since a
// slower path for someone else isn't the same as a floor under everyone.
// Pure per-candidate read (no writes), so cache() safely dedupes the several
// callers a single dashboard render has (page body, badges, ladder, gates).
export const computeDossierCompleteness = cache(computeDossierCompletenessUncached)

async function computeDossierCompletenessUncached(candidateId: string): Promise<DossierCompleteness> {
  const band = await getSeniorityBand(candidateId)

  const [
    completedReferenceCount,
    profile,
    hasOperatingProfile,
    hasPersonalityProfile,
    outreachCount,
    applicationCount,
    effortMinutes,
  ] = await Promise.all([
    prisma.reference.count({ where: { candidateId, status: 'COMPLETED' } }),
    prisma.candidateProfile.findUniqueOrThrow({
      where: { id: candidateId },
      select: COMPLETENESS_PROFILE_SELECT,
    }),
    prisma.candidateAssessmentResponse.findFirst({ where: { candidateId }, select: { id: true } }),
    prisma.performanceAssessmentResponse.findFirst({ where: { candidateId }, select: { id: true } }),
    prisma.outreachLog.count({ where: { candidateId } }), // lifetime, no window — matches network/page.tsx's existing pattern
    prisma.jobPosting.count({ where: { candidateId, appliedAt: { not: null } } }), // lifetime, no window — matches application-trends.ts's existing pattern
    getLifetimeEffortMinutes(candidateId),
  ])

  return buildDossierCompleteness({
    band,
    completedReferenceCount,
    profile,
    hasOperatingProfile: Boolean(hasOperatingProfile),
    hasPersonalityProfile: Boolean(hasPersonalityProfile),
    outreachCount,
    applicationCount,
    effortMinutes,
  })
}

const COMPLETENESS_PROFILE_SELECT = {
  skillsAssessmentCompletedAt: true,
  effortMinutesTargetOverride: true,
  profileConfirmedAt: true,
  industryConfirmedAt: true,
  functionConfirmedAt: true,
  salaryConfirmedAt: true,
  workAuthConfirmedAt: true,
  linkedInConfirmedAt: true,
} as const

interface CompletenessInputs {
  band: SeniorityBand | null
  completedReferenceCount: number
  profile: {
    skillsAssessmentCompletedAt: Date | null
    effortMinutesTargetOverride: number | null
    profileConfirmedAt: Date | null
    industryConfirmedAt: Date | null
    functionConfirmedAt: Date | null
    salaryConfirmedAt: Date | null
    workAuthConfirmedAt: Date | null
    linkedInConfirmedAt: Date | null
  }
  hasOperatingProfile: boolean
  hasPersonalityProfile: boolean
  outreachCount: number
  applicationCount: number
  effortMinutes: number
}

// The pure half of the completeness check, shared by the single-candidate and
// batched loaders so the two can never disagree.
export function buildDossierCompleteness(input: CompletenessInputs): DossierCompleteness {
  const { completedReferenceCount, profile, hasOperatingProfile, hasPersonalityProfile, outreachCount, applicationCount, effortMinutes } = input
  const resolvedBand = input.band ?? 'MID' // unknown band defaults to the non-Executive target set — never assume the higher-target Executive band without evidence
  const outreachTarget = OUTREACH_TARGET_BY_BAND[resolvedBand]
  const applicationTarget = APPLICATION_TARGET_BY_BAND[resolvedBand]

  // §7.2 item 2 — "100% personalization/profile," approximated from the
  // established one-time confirmation fields this codebase already tracks
  // per profile section (same convention every other gate in this app
  // uses — see access-gate.ts's linkedInConfirmedAt check).
  const profileFieldsConfirmed = [
    profile.profileConfirmedAt,
    profile.industryConfirmedAt,
    profile.functionConfirmedAt,
    profile.salaryConfirmedAt,
    profile.workAuthConfirmedAt,
    profile.linkedInConfirmedAt,
  ].filter((v) => v !== null).length
  const profileFieldsTotal = 6

  const effortTarget = effortTargetFor(profile.effortMinutesTargetOverride)
  const requirements: DossierRequirement[] = [
    {
      key: 'effort',
      label: `${effortTarget} minutes of search effort`,
      met: effortMinutes >= effortTarget,
      current: Math.min(effortMinutes, effortTarget),
      target: effortTarget,
    },
    {
      key: 'references',
      label: `${DOSSIER_REFERENCE_TARGET} references returned`,
      met: completedReferenceCount >= DOSSIER_REFERENCE_TARGET,
      current: completedReferenceCount,
      target: DOSSIER_REFERENCE_TARGET,
    },
    {
      key: 'profile',
      label: '100% personalization/profile',
      met: profileFieldsConfirmed >= profileFieldsTotal,
      current: profileFieldsConfirmed,
      target: profileFieldsTotal,
    },
    {
      key: 'behavioralAssessments',
      label: 'Both behavioral assessments (Operating Profile + Personality Profile)',
      met: hasOperatingProfile && hasPersonalityProfile,
      current: (hasOperatingProfile ? 1 : 0) + (hasPersonalityProfile ? 1 : 0),
      target: 2,
    },
    {
      key: 'skillsAssessment',
      label: 'Skills assessment complete',
      met: profile.skillsAssessmentCompletedAt !== null,
      current: profile.skillsAssessmentCompletedAt !== null ? 1 : 0,
      target: 1,
    },
    {
      key: 'outreach',
      label: `${outreachTarget} outreach messages sent`,
      met: outreachCount >= outreachTarget,
      current: outreachCount,
      target: outreachTarget,
    },
    {
      key: 'applications',
      label: `${applicationTarget} applications submitted`,
      met: applicationCount >= applicationTarget,
      current: applicationCount,
      target: applicationTarget,
    },
  ]

  const metCount = requirements.filter((r) => r.met).length
  return { requirements, metCount, totalCount: requirements.length, isComplete: metCount === requirements.length }
}

// One batched read for many candidates (the recruiter search list), returning
// exactly what computeDossierCompleteness returns for each id: the same counts
// and flags, grouped in the database instead of fetched candidate by candidate.
// Ids without a profile are omitted (the single-candidate version throws).
export async function computeDossierCompletenessMany(candidateIds: string[]): Promise<Map<string, DossierCompleteness>> {
  const ids = [...new Set(candidateIds)]
  const result = new Map<string, DossierCompleteness>()
  if (ids.length === 0) return result

  const [analyses, references, profiles, operating, personality, outreach, applications, sprints] = await Promise.all([
    prisma.resumeAnalysis.findMany({
      where: { candidateId: { in: ids } },
      orderBy: { createdAt: 'desc' },
      select: { candidateId: true, seniorityBand: true },
    }),
    prisma.reference.groupBy({ by: ['candidateId'], where: { candidateId: { in: ids }, status: 'COMPLETED' }, _count: { _all: true } }),
    prisma.candidateProfile.findMany({ where: { id: { in: ids } }, select: { id: true, ...COMPLETENESS_PROFILE_SELECT } }),
    prisma.candidateAssessmentResponse.findMany({ where: { candidateId: { in: ids } }, distinct: ['candidateId'], select: { candidateId: true } }),
    prisma.performanceAssessmentResponse.findMany({ where: { candidateId: { in: ids } }, distinct: ['candidateId'], select: { candidateId: true } }),
    prisma.outreachLog.groupBy({ by: ['candidateId'], where: { candidateId: { in: ids } }, _count: { _all: true } }),
    prisma.jobPosting.groupBy({ by: ['candidateId'], where: { candidateId: { in: ids }, appliedAt: { not: null } }, _count: { _all: true } }),
    prisma.weeklySprint.findMany({ where: { candidateId: { in: ids } }, select: { candidateId: true, committedActions: true } }),
  ])

  // Newest analysis first, so the first row seen per candidate is the latest.
  const bandById = new Map<string, SeniorityBand | null>()
  for (const a of analyses) {
    if (!bandById.has(a.candidateId)) bandById.set(a.candidateId, (a.seniorityBand as SeniorityBand | undefined) ?? null)
  }
  const countOf = (rows: { candidateId: string; _count: { _all: number } }[]) =>
    new Map(rows.map((r) => [r.candidateId, r._count._all]))
  const referenceCounts = countOf(references)
  const outreachCounts = countOf(outreach)
  const applicationCounts = countOf(applications)
  const hasOperating = new Set(operating.map((r) => r.candidateId))
  const hasPersonality = new Set(personality.map((r) => r.candidateId))
  const sprintsById = new Map<string, { committedActions: unknown }[]>()
  for (const sprint of sprints) {
    const list = sprintsById.get(sprint.candidateId)
    if (list) list.push(sprint)
    else sprintsById.set(sprint.candidateId, [sprint])
  }

  for (const { id, ...profile } of profiles) {
    result.set(
      id,
      buildDossierCompleteness({
        band: bandById.get(id) ?? null,
        completedReferenceCount: referenceCounts.get(id) ?? 0,
        profile,
        hasOperatingProfile: hasOperating.has(id),
        hasPersonalityProfile: hasPersonality.has(id),
        outreachCount: outreachCounts.get(id) ?? 0,
        applicationCount: applicationCounts.get(id) ?? 0,
        effortMinutes: sumEffortMinutes(sprintsById.get(id) ?? []),
      })
    )
  }
  return result
}

// The real access gate — deliberately lighter than full Dossier
// completeness above. "Complete" (computeDossierCompleteness) is the
// aspirational, all-7-requirements checklist shown on the Portfolio page.
// "Unlocked" (Candidate+: outreach, applications, search-effort minutes and one
// assessment; references count toward Candidate+ Verified instead) is the actual
// bar for every feature gate that used to check
// the old six-category letter grade (bounty claims, the job extras —
// who to contact, apply kit, explain-my-gaps —, recruiter visibility, etc.) — real evidence and real
// effort, not a computed grade, per §7.1's governing principle.
export { DOSSIER_UNLOCK_REFERENCE_TARGET, DOSSIER_UNLOCK_OUTREACH_TARGET, DOSSIER_UNLOCK_APPLICATION_TARGET }

// Market Reality Redesign Part 2 — the alternate path to a full unlock:
// achieving a real Market Reality B-or-better, OR consistently hitting
// weekly Sprint targets over a meaningful stretch. Reads
// MarketRealityComponentScore.probabilityGrade directly (the single source
// of truth from scoring/market-reality/probability.ts) — never
// recomputes it. 6 consecutive weeks (an estimate) is deliberately longer
// than DOSSIER_SPRINT_STREAK_TARGET's 4 weeks above, since this is a full-
// unlock bypass, not one component of the aspirational checklist.
const ALTERNATE_UNLOCK_SPRINT_STREAK_WEEKS = 6

export interface AlternateUnlockPath {
  met: boolean
  gradeMet: boolean
  streakMet: boolean
  reason: string
}

export async function hasAlternateUnlockPath(candidateId: string): Promise<AlternateUnlockPath> {
  const [component, streak] = await Promise.all([
    prisma.marketRealityComponentScore.findUnique({ where: { candidateId }, select: { probabilityGrade: true } }),
    computeCurrentSprintStreak(candidateId, ALTERNATE_UNLOCK_SPRINT_STREAK_WEEKS),
  ])

  // A strong Market Reality grade no longer opens Candidate+ on its own: the
  // dossier proves effort, and a grade partly reflects pedigree. It is still
  // reported (gradeMet) for display, but only a sustained weekly-goal streak
  // is an alternate route.
  const gradeMet = component?.probabilityGrade === 'A' || component?.probabilityGrade === 'B'
  const streakMet = streak >= ALTERNATE_UNLOCK_SPRINT_STREAK_WEEKS

  return {
    met: streakMet,
    gradeMet,
    streakMet,
    reason: streakMet ? `Unlocked — a ${streak}-week Weekly Search Sprint streak.` : 'not yet met',
  }
}

export interface DossierUnlockStatus {
  unlocked: boolean
  /** Shown for context only: references are no longer a Candidate+ requirement (owner, 2026-10-16); they count toward Candidate+ Verified. */
  referencesMet: boolean
  evidenceMet: boolean // at least one of: Operating Profile, Personality Profile, Skills Assessment
  effortMet: boolean // outreach AND applications both at/above target
  minutesMet: boolean // lifetime search-effort minutes at/above target
  effortMinutes: number
  effortTarget: number // this member's target, which an admin may have overridden
  alternatePath: AlternateUnlockPath
  completedReferenceCount: number
  outreachCount: number
  applicationCount: number
  reason: string // plain-language — states what's still missing, or confirms unlock
  /** When Candidate+ was first earned (kept from then on), and how; null when never earned. */
  unlockedAt: Date | null
  unlockSource: CandidatePlusSource | null
  /** An admin removed Candidate+ (only an admin can). */
  revoked: boolean
}

export type CandidatePlusSource = 'requirements' | 'streak'

/**
 * The Candidate+ main path (owner, 2026-10-16): outreach + applications (effortMet),
 * search-effort minutes and one assessment. References are deliberately not here;
 * they count toward Candidate+ Verified.
 */
export function meetsCandidatePlusRequirements(g: { evidenceMet: boolean; effortMet: boolean; minutesMet: boolean }): boolean {
  return g.evidenceMet && g.effortMet && g.minutesMet
}

/**
 * Candidate+ is permanent once earned (owner's rule, 2026-10-16). The main path counts
 * lifetime work, so it never lapses; the streak path reads the latest weeks, so on its
 * own it switched off every Monday until that week's goal was met. Recording the first
 * unlock keeps both on for good. Only an admin revoke turns it off.
 */
export function resolveCandidatePlus(input: {
  requirementsMet: boolean
  streakMet: boolean
  unlockedAt: Date | null
  revokedAt: Date | null
}): { unlocked: boolean; record: CandidatePlusSource | null } {
  if (input.revokedAt) return { unlocked: false, record: null }
  const live: CandidatePlusSource | null = input.requirementsMet ? 'requirements' : input.streakMet ? 'streak' : null
  return { unlocked: !!input.unlockedAt || live !== null, record: input.unlockedAt ? null : live }
}

// Per-candidate read; the only write is recording the first unlock (once, ever).
// Layout, page body, ranking data and several widgets each ask within one request;
// cache() makes repeats free.
export const isDossierUnlocked = cache(isDossierUnlockedUncached)

async function isDossierUnlockedUncached(candidateId: string): Promise<DossierUnlockStatus> {
  const [completedReferenceCount, hasOperatingProfile, hasPersonalityProfile, profile, outreachCount, applicationCount, alternatePath, effortMinutes] =
    await Promise.all([
      prisma.reference.count({ where: { candidateId, status: 'COMPLETED' } }),
      prisma.candidateAssessmentResponse.findFirst({ where: { candidateId }, select: { id: true } }),
      prisma.performanceAssessmentResponse.findFirst({ where: { candidateId }, select: { id: true } }),
      prisma.candidateProfile.findUniqueOrThrow({ where: { id: candidateId }, select: {
          skillsAssessmentCompletedAt: true, effortMinutesTargetOverride: true,
          candidatePlusUnlockedAt: true, candidatePlusUnlockSource: true, candidatePlusRevokedAt: true,
        },
      }),
      prisma.outreachLog.count({ where: { candidateId } }), // lifetime, no window — matches computeDossierCompleteness's convention
      prisma.jobPosting.count({ where: { candidateId, appliedAt: { not: null } } }), // lifetime, no window
      hasAlternateUnlockPath(candidateId),
      getLifetimeEffortMinutes(candidateId),
    ])

  const referencesMet = completedReferenceCount >= DOSSIER_UNLOCK_REFERENCE_TARGET
  const evidenceMet = Boolean(hasOperatingProfile) || Boolean(hasPersonalityProfile) || profile.skillsAssessmentCompletedAt !== null
  const effortMet = outreachCount >= DOSSIER_UNLOCK_OUTREACH_TARGET && applicationCount >= DOSSIER_UNLOCK_APPLICATION_TARGET
  const effortTarget = effortTargetFor(profile.effortMinutesTargetOverride)
  const minutesMet = effortMinutes >= effortTarget
  const requirementsMet = meetsCandidatePlusRequirements({ evidenceMet, effortMet, minutesMet })
  const plus = resolveCandidatePlus({
    requirementsMet,
    streakMet: alternatePath.met,
    unlockedAt: profile.candidatePlusUnlockedAt,
    revokedAt: profile.candidatePlusRevokedAt,
  })
  const unlocked = plus.unlocked
  let unlockedAt = profile.candidatePlusUnlockedAt
  let unlockSource = (profile.candidatePlusUnlockSource as CandidatePlusSource | null) ?? null
  if (plus.record) {
    // First time earned: record it so it stays on. Guarded so two requests can't both write.
    unlockedAt = new Date()
    unlockSource = plus.record
    await prisma.candidateProfile
      .updateMany({
        where: { id: candidateId, candidatePlusUnlockedAt: null, candidatePlusRevokedAt: null },
        data: { candidatePlusUnlockedAt: unlockedAt, candidatePlusUnlockSource: unlockSource },
      })
      .catch((error) => console.error('Failed to record Candidate+ unlock:', error))
  }

  const missing: string[] = []
  if (!evidenceMet) missing.push('one completed assessment (Operating Profile, Personality Profile, or Skills)')
  if (!minutesMet) missing.push(`${effortTarget - effortMinutes} more minutes of search effort`)
  if (!effortMet) {
    const missingOutreach = Math.max(0, DOSSIER_UNLOCK_OUTREACH_TARGET - outreachCount)
    const missingApplications = Math.max(0, DOSSIER_UNLOCK_APPLICATION_TARGET - applicationCount)
    if (missingOutreach > 0) missing.push(`${missingOutreach} more outreach or networking message${missingOutreach === 1 ? '' : 's'}`)
    if (missingApplications > 0) missing.push(`${missingApplications} more application${missingApplications === 1 ? '' : 's'}`)
  }

  const reason = profile.candidatePlusRevokedAt
    ? 'Candidate+ was removed by NextChapter. Write to support@launchyournextchapter.com if you think this is a mistake.'
    : unlocked
      ? requirementsMet
        ? 'Unlocked — you have real outreach, applications, search effort and an assessment on file.'
        : alternatePath.met
          ? alternatePath.reason
          : `Unlocked${unlockSource === 'streak' ? ' with a weekly-goal streak' : ''}${unlockedAt ? ` on ${unlockedAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : ''} — Candidate+ stays on once earned.`
      : `Need: ${missing.join(', ')}. (Or: a ${ALTERNATE_UNLOCK_SPRINT_STREAK_WEEKS}-week streak of meeting your weekly goal.)`

  return {
    unlocked,
    referencesMet,
    evidenceMet,
    effortMet,
    minutesMet,
    effortMinutes,
    effortTarget,
    alternatePath,
    completedReferenceCount,
    outreachCount,
    applicationCount,
    reason,
    unlockedAt,
    unlockSource,
    revoked: !!profile.candidatePlusRevokedAt,
  }
}

export type DossierLadderTier = 'LOCKED' | 'PREVIEW' | 'COMPLETE' | 'RECRUITER_INTROS' | 'UNPOSTED_ROLES'

// §7.6 — the full ladder. Dossier preview is deliberately cheap (2
// references + 1 assessment, resume fixes NOT required) — a candidate who
// clears it sees real corroborated content early, not a wall.
export async function getDossierLadderTier(candidateId: string): Promise<{ tier: DossierLadderTier; completeness: DossierCompleteness }> {
  const [completedReferenceCount, hasAnyAssessment, completeness, recentSprint] = await Promise.all([
    prisma.reference.count({ where: { candidateId, status: 'COMPLETED' } }),
    Promise.all([
      prisma.candidateAssessmentResponse.findFirst({ where: { candidateId }, select: { id: true } }),
      prisma.performanceAssessmentResponse.findFirst({ where: { candidateId }, select: { id: true } }),
      prisma.candidateProfile.findUnique({ where: { id: candidateId }, select: { skillsAssessmentCompletedAt: true } }),
    ]).then(([a, b, c]) => Boolean(a) || Boolean(b) || Boolean(c?.skillsAssessmentCompletedAt)),
    computeDossierCompleteness(candidateId),
    prisma.weeklySprint.findFirst({ where: { candidateId }, orderBy: { weekStartDate: 'desc' }, select: { weekStartDate: true, committedActions: true } }),
  ])

  const previewMet = completedReferenceCount >= 2 && hasAnyAssessment
  if (!completeness.isComplete) {
    return { tier: previewMet ? 'PREVIEW' : 'LOCKED', completeness }
  }

  // §7.6 "Unposted roles" — Dossier complete + currently active, defined
  // as a Sprint completed within the last 2 weeks.
  const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000
  const hasRecentCompletedSprintAction =
    recentSprint !== null &&
    recentSprint.weekStartDate.getTime() >= twoWeeksAgo &&
    ((recentSprint.committedActions as Array<{ completed?: boolean }> | null) ?? []).some((a) => a.completed)

  return { tier: hasRecentCompletedSprintAction ? 'UNPOSTED_ROLES' : 'RECRUITER_INTROS', completeness }
}

export interface ModuleGateStatus {
  key: string
  label: string
  unlocked: boolean
  reason: string // §7.10 — every lock states its reason in plain language
}

// §7.7 — the module gates with a clear, checkable unlock condition. Gates
// already enforced elsewhere via the established one-time-field convention
// (Gig Directory, My Marketing Plan, LinkedIn post generator, Work
// Samples, Network) are NOT duplicated here — this only covers the gates
// named in §7.7 that don't already have a live implementation to read
// from.
export async function getModuleGateStatus(candidateId: string): Promise<ModuleGateStatus[]> {
  const [sentReferenceCount, completedReferenceCount, ladder, gmailConnected, linkedIn, resolvedReviewerQuestionCount, sprintStreak] =
    await Promise.all([
      prisma.reference.count({ where: { candidateId } }), // any status — a request SENT, not necessarily returned
      prisma.reference.count({ where: { candidateId, status: 'COMPLETED' } }),
      getDossierLadderTier(candidateId),
      isGmailConnected(candidateId),
      prisma.candidateProfile.findUniqueOrThrow({
        where: { id: candidateId },
        select: { linkedinConnectionsImportedAt: true, linkedInConnection: { select: { disconnectedAt: true } } },
      }),
      prisma.reviewerQuestion.count({ where: { candidateId, candidateExplanation: { not: null } } }),
      computeCurrentSprintStreak(candidateId, 3),
    ])

  // §7.8 "any qualifying badge" — Cleaned Up / Asked / Known / Backed /
  // Consistent / Documented, same underlying signals as
  // milestone-badges.ts's CLEANED_UP/ASKED/KNOWN/BACKED/CONSISTENT/
  // DOCUMENTED (duplicated here rather than imported, to avoid a circular
  // import — milestone-badges.ts already depends on this module).
  // Connected (LinkedIn/Gmail) deliberately does NOT count (§7.8).
  const hasQualifyingBadge =
    resolvedReviewerQuestionCount > 0 ||
    sentReferenceCount > 0 ||
    completedReferenceCount > 0 ||
    sprintStreak >= 3 ||
    ladder.completeness.isComplete ||
    ladder.completeness.requirements.find((r) => r.key === 'profile')?.met === true

  return [
    {
      key: 'recruiterIntroductions',
      label: 'Recruiter introductions',
      unlocked: ladder.tier === 'RECRUITER_INTROS' || ladder.tier === 'UNPOSTED_ROLES',
      reason:
        ladder.tier === 'RECRUITER_INTROS' || ladder.tier === 'UNPOSTED_ROLES'
          ? 'Unlocked — your Dossier is complete.'
          : `Complete your Dossier to unlock (${ladder.completeness.metCount} of ${ladder.completeness.totalCount} done). A recruiter who receives a profile with no corroboration doesn't take the next one seriously — so we don't send them.`,
    },
    {
      key: 'unpostedRoles',
      label: 'Unposted roles',
      unlocked: ladder.tier === 'UNPOSTED_ROLES',
      reason:
        ladder.tier === 'UNPOSTED_ROLES'
          ? 'Unlocked — your Dossier is complete and you\'re actively searching.'
          : ladder.tier === 'RECRUITER_INTROS'
            ? 'Complete a Weekly Search Sprint in the last 2 weeks to unlock — this list is for active searchers.'
            : `Complete your Dossier to unlock (${ladder.completeness.metCount} of ${ladder.completeness.totalCount} done).`,
    },
    {
      key: 'community',
      label: 'Community',
      unlocked: hasQualifyingBadge,
      reason: hasQualifyingBadge
        ? 'Unlocked — you\'ve done real work here.'
        : 'Earn any qualifying badge to unlock (~8 min) — Connected (LinkedIn/Gmail) alone doesn\'t count.',
    },
    // While Google connect is off (until CASA, src/lib/google/connect-switch.ts) nothing waits on a connection, so this lock is not listed.
    ...(isGoogleConnectOn()
      ? [
          {
            key: 'linkedInGmailConnected',
            label: 'Your Network / Marketing Plan / My Contacts (one-click connect)',
            unlocked: isLinkedInConnected(linkedIn) || gmailConnected,
            reason:
              isLinkedInConnected(linkedIn) || gmailConnected
                ? 'Unlocked — LinkedIn or Gmail connected.'
                : 'Connect LinkedIn or Gmail to unlock (1 click).',
          },
        ]
      : []),
  ]
}

export interface ReportSlotStatus {
  key: string
  label: string
  unlocked: boolean
}

// §7.9 — report slot unlocks. Consumed by the §11 report rebuild.
export async function getReportSlotStatus(candidateId: string): Promise<ReportSlotStatus[]> {
  const [completedReferenceCount, hasOperatingProfile, hasPersonalityProfile, gmailConnected, linkedIn, jobsReviewedCount, outreachOrApplicationLogged, profileFieldsConfirmed, candidate] =
    await Promise.all([
      prisma.reference.count({ where: { candidateId, status: 'COMPLETED' } }),
      prisma.candidateAssessmentResponse.findFirst({ where: { candidateId }, select: { id: true } }),
      prisma.performanceAssessmentResponse.findFirst({ where: { candidateId }, select: { id: true } }),
      isGmailConnected(candidateId),
      prisma.candidateProfile.findUniqueOrThrow({ where: { id: candidateId }, select: { linkedinConnectionsImportedAt: true } }),
      prisma.surfacedJob.count({ where: { candidateId, reaction: { not: null } } }),
      Promise.all([
        prisma.outreachLog.count({ where: { candidateId } }),
        prisma.jobPosting.count({ where: { candidateId, appliedAt: { not: null } } }),
      ]).then(([o, a]) => o > 0 || a > 0),
      prisma.candidateProfile.findUniqueOrThrow({
        where: { id: candidateId },
        select: {
          profileConfirmedAt: true,
          industryConfirmedAt: true,
          functionConfirmedAt: true,
          salaryConfirmedAt: true,
          workAuthConfirmedAt: true,
          linkedInConfirmedAt: true,
        },
      }),
      prisma.candidateProfile.findUniqueOrThrow({ where: { id: candidateId }, select: { createdAt: true } }),
    ])

  const profileComplete =
    [
      profileFieldsConfirmed.profileConfirmedAt,
      profileFieldsConfirmed.industryConfirmedAt,
      profileFieldsConfirmed.functionConfirmedAt,
      profileFieldsConfirmed.salaryConfirmedAt,
      profileFieldsConfirmed.workAuthConfirmedAt,
      profileFieldsConfirmed.linkedInConfirmedAt,
    ].filter((v) => v !== null).length === 6

  const twoWeeksElapsed = Date.now() - candidate.createdAt.getTime() >= 14 * 24 * 60 * 60 * 1000

  return [
    { key: 'whatOthersSay', label: 'What others say about you', unlocked: completedReferenceCount >= DOSSIER_REFERENCE_TARGET },
    { key: 'howYouWork', label: 'How you work', unlocked: Boolean(hasOperatingProfile) && Boolean(hasPersonalityProfile) },
    {
      key: 'whoYouKnow',
      label: 'Who you already know',
      // Gmail counts toward this only while Google connect is on (src/lib/google/connect-switch.ts); the LinkedIn import is the part that matters.
      unlocked: Boolean(linkedIn.linkedinConnectionsImportedAt) && (gmailConnected || !isGoogleConnectOn()),
    },
    { key: 'whatYoureDrawnTo', label: "What you're drawn to", unlocked: jobsReviewedCount >= 5 },
    { key: 'howYourSearchConverts', label: 'How your search is converting', unlocked: gmailConnected || outreachOrApplicationLogged },
    { key: 'howYouCompare', label: 'How you compare', unlocked: profileComplete },
    { key: 'yourTrajectory', label: 'Your trajectory', unlocked: twoWeeksElapsed },
  ]
}
