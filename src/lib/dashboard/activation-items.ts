import 'server-only'
import { prisma } from '@/lib/prisma'
import { isGmailConnected } from '@/lib/dashboard/access-gate'
import { isSearchGoalsComplete, isBlockersAndMotivationsComplete } from '@/lib/search-strategy'
import { DOSSIER_REFERENCE_TARGET } from '@/lib/scoring/dossier-unlock'
import { captureServerEvent } from '@/lib/posthog/server'

// Master Build Script §12 — the Unified dashboard's four activation items,
// always at top and never locked, plus the three "always unlocked" items
// that require no prior step and no other person. See
// docs/specs/NextChapter_PHASE2_MASTER_SCRIPT.md §12 for the source spec.
export interface ActivationItem {
  key: string
  label: string
  estimatedMinutes: number
  complete: boolean
  href: string
}

export interface ActivationItemsResult {
  activationItems: ActivationItem[]
  alwaysUnlockedItems: ActivationItem[]
  allActivationComplete: boolean
}

// §12 — one dashboard, one activation checklist. Every completion check
// here reuses an existing, live signal (see access-gate.ts and
// dossier-unlock.ts) rather than inventing a new one, with the sole
// exception of resumeFixesAppliedKeys (new, additive CandidateProfile
// field — see schema.prisma and dashboard/resume/actions.ts).
export async function getActivationItems(candidateId: string): Promise<ActivationItemsResult> {
  const [profile, gmailConnected, sentReferenceCount, hasPersonalityProfile] = await Promise.all([
    prisma.candidateProfile.findUniqueOrThrow({
      where: { id: candidateId },
      select: {
        resumeFixesAppliedKeys: true,
        targetRoleType: true,
        primaryFunction: true,
        targetIndustries: true,
        targetCompanySize: true,
        targetCompanyStage: true,
        remotePreference: true,
        highestLevelReached: true,
        blockers: true,
        motivations: true,
        coachingStylePreference: true,
        changePacePreference: true,
        changeReadiness: true,
        linkedinConnectionsImportedAt: true,
        // Set in onboarding/actions.ts, before account creation — see
        // getDashboardData's own redirect, which guarantees this is
        // already true for every candidate who can reach this code. This
        // "always unlocked" item therefore reads as already-complete from
        // day one, same as the spec's "so day one isn't a wall of locks."
        assessmentComplete: true,
      },
    }),
    isGmailConnected(candidateId),
    // Any status — this activation item is about requests SENT, not
    // returned/completed. Do not confuse with completedReferencesCount
    // elsewhere in this codebase, which counts only COMPLETED references.
    prisma.reference.count({ where: { candidateId } }),
    prisma.performanceAssessmentResponse.findFirst({ where: { candidateId }, select: { id: true } }),
  ])

  const linkedInConnected = profile.linkedinConnectionsImportedAt !== null
  const searchStrategyQuestionsComplete =
    isSearchGoalsComplete(profile) && isBlockersAndMotivationsComplete(profile)

  const activationItems: ActivationItem[] = [
    {
      key: 'resumeFixes',
      label: 'Fix three things on your resume',
      estimatedMinutes: 20,
      complete: profile.resumeFixesAppliedKeys.length >= 3,
      href: '/dashboard/resume',
    },
    {
      key: 'references',
      label: 'Send five reference requests',
      estimatedMinutes: 5,
      complete: sentReferenceCount >= DOSSIER_REFERENCE_TARGET,
      href: '/dashboard/references',
    },
    {
      key: 'connectAccounts',
      label: 'Connect LinkedIn and Gmail',
      // Not really "minutes" (§12 spec: "1 click") — ActivationChecklistCard
      // special-cases this key to display "1 click" instead of "N min".
      estimatedMinutes: 1,
      complete: linkedInConnected && gmailConnected,
      href: '/dashboard/network',
    },
    {
      key: 'searchStrategyQuestions',
      label: 'Two quick question sets',
      estimatedMinutes: 5,
      complete: searchStrategyQuestionsComplete,
      href: '/dashboard/search-strategy',
    },
  ]

  const alwaysUnlockedItems: ActivationItem[] = [
    {
      key: 'operatingProfile',
      label: 'Complete your Operating Profile',
      estimatedMinutes: 12,
      complete: profile.assessmentComplete,
      href: '/dashboard/retake-assessment',
    },
    {
      key: 'personalityProfile',
      label: 'Complete your Personality Profile',
      estimatedMinutes: 9,
      complete: Boolean(hasPersonalityProfile),
      href: '/dashboard/how-i-perform',
    },
    {
      key: 'marketRealityReport',
      label: 'Review your Market Reality Report',
      // No time estimate given in §12, and no "reviewed" signal exists in
      // the schema to gate completion on (unlike the two assessments
      // above) — left at 0 (hidden) rather than fabricating either. See
      // final report for this judgment call.
      estimatedMinutes: 0,
      complete: false,
      href: '/dashboard/market-reality',
    },
  ]

  const allActivationComplete = activationItems.every((item) => item.complete)

  return { activationItems, alwaysUnlockedItems, allActivationComplete }
}

// Fires 'activation_checklist_completed' the first time (and only the
// first time) all four activation items are observed complete for a
// candidate. Every dashboard load after completion would otherwise
// re-observe allActivationComplete === true and re-fire this event on
// every single page view forever — a real, unbounded double-fire, not a
// one-off — so a "have we already sent this" check is load-bearing here,
// not overbuilt caution. Reuses the AnalyticsEvent table
// captureServerEvent already mirrors every event into (see
// src/lib/posthog/server.ts) as that check, rather than adding a new
// CandidateProfile timestamp field for a single one-time signal.
export async function recordActivationChecklistCompletedOnce(candidateId: string): Promise<void> {
  const alreadyFired = await prisma.analyticsEvent.findFirst({
    where: { distinctId: candidateId, event: 'activation_checklist_completed' },
    select: { id: true },
  })
  if (alreadyFired) return
  captureServerEvent(candidateId, 'activation_checklist_completed', { candidateId })
}
