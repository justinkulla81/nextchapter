'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import {
  Prisma,
  NotificationTier,
  type CurrentJobStatus,
  type GapDurationBucket,
  type SearchIntensity,
  type PublicDisclosureComfort,
  type ReferralRecency,
} from '@prisma/client'
import {
  TRADEOFF_PRIORITIES,
  CURRENT_ASSESSMENT_ROTATION_GROUP,
  SITUATION_TO_JOB_STATUS,
  type SituationKey,
} from '@/lib/constants/onboarding'
import {
  computeDimensionVectors,
  computeInconsistency,
  translateDimensionVectors,
} from '@/lib/scoring/assessment-vectors'
import { syncReferenceDelta } from '@/lib/scoring/reference-delta'
import { captureServerEvent } from '@/lib/posthog/server'

export type FormState = { error?: string } | undefined

async function requireCandidateId() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/onboarding/resume')
  }

  const profile = await getOrCreateCandidateProfile(user.id)
  return profile.id
}

export async function updateSituation(_prevState: FormState, formData: FormData): Promise<FormState> {
  const candidateId = await requireCandidateId()

  const situation = formData.get('situation') as SituationKey | null

  if (!situation || !(situation in SITUATION_TO_JOB_STATUS)) {
    return { error: 'Please choose the option that best describes you.' }
  }

  try {
    await prisma.candidateProfile.update({
      where: { id: candidateId },
      data: { currentJobStatus: SITUATION_TO_JOB_STATUS[situation], desireComplete: true },
    })
  } catch {
    return { error: 'Something went wrong saving your answer. Please try again.' }
  }

  captureServerEvent(candidateId, 'onboarding_started')

  revalidatePath('/onboarding', 'layout')
  redirect('/onboarding/circumstances')
}

export async function updateCircumstances(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const candidateId = await requireCandidateId()

  const currentJobStatus = formData.get('currentJobStatus') as CurrentJobStatus | null

  if (!currentJobStatus) {
    return { error: 'Please answer all required questions.' }
  }

  const isNewGrad = currentJobStatus === 'NEW_GRADUATE_FIRST_JOB'
  const gapDurationRequired = currentJobStatus !== 'EMPLOYED_CONSIDERING_MOVE' && !isNewGrad
  const gapDurationRaw = (formData.get('gapDuration') as string) || null

  if (gapDurationRequired && !gapDurationRaw) {
    return { error: 'Please answer all required questions.' }
  }

  const gapDuration = isNewGrad
    ? 'ZERO_TO_THREE_MONTHS'
    : currentJobStatus === 'EMPLOYED_CONSIDERING_MOVE'
      ? null
      : (gapDurationRaw as GapDurationBucket)

  const jobSearchDifficultyRaw = formData.get('jobSearchDifficultyLevel')
  const jobSearchDifficultyLevel = jobSearchDifficultyRaw ? Number(jobSearchDifficultyRaw) : null
  const biggestBarriers = formData.getAll('biggestBarriers').map(String)
  const searchIntensityRaw = (formData.get('searchIntensity') as string) || null
  const searchIntensity = searchIntensityRaw as SearchIntensity | null

  // Job search activity self-report — every field here is optional.
  const jobsAppliedBucket = (formData.get('jobsAppliedBucket') as string) || null
  const interviewsReceivedRaw = formData.get('interviewsReceivedCount')
  const interviewsReceivedCount = interviewsReceivedRaw ? Number(interviewsReceivedRaw) : null
  const networkingLevelRaw = formData.get('networkingLevel')
  const networkingLevel = networkingLevelRaw ? Number(networkingLevelRaw) : null
  const learnedNewSkillsLevelRaw = formData.get('learnedNewSkillsLevel')
  const learnedNewSkillsLevel = learnedNewSkillsLevelRaw ? Number(learnedNewSkillsLevelRaw) : null
  const triedPartTimeOrConsultingRaw = formData.get('triedPartTimeOrConsulting') as string | null
  const triedPartTimeOrConsulting =
    triedPartTimeOrConsultingRaw === 'yes' ? true : triedPartTimeOrConsultingRaw === 'no' ? false : null
  const triedExecutiveCoachingRaw = formData.get('triedExecutiveCoaching') as string | null
  const triedExecutiveCoaching =
    triedExecutiveCoachingRaw === 'yes' ? true : triedExecutiveCoachingRaw === 'no' ? false : null
  const connectedWithRecruitersRaw = formData.get('connectedWithRecruiters') as string | null
  const connectedWithRecruiters =
    connectedWithRecruitersRaw === 'yes' ? true : connectedWithRecruitersRaw === 'no' ? false : null
  const recruiterConnectionCountRaw = formData.get('recruiterConnectionCount')
  const recruiterConnectionCount =
    connectedWithRecruiters && recruiterConnectionCountRaw ? Number(recruiterConnectionCountRaw) : null

  try {
    await prisma.candidateProfile.update({
      where: { id: candidateId },
      data: {
        currentJobStatus,
        gapDuration,
        jobSearchDifficultyLevel,
        biggestBarriers,
        searchIntensity,
        jobsAppliedBucket,
        interviewsReceivedCount,
        networkingLevel,
        learnedNewSkillsLevel,
        triedPartTimeOrConsulting,
        triedExecutiveCoaching,
        connectedWithRecruiters,
        recruiterConnectionCount,
        part1Complete: true,
      },
    })
  } catch {
    return { error: 'Something went wrong saving your answers. Please try again.' }
  }

  captureServerEvent(candidateId, 'onboarding_part_complete', { part: 1 })

  revalidatePath('/onboarding', 'layout')
  redirect('/onboarding/experience')
}

// The contract screen is the last question before the score reveal — both
// the commitment choice and the notification-preference question below it
// submit together in one form, distinguished by which button was clicked
// ("intent"). "Not right now" still records that the candidate saw the
// contract (so we know they've been through this screen), just without
// accepting it — they continue at a lower assumed intensity rather than
// being blocked.
export async function submitContract(_prevState: FormState, formData: FormData): Promise<FormState> {
  const candidateId = await requireCandidateId()

  const intent = formData.get('intent') === 'accept' ? 'accept' : 'decline'
  const notificationTier = formData.get('notificationTier') as NotificationTier | null
  if (!notificationTier || !Object.values(NotificationTier).includes(notificationTier)) {
    return { error: 'Choose how much you want to be nudged before continuing.' }
  }

  const smsConsent = formData.get('smsConsent') === 'on'
  const smsPhone = (formData.get('smsPhone') as string | null)?.trim() || null

  if (notificationTier === 'FULL' && smsConsent && !smsPhone) {
    return { error: 'Enter a mobile number to opt in to texts, or leave that box unchecked.' }
  }

  await prisma.candidateProfile.update({
    where: { id: candidateId },
    data: {
      contractAccepted: intent === 'accept',
      contractAcceptedAt: new Date(),
      notificationTier,
      // SMS consent is only ever offered when FULL is selected — if someone
      // switches down to a lower tier after checking the box, don't persist
      // a stale opt-in tied to a preference they no longer hold.
      smsPhone: notificationTier === 'FULL' && smsConsent ? smsPhone : null,
      smsConsentedAt: notificationTier === 'FULL' && smsConsent ? new Date() : null,
    },
  })

  captureServerEvent(candidateId, 'onboarding_notification_preference_set', { tier: notificationTier })
  if (notificationTier === 'FULL' && smsConsent) {
    captureServerEvent(candidateId, 'sms_consent_opted_in')
  }

  revalidatePath('/onboarding', 'layout')
  redirect('/onboarding/score')
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

  const blockIds = formData.getAll('quadBlockId').map(String)
  const leastLikeMeIds = formData.getAll('quadLeastLikeMe').map(String)

  if (blockIds.length !== activeBlocks.length || leastLikeMeIds.length !== activeBlocks.length) {
    return { error: 'Please answer every block before continuing.' }
  }

  const quadResponses = blockIds.map((blockId, i) => ({
    blockId,
    leastLikeMe: leastLikeMeIds[i],
  }))

  const likertResponses: { itemId: string; score: number }[] = []
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith('likertScore-')) continue
    const score = Number(value)
    if (!Number.isInteger(score) || score < 1 || score > 5) {
      return { error: 'Invalid response received.' }
    }
    likertResponses.push({ itemId: key.slice('likertScore-'.length), score })
  }

  if (likertResponses.length !== activeItems.length) {
    return { error: 'Please answer every statement before continuing.' }
  }

  const quadStatements = activeBlocks.flatMap((block) => block.statements)

  const dimensionVectors = computeDimensionVectors(
    quadResponses,
    quadStatements,
    likertResponses,
    activeItems
  )
  const { inconsistencyScore, inconsistencyPairs, manipulationRiskFlag, flagThreshold } =
    computeInconsistency(quadResponses, likertResponses, quadStatements, activeItems)

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
          translatedOutput: translateDimensionVectors(dimensionVectors) as unknown as Prisma.InputJsonValue,
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

export async function updateExperience(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const candidateId = await requireCandidateId()

  const isPeopleManagerRaw = formData.get('isPeopleManager') as string | null

  if (!isPeopleManagerRaw) {
    return { error: 'Please answer all required questions.' }
  }

  const isPeopleManager = isPeopleManagerRaw === 'yes'
  const topStrengths = formData.getAll('topStrengths').map(String)
  const functionSkillConfidence = formData.get('functionSkillConfidence')
  const aiFlexibilityLevel = formData.get('aiFlexibilityLevel')
  const managementSkillConfidence = formData.get('managementSkillConfidence')
  const actionOrientedConfidence = formData.get('actionOrientedConfidence')
  const creativityConfidence = formData.get('creativityConfidence')
  const communicatorConfidence = formData.get('communicatorConfidence')

  try {
    await prisma.candidateProfile.update({
      where: { id: candidateId },
      data: {
        isPeopleManager,
        topStrengths,
        teamSizeManaged: isPeopleManager
          ? formData.get('teamSizeManaged')
            ? Number(formData.get('teamSizeManaged'))
            : 0
          : null,
        functionSkillConfidence: functionSkillConfidence ? Number(functionSkillConfidence) : null,
        aiFlexibilityLevel: aiFlexibilityLevel ? Number(aiFlexibilityLevel) : null,
        managementSkillConfidence: isPeopleManager && managementSkillConfidence
          ? Number(managementSkillConfidence)
          : null,
        actionOrientedConfidence: actionOrientedConfidence ? Number(actionOrientedConfidence) : null,
        creativityConfidence: creativityConfidence ? Number(creativityConfidence) : null,
        communicatorConfidence: communicatorConfidence ? Number(communicatorConfidence) : null,
        part3Complete: true,
      },
    })
  } catch {
    return { error: 'Something went wrong saving your answers. Please try again.' }
  }

  captureServerEvent(candidateId, 'onboarding_part_complete', { part: 3 })

  revalidatePath('/onboarding', 'layout')
  redirect('/onboarding/goals')
}

export async function updateGoals(_prevState: FormState, formData: FormData): Promise<FormState> {
  const candidateId = await requireCandidateId()

  const rankedOrder = formData.getAll('tradeoffOrder').map(String) as Array<
    (typeof TRADEOFF_PRIORITIES)[number]['key']
  >

  if (rankedOrder.length !== TRADEOFF_PRIORITIES.length) {
    return { error: `Please rank all ${TRADEOFF_PRIORITIES.length} priorities.` }
  }

  const rankValues: Record<(typeof TRADEOFF_PRIORITIES)[number]['key'], number> = {} as Record<
    (typeof TRADEOFF_PRIORITIES)[number]['key'],
    number
  >
  rankedOrder.forEach((key, index) => {
    rankValues[key] = index + 1
  })

  const openToRelocation = formData.get('openToRelocation') === 'on'

  try {
    await prisma.candidateProfile.update({
      where: { id: candidateId },
      data: {
        targetRoleType: (formData.get('targetRoleType') as string) || null,
        targetIndustries: formData.getAll('targetIndustries').map(String),
        targetFunction: (formData.get('targetFunction') as string) || null,
        targetCompanySize: (formData.get('targetCompanySize') as string) || null,
        targetCompanyStage: (formData.get('targetCompanyStage') as string) || null,
        primaryFunction: (formData.get('primaryFunction') as string) || null,
        remotePreference: (formData.get('remotePreference') as string) || null,
        compFlexible: formData.get('compFlexible') === 'on',
        willingToStartLower: formData.get('willingToStartLower') === 'on',
        startLowerRationale: (formData.get('startLowerRationale') as string) || null,
        isPivoting: formData.get('isPivoting') === 'on',
        openToRelocation,
        relocationNotes: openToRelocation ? (formData.get('relocationNotes') as string) || null : null,
        dealBreakers: (formData.get('dealBreakers') as string) || null,
        publicDisclosureComfort: (formData.get('publicDisclosureComfort') as PublicDisclosureComfort) || null,
        hasBeenReferredBefore: formData.get('hasBeenReferredBefore') === 'on',
        referralRecency:
          formData.get('hasBeenReferredBefore') === 'on'
            ? (formData.get('referralRecency') as ReferralRecency) || null
            : null,
        ...rankValues,
        part4Complete: true,
        assessmentComplete: true,
        assessmentCompletedAt: new Date(),
      },
    })
  } catch {
    return { error: 'Something went wrong saving your answers. Please try again.' }
  }

  captureServerEvent(candidateId, 'onboarding_part_complete', { part: 4 })

  revalidatePath('/onboarding', 'layout')
  redirect('/onboarding/contract')
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
  redirect('/onboarding/score')
}
