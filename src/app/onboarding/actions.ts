'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { ensureUser } from '@/lib/auth/ensure-user'
import { Prisma, type GapDurationBucket, type NetworkComfortLevel } from '@prisma/client'
import {
  CURRENT_ASSESSMENT_ROTATION_GROUP,
  GAP_DURATION_LABELS,
  SITUATION_TO_JOB_STATUS,
  type SituationKey,
} from '@/lib/constants/onboarding'
import { defaultConfidentialSearchMode } from '@/lib/confidential-mode'
import {
  computeDimensionVectors,
  computeInconsistency,
  translateDimensionVectors,
} from '@/lib/scoring/assessment-vectors'
import { computeWorkStyleVectors, translateWorkStyleVectors } from '@/lib/scoring/work-style-vectors'
import { syncReferenceDelta } from '@/lib/scoring/reference-delta'
import { captureServerEvent } from '@/lib/posthog/server'
import { autoPopulateFirstSprint } from '@/lib/weekly/sprint'
import {
  getCoachTemplate,
  hasSubmittedCoachingOnboardingForm,
  submitCoachingOnboardingForm,
  validateAnswers,
  type CoachingOnboardingAnswers,
} from '@/lib/coach/onboarding-form'

export type FormState = { error?: string } | undefined

async function requireCandidateId() {
  const supabase = await createClient()
  // Your Path is now the first onboarding step a session-less visitor can
  // reach (see #938 reorder) — lazily start an anonymous session here too,
  // same as the resume upload always has, rather than redirecting away.
  const user = await ensureUser(supabase)

  // A coach's personal invite link stashes this cookie before handing off
  // to onboarding (see /api/coach-invite/[token]/route.ts) — read it at
  // whichever action creates the profile first, since that's now no longer
  // always the resume upload. getOrCreateCandidateProfile only consumes
  // `links` on the actual create, so this is a harmless no-op on every
  // subsequent call for the same candidate.
  const cookieStore = await cookies()
  const coachId = cookieStore.get('nc_coach')?.value

  const profile = await getOrCreateCandidateProfile(user.id, { coachId })
  return profile.id
}

// The only real question in the pre-account assessment. Also finishes it
// outright — there's nothing left to collect before the initial grade can
// compute (the Experience/Goals/Circumstances steps were all removed over
// time; their content now lives on Skills & Behavioral Assessments and
// Search Strategy, both hard-gated immediately after this in the new
// candidate flow — see #929/#930). gapDuration/jobSearchDifficultyLevel/
// biggestBarriers moved to Search Strategy and Blockers and Motivations —
// deliberately left null here rather than asked twice; the score-reveal
// page already frames the initial grade as rough until those are answered.
export async function updateSituation(_prevState: FormState, formData: FormData): Promise<FormState> {
  const candidateId = await requireCandidateId()

  const situation = formData.get('situation') as SituationKey | null

  if (!situation || !(situation in SITUATION_TO_JOB_STATUS)) {
    return { error: 'Please choose the option that best describes you.' }
  }

  // Confidential Search Mode's onboarding default — set here, in the same
  // write as currentJobStatus, since this is the one place that value gets
  // finalized. See src/lib/confidential-mode.ts for the persona-mapping
  // rationale (lossy — no real 4-value persona field exists yet).
  const jobStatus = SITUATION_TO_JOB_STATUS[situation]
  const confidentialSearchMode = defaultConfidentialSearchMode(jobStatus)

  try {
    await prisma.$transaction([
      prisma.candidateProfile.update({
        where: { id: candidateId },
        data: {
          currentJobStatus: jobStatus,
          desireComplete: true,
          part1Complete: true,
          part3Complete: true,
          part4Complete: true,
          assessmentComplete: true,
          assessmentCompletedAt: new Date(),
          confidentialSearchMode,
          confidentialSearchModeChangedAt: new Date(),
          // §11 "persona changed" trigger baseline (src/lib/dashboard/
          // passive-to-active-prompt.ts) — only meaningful while the mode
          // is actually on, so left untouched (stays null) when it isn't.
          ...(confidentialSearchMode ? { confidentialModeEnteredJobStatus: jobStatus } : {}),
        },
      }),
      prisma.confidentialModeChangeLog.create({
        data: { candidateId, enabled: confidentialSearchMode, source: 'ONBOARDING_DEFAULT' },
      }),
    ])
  } catch {
    return { error: 'Something went wrong saving your answer. Please try again.' }
  }

  captureServerEvent(candidateId, 'onboarding_started')

  revalidatePath('/onboarding', 'layout')
  // resume/page.tsx's own already-complete guard forwards on to /onboarding/contract
  // if this candidate already finished the resume step (e.g. re-visiting).
  redirect('/onboarding/resume')
}

// Screen 1 of 4 (Master Build Script §10) — confirm what the resume parse
// already extracted, before anything else is asked. Writes straight to the
// same fields the post-registration Search Strategy/complete-profile pages
// read (highestLevelReached, primaryFunction, industryContext,
// targetRoleType, targetIndustries) — per the user's explicit "reuse
// existing fields where safe" call on the product-reversal question, a
// candidate who confirms here is never asked the identical question again
// after registration (those pages only prompt when the field is still null).
export async function updateResumeConfirm(_prevState: FormState, formData: FormData): Promise<FormState> {
  const candidateId = await requireCandidateId()

  const highestLevelReached = formData.get('highestLevelReached') as string | null
  const primaryFunction = formData.get('primaryFunction') as string | null
  const targetRoleType = (formData.get('targetRoleType') as string | null)?.trim() || null
  // Candidate now enters one merged list of industries — the first tag
  // doubles as industryContext (the single "background industry" string
  // several downstream consumers, e.g. Community industry grouping, still
  // read), while the full list becomes targetIndustries.
  const targetIndustries = formData.getAll('industries').map(String).filter(Boolean)
  const industryContext = targetIndustries[0] ?? null

  if (!highestLevelReached || !primaryFunction) {
    return { error: 'Please confirm your level and function before continuing.' }
  }

  await prisma.candidateProfile.update({
    where: { id: candidateId },
    data: {
      highestLevelReached,
      primaryFunction,
      industryContext,
      targetRoleType,
      targetIndustries,
      onboardingResumeConfirmedAt: new Date(),
    },
  })

  revalidatePath('/onboarding', 'layout')
  redirect('/onboarding/location')
}

// Converts an exact application count into the same bucket vocabulary the
// dashboard Search Strategy page's jobsAppliedBucket already uses — that
// field has several live consumers (weekly action verification, profile
// checklist, suggested actions) that only ever check it for null vs.
// non-null, so writing a derived bucket here keeps them working unchanged
// while letting onboarding itself ask for a precise number instead of a
// bucket, per the "we already answered this, don't ask twice with worse
// precision" fix.
function deriveJobsAppliedBucket(count: number): '0-20' | '20-100' | '100+' {
  if (count <= 20) return '0-20'
  if (count <= 100) return '20-100'
  return '100+'
}

// Screen 2 of 4 — where they're searching from and willing to go. Same
// reuse-existing-field logic as updateResumeConfirm above.
// Screen 2 of 3 — combines what were originally two separate screens
// (location, then a follow-up "where are you in your search" screen) into
// one page: both are short, thematically adjacent ("where you're searching
// from and how far along you are"), and splitting them cost an extra click
// with no benefit. Both onboardingLocationConfirmedAt and
// onboardingSearchStatusConfirmedAt are set together so onboarding/page.tsx's
// redirect chain and comfort/page.tsx's own guard keep working unchanged.
//
// Applications/interviews are asked here as exact numbers (not buckets) and
// written straight into jobsAppliedBucket (derived) / interviewsReceivedCount
// — the same fields the dashboard Search Strategy page's "Your Search
// Strategy So Far" card used to ask again. That duplicate ask was removed
// from OptionalQuestionsForm; this is now the only place these get asked.
export async function updateLocationAndSearchStatus(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const candidateId = await requireCandidateId()

  const currentCity = (formData.get('currentCity') as string | null)?.trim() || null
  const currentState = (formData.get('currentState') as string | null)?.trim() || null
  const remotePreference = formData.get('remotePreference') as string | null
  const openToRelocation = formData.get('openToRelocation') === 'on'
  const relocationNotes = (formData.get('relocationNotes') as string | null)?.trim() || null

  const justStartedSearch = formData.get('justStartedSearch') === 'on'
  const gapDuration = formData.get('gapDuration') as string | null
  const jobsAppliedCountRaw = formData.get('jobsAppliedCount')
  const interviewsCountRaw = formData.get('interviewsCount')
  const jobsAppliedCount = justStartedSearch ? 0 : jobsAppliedCountRaw ? Number(jobsAppliedCountRaw) : null
  const interviewsCount = justStartedSearch ? 0 : interviewsCountRaw ? Number(interviewsCountRaw) : null

  if (!remotePreference) {
    return { error: 'Please tell us your work-location preference before continuing.' }
  }
  if (!gapDuration || !(gapDuration in GAP_DURATION_LABELS)) {
    return { error: 'Please tell us how long you have been searching before continuing.' }
  }
  if (!justStartedSearch && (jobsAppliedCount === null || interviewsCount === null)) {
    return { error: 'Please answer both search-status questions, or check "I just started" above.' }
  }

  const now = new Date()
  await prisma.candidateProfile.update({
    where: { id: candidateId },
    data: {
      currentCity,
      currentState,
      remotePreference,
      openToRelocation,
      relocationNotes: openToRelocation ? relocationNotes : null,
      onboardingLocationConfirmedAt: now,
      justStartedSearch,
      gapDuration: gapDuration as GapDurationBucket,
      jobsAppliedBucket: deriveJobsAppliedBucket(jobsAppliedCount as number),
      interviewsReceivedCount: interviewsCount,
      onboardingSearchStatusConfirmedAt: now,
    },
  })

  revalidatePath('/onboarding', 'layout')
  redirect('/onboarding/comfort')
}

// Screen 4 of 4 — the last question before the contract screen. Writes
// straight to networkComfortLevel, the same field the post-registration
// Activate My Network gate (NetworkComfortCheck) reads — answering here
// means that dashboard prompt never shows (network/page.tsx only renders it
// when the field is still null). networkComfortBonusAt is marked spent at
// the same time: the +5pt sprint credit that gate normally pays out has
// nothing to credit against pre-registration (no Weekly Sprint exists yet),
// so this is the same "answered but no sprint to log points against" best-
// effort case documented on setNetworkComfortLevel, just reached from a
// different entry point.
const NETWORK_COMFORT_LEVELS: NetworkComfortLevel[] = [
  'VERY_COMFORTABLE',
  'SOMEWHAT_COMFORTABLE',
  'NOT_VERY_COMFORTABLE',
  'RATHER_NOT',
]

export async function updateComfort(_prevState: FormState, formData: FormData): Promise<FormState> {
  const candidateId = await requireCandidateId()

  const networkComfortLevel = formData.get('networkComfortLevel') as string | null
  if (!networkComfortLevel || !NETWORK_COMFORT_LEVELS.includes(networkComfortLevel as NetworkComfortLevel)) {
    return { error: 'Please choose the option that best describes you.' }
  }

  await prisma.candidateProfile.update({
    where: { id: candidateId },
    data: {
      networkComfortLevel: networkComfortLevel as NetworkComfortLevel,
      networkComfortBonusAt: new Date(),
      onboardingComfortConfirmedAt: new Date(),
    },
  })

  revalidatePath('/onboarding', 'layout')
  redirect('/onboarding/contract')
}

// The contract screen is the last question before the score reveal. "Not
// right now" still records that the candidate saw the contract (so we know
// they've been through this screen), just without accepting it — they
// continue at a lower assumed intensity rather than being blocked. The
// notification-preference question that used to live on this screen now
// lives only on the Privacy page (NotificationTierSelector) — candidates
// keep the schema default (FULL) until they choose otherwise there.
export async function submitContract(_prevState: FormState, formData: FormData): Promise<FormState> {
  const candidateId = await requireCandidateId()

  const intent = formData.get('intent') === 'accept' ? 'accept' : 'decline'

  await prisma.candidateProfile.update({
    where: { id: candidateId },
    data: {
      contractAccepted: intent === 'accept',
      contractAcceptedAt: new Date(),
    },
  })

  revalidatePath('/onboarding', 'layout')
  redirect('/onboarding/score')
}

// The last onboarding gate, shown once registration is complete (see
// getDashboardData) — explains how NextChapter works, the payoff, and what
// it expects in return, then locks in with a real timestamp. Backs the
// 5-point welcome bonus folded into the candidate's first Search Sprint
// (see INTRO_WELCOME_BONUS_POINTS in lib/weekly/sprint.ts) — real and
// one-time, not a self-report toggle.
export async function submitIntroCommitment(): Promise<void> {
  const candidateId = await requireCandidateId()

  await prisma.candidateProfile.update({
    where: { id: candidateId },
    data: { introCommittedAt: new Date() },
  })

  // Best-effort — a failure here should never block the redirect to
  // dashboard; worst case they land on the pre-existing empty-sprint state
  // and can still set goals manually.
  let firstSprintPopulated = false
  try {
    firstSprintPopulated = !!(await autoPopulateFirstSprint(candidateId))
  } catch (error) {
    console.error('Failed to auto-populate first Weekly Search Sprint:', error)
  }

  captureServerEvent(candidateId, 'onboarding_intro_committed', { firstSprintPopulated })

  revalidatePath('/onboarding', 'layout')
  revalidatePath('/dashboard')
  redirect('/dashboard')
}

export async function updateAssessment(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const candidateId = await requireCandidateId()

  const [activeBlocks, activeItems] = await Promise.all([
    prisma.quadBlock.findMany({
      where: { rotationGroup: CURRENT_ASSESSMENT_ROTATION_GROUP, isActive: true },
      include: { statements: true },
    }),
    prisma.likertItem.findMany({
      where: { rotationGroup: CURRENT_ASSESSMENT_ROTATION_GROUP, isActive: true },
    }),
  ])

  // The Assessment Layer rebuild (spec Part 2) cuts quad-blocks entirely —
  // ipsative quad+Likert data can't be compared self-to-reference, which is
  // the whole point of the self-vs-reference friction feature. A frozen
  // rotation seeded with zero QuadBlock rows (see how-i-work-best-items.ts)
  // is a Likert-only, 4-point-scale instrument scored by a different pure
  // function. Older rotations that do have quad blocks keep working exactly
  // as before — this is the one place the two paths fork.
  const isLikertOnlyRotation = activeBlocks.length === 0

  const blockIds = formData.getAll('quadBlockId').map(String)
  const leastLikeMeIds = formData.getAll('quadLeastLikeMe').map(String)

  if (blockIds.length !== activeBlocks.length || leastLikeMeIds.length !== activeBlocks.length) {
    return { error: 'Please answer every block before continuing.' }
  }

  const quadResponses = blockIds.map((blockId, i) => ({
    blockId,
    leastLikeMe: leastLikeMeIds[i],
  }))

  const maxScore = isLikertOnlyRotation ? 4 : 5
  const likertResponses: { itemId: string; score: number }[] = []
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith('likertScore-')) continue
    const score = Number(value)
    if (!Number.isInteger(score) || score < 1 || score > maxScore) {
      return { error: 'Invalid response received.' }
    }
    likertResponses.push({ itemId: key.slice('likertScore-'.length), score })
  }

  if (likertResponses.length !== activeItems.length) {
    return { error: 'Please answer every statement before continuing.' }
  }

  const quadStatements = activeBlocks.flatMap((block) => block.statements)

  let dimensionVectors: Record<string, number>
  let translatedOutput: Record<string, string>
  let inconsistencyScore: number
  let inconsistencyPairs: unknown[]
  let manipulationRiskFlag: boolean
  let flagThreshold: number | undefined

  if (isLikertOnlyRotation) {
    const workStyleResponses = likertResponses.map((r) => ({
      itemId: Number(r.itemId),
      score: r.score as 1 | 2 | 3 | 4,
    }))
    dimensionVectors = computeWorkStyleVectors(workStyleResponses)
    translatedOutput = translateWorkStyleVectors(dimensionVectors)
    // No quad-block cross-validation source exists for this rotation, so
    // there's nothing to diff against — inconsistency detection is simply
    // unavailable here, not zeroed-out-as-if-checked.
    inconsistencyScore = 0
    inconsistencyPairs = []
    manipulationRiskFlag = false
    flagThreshold = undefined
  } else {
    const legacyVectors = computeDimensionVectors(quadResponses, quadStatements, likertResponses, activeItems)
    dimensionVectors = legacyVectors
    translatedOutput = translateDimensionVectors(legacyVectors)
    const inconsistency = computeInconsistency(quadResponses, likertResponses, quadStatements, activeItems)
    inconsistencyScore = inconsistency.inconsistencyScore
    inconsistencyPairs = inconsistency.inconsistencyPairs
    manipulationRiskFlag = inconsistency.manipulationRiskFlag
    flagThreshold = inconsistency.flagThreshold
  }

  try {
    await prisma.$transaction([
      prisma.candidateAssessmentResponse.create({
        data: {
          candidateId,
          quadResponses: quadResponses as unknown as Prisma.InputJsonValue,
          likertResponses: likertResponses as unknown as Prisma.InputJsonValue,
          dimensionVectors: dimensionVectors as unknown as Prisma.InputJsonValue,
          inconsistencyScore,
          inconsistencyPairs: inconsistencyPairs as unknown as Prisma.InputJsonValue,
          manipulationRiskFlag,
          flagThreshold,
        },
      }),
      prisma.assessmentResult.create({
        data: {
          candidateId,
          assessmentType: 'work_style',
          rawScores: { quadResponses, likertResponses } as unknown as Prisma.InputJsonValue,
          translatedOutput: translatedOutput as unknown as Prisma.InputJsonValue,
        },
      }),
      prisma.candidateProfile.update({
        where: { id: candidateId },
        data: { part2Complete: true },
      }),
    ])
  } catch {
    return { error: 'Something went wrong saving your answers. Please try again.' }
  }

  // Covers the case where references were already completed (with BARS
  // ratings) before the candidate finished their own assessment. Must never
  // block onboarding — same defensive pattern as reference-request email.
  try {
    await syncReferenceDelta(candidateId)
  } catch (error) {
    console.error('Failed to sync reference delta after assessment completion:', error)
  }

  captureServerEvent(candidateId, 'onboarding_part_complete', { part: 2 })

  // No longer part of the mandatory onboarding chain — reachable any time as
  // an optional dashboard action-plan item, so send them back there rather
  // than assuming they were mid-onboarding.
  revalidatePath('/onboarding', 'layout')
  revalidatePath('/dashboard')
  redirect('/dashboard')
}

// Mandatory, specific consent gate (Prompt 54) — being assigned a coachId
// via the invite-link cookie is NOT sufficient on its own for that coach to
// see the candidate's Executive Dossier or Coaching Notes. This is the one
// place coachDossierConsentedAt is ever set to a non-null value; every
// coach-facing read path checks it explicitly before rendering anything.
export async function submitCoachConsent(intent: 'agree' | 'not_now'): Promise<void> {
  const candidateId = await requireCandidateId()

  if (intent === 'agree') {
    await prisma.candidateProfile.update({
      where: { id: candidateId },
      data: { coachDossierConsentedAt: new Date() },
    })
    captureServerEvent(candidateId, 'coach_dossier_consent_granted')
  } else {
    captureServerEvent(candidateId, 'coach_dossier_consent_deferred')
  }

  revalidatePath('/onboarding', 'layout')
  redirect(intent === 'agree' ? '/onboarding/coaching-form' : '/onboarding/score')
}

// Prompt 60 — the candidate-completed Coaching Onboarding Form. Only
// reachable once coachDossierConsentedAt is set (see submitCoachConsent
// above); answers feed Coaching Notes and the Pre-Session Brief, never the
// external Executive Dossier.
export async function submitCoachingOnboardingFormOnboarding(
  answers: CoachingOnboardingAnswers
): Promise<{ error?: string } | void> {
  const candidateId = await requireCandidateId()
  const profile = await prisma.candidateProfile.findUniqueOrThrow({
    where: { id: candidateId },
    select: { coachId: true, coachDossierConsentedAt: true },
  })
  if (!profile.coachId || !profile.coachDossierConsentedAt) {
    redirect('/onboarding')
  }
  if (await hasSubmittedCoachingOnboardingForm(candidateId)) {
    redirect('/onboarding/score')
  }

  const template = await getCoachTemplate(profile.coachId)
  const errors = validateAnswers(template, answers)
  if (errors.length > 0) {
    return { error: 'Please answer every required question before continuing.' }
  }

  await submitCoachingOnboardingForm(candidateId, profile.coachId, answers)
  captureServerEvent(candidateId, 'coaching_onboarding_form_submitted', { source: 'onboarding' })

  revalidatePath('/onboarding', 'layout')
  redirect('/onboarding/score')
}
