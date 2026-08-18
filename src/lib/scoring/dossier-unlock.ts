// The complete unlock schema — Master Build Script §7. Governing principle
// (§7.1): gate on WORK DONE, never grade achieved — grade is partly a
// function of pedigree the candidate can't change, so gating on grade
// would lock out exactly who needs the platform most. Every check below
// reads real activity/data, never a score.
//
// This is a new, additive module — it does not touch the live six-category
// blended grade (dossier-competencies.ts) or its weekly-effort economy.

import 'server-only'
import { prisma } from '@/lib/prisma'
import { isGmailConnected } from '@/lib/dashboard/access-gate'
import { isLinkedInConnected } from '@/lib/dashboard/linkedin-connection'
import { computeCurrentSprintStreak } from '@/lib/scoring/market-reality/effort'
import type { SeniorityBand } from '@/lib/scoring/resume-analysis/types'

// §7.3 — band adjustment. Executive is told applications are lowest-yield
// (requiring 5 would contradict that advice), so it alone gets a lower
// application target and a higher outreach target. Early/Mid/Senior share
// one set — this groups differently from composite.ts's Early/Mid vs.
// Senior/Executive weighting split; that's intentional, not a copy-paste
// of the same grouping, since these are different axes (comp math vs.
// realistic outreach volume).
export const DOSSIER_REFERENCE_TARGET = 5
const OUTREACH_TARGET_BY_BAND: Record<SeniorityBand, number> = { EARLY: 15, MID: 15, SENIOR: 15, EXECUTIVE: 20 }
const APPLICATION_TARGET_BY_BAND: Record<SeniorityBand, number> = { EARLY: 5, MID: 5, SENIOR: 5, EXECUTIVE: 2 }
const DOSSIER_SPRINT_STREAK_TARGET = 4 // §7.2 item 7, "the grit test" — same cap as computeCurrentSprintStreak's default

// §7.4 — self-report intake for outreach/applications doesn't exist yet
// anywhere in the codebase (no numeric self-reported-history field on
// CandidateProfile; onboarding only captures qualitative buckets like
// "Under 10," and that onboarding rebuild is separate follow-up work,
// §10). Until that intake exists, this gate is platform-logged-count-only
// — stricter than the spec's "self-report can cover half," never more
// lenient, so it can't hand out false credit. Revisit once real
// self-reported counts exist to add the capped blend §7.4 describes.

async function getSeniorityBand(candidateId: string): Promise<SeniorityBand | null> {
  const analysis = await prisma.resumeAnalysis.findFirst({
    where: { candidateId },
    orderBy: { createdAt: 'desc' },
    select: { seniorityBand: true },
  })
  return (analysis?.seniorityBand as SeniorityBand | undefined) ?? null
}

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

// §7.2 — all seven required for Dossier complete.
export async function computeDossierCompleteness(candidateId: string): Promise<DossierCompleteness> {
  const band = (await getSeniorityBand(candidateId)) ?? 'MID' // unknown band defaults to the non-Executive target set — never assume the higher-target Executive band without evidence
  const outreachTarget = OUTREACH_TARGET_BY_BAND[band]
  const applicationTarget = APPLICATION_TARGET_BY_BAND[band]

  const [
    completedReferenceCount,
    profile,
    hasOperatingProfile,
    hasPersonalityProfile,
    outreachCount,
    applicationCount,
    sprintStreak,
  ] = await Promise.all([
    prisma.reference.count({ where: { candidateId, status: 'COMPLETED' } }),
    prisma.candidateProfile.findUniqueOrThrow({
      where: { id: candidateId },
      select: {
        skillsAssessmentCompletedAt: true,
        profileConfirmedAt: true,
        industryConfirmedAt: true,
        functionConfirmedAt: true,
        salaryConfirmedAt: true,
        workAuthConfirmedAt: true,
        linkedInConfirmedAt: true,
      },
    }),
    prisma.candidateAssessmentResponse.findFirst({ where: { candidateId }, select: { id: true } }),
    prisma.performanceAssessmentResponse.findFirst({ where: { candidateId }, select: { id: true } }),
    prisma.outreachLog.count({ where: { candidateId } }), // lifetime, no window — matches network/page.tsx's existing pattern
    prisma.jobPosting.count({ where: { candidateId, appliedAt: { not: null } } }), // lifetime, no window — matches application-trends.ts's existing pattern
    computeCurrentSprintStreak(candidateId, DOSSIER_SPRINT_STREAK_TARGET),
  ])

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

  const requirements: DossierRequirement[] = [
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
      met: Boolean(hasOperatingProfile) && Boolean(hasPersonalityProfile),
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
    {
      key: 'sprintStreak',
      label: `${DOSSIER_SPRINT_STREAK_TARGET} consecutive Weekly Search Sprints`,
      met: sprintStreak >= DOSSIER_SPRINT_STREAK_TARGET,
      current: sprintStreak,
      target: DOSSIER_SPRINT_STREAK_TARGET,
    },
  ]

  const metCount = requirements.filter((r) => r.met).length
  return { requirements, metCount, totalCount: requirements.length, isComplete: metCount === requirements.length }
}

// The real access gate — deliberately lighter than full Dossier
// completeness above. "Complete" (computeDossierCompleteness) is the
// aspirational, all-7-requirements checklist shown on the Portfolio page.
// "Unlocked" is the actual bar for every feature gate that used to check
// the old six-category letter grade (bounty claims, Exclusive Jobs,
// A-List postings, recruiter visibility, etc.) — real evidence and real
// effort, not a computed grade, per §7.1's governing principle.
export const DOSSIER_UNLOCK_REFERENCE_TARGET = 3
const DOSSIER_UNLOCK_OUTREACH_TARGET = 5
const DOSSIER_UNLOCK_APPLICATION_TARGET = 5

export interface DossierUnlockStatus {
  unlocked: boolean
  referencesMet: boolean
  evidenceMet: boolean // at least one of: Operating Profile, Personality Profile, Skills Assessment
  effortMet: boolean // outreach AND applications both at/above target
  completedReferenceCount: number
  outreachCount: number
  applicationCount: number
  reason: string // plain-language — states what's still missing, or confirms unlock
}

export async function isDossierUnlocked(candidateId: string): Promise<DossierUnlockStatus> {
  const [completedReferenceCount, hasOperatingProfile, hasPersonalityProfile, profile, outreachCount, applicationCount] =
    await Promise.all([
      prisma.reference.count({ where: { candidateId, status: 'COMPLETED' } }),
      prisma.candidateAssessmentResponse.findFirst({ where: { candidateId }, select: { id: true } }),
      prisma.performanceAssessmentResponse.findFirst({ where: { candidateId }, select: { id: true } }),
      prisma.candidateProfile.findUniqueOrThrow({ where: { id: candidateId }, select: { skillsAssessmentCompletedAt: true } }),
      prisma.outreachLog.count({ where: { candidateId } }), // lifetime, no window — matches computeDossierCompleteness's convention
      prisma.jobPosting.count({ where: { candidateId, appliedAt: { not: null } } }), // lifetime, no window
    ])

  const referencesMet = completedReferenceCount >= DOSSIER_UNLOCK_REFERENCE_TARGET
  const evidenceMet = Boolean(hasOperatingProfile) || Boolean(hasPersonalityProfile) || profile.skillsAssessmentCompletedAt !== null
  const effortMet = outreachCount >= DOSSIER_UNLOCK_OUTREACH_TARGET && applicationCount >= DOSSIER_UNLOCK_APPLICATION_TARGET
  const unlocked = referencesMet && evidenceMet && effortMet

  const missing: string[] = []
  if (!referencesMet) {
    const remaining = DOSSIER_UNLOCK_REFERENCE_TARGET - completedReferenceCount
    missing.push(`${remaining} more completed reference${remaining === 1 ? '' : 's'}`)
  }
  if (!evidenceMet) missing.push('one completed assessment (Operating Profile, Personality Profile, or Skills)')
  if (!effortMet) {
    const missingOutreach = Math.max(0, DOSSIER_UNLOCK_OUTREACH_TARGET - outreachCount)
    const missingApplications = Math.max(0, DOSSIER_UNLOCK_APPLICATION_TARGET - applicationCount)
    if (missingOutreach > 0) missing.push(`${missingOutreach} more outreach message${missingOutreach === 1 ? '' : 's'}`)
    if (missingApplications > 0) missing.push(`${missingApplications} more application${missingApplications === 1 ? '' : 's'}`)
  }

  const reason = unlocked
    ? 'Unlocked — you have real references, evidence, and effort on file.'
    : `Need: ${missing.join(', ')}.`

  return { unlocked, referencesMet, evidenceMet, effortMet, completedReferenceCount, outreachCount, applicationCount, reason }
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
      key: 'matchedJobsFullDetail',
      label: 'Matched jobs full detail / apply',
      unlocked: sentReferenceCount >= 1,
      reason: sentReferenceCount >= 1 ? 'Unlocked — you sent a reference request.' : 'Send 1 reference request to unlock (~5 min).',
    },
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
      unlocked: Boolean(linkedIn.linkedinConnectionsImportedAt) && gmailConnected,
    },
    { key: 'whatYoureDrawnTo', label: "What you're drawn to", unlocked: jobsReviewedCount >= 5 },
    { key: 'howYourSearchConverts', label: 'How your search is converting', unlocked: gmailConnected || outreachOrApplicationLogged },
    { key: 'howYouCompare', label: 'How you compare', unlocked: profileComplete },
    { key: 'yourTrajectory', label: 'Your trajectory', unlocked: twoWeeksElapsed },
  ]
}
