'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { Prisma, type CurrentJobStatus, type GapDurationBucket } from '@prisma/client'
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
  const gapDuration =
    currentJobStatus !== 'EMPLOYED_CONSIDERING_MOVE'
      ? isNewGrad
        ? 'ZERO_TO_THREE_MONTHS'
        : ((formData.get('gapDuration') as GapDurationBucket | null) ?? null)
      : null

  const remotePreference = (formData.get('remotePreference') as string) || null
  const jobSearchDifficultyRaw = formData.get('jobSearchDifficultyLevel')
  const jobSearchDifficultyLevel = jobSearchDifficultyRaw ? Number(jobSearchDifficultyRaw) : null
  const jobSearchIntensityRaw = formData.get('jobSearchIntensity')
  const jobSearchIntensity = jobSearchIntensityRaw ? Number(jobSearchIntensityRaw) : null

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
        remotePreference,
        jobSearchDifficultyLevel,
        jobSearchIntensity,
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
  redirect('/onboarding/contract')
}

export async function acceptContract() {
  const candidateId = await requireCandidateId()

  await prisma.candidateProfile.update({
    where: { id: candidateId },
    data: { contractAccepted: true, contractAcceptedAt: new Date() },
  })

  redirect('/onboarding/experience')
}

// "Not right now" still records the moment they saw the contract (so we
// know they've been through this screen), just without accepting it — the
// candidate continues at a lower assumed intensity rather than being blocked.
export async function continueWithoutContract() {
  const candidateId = await requireCandidateId()

  await prisma.candidateProfile.update({
    where: { id: candidateId },
    data: { contractAccepted: false, contractAcceptedAt: new Date() },
  })

  redirect('/onboarding/experience')
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
        compFlexible: formData.get('compFlexible') === 'on',
        willingToStartLower: formData.get('willingToStartLower') === 'on',
        startLowerRationale: (formData.get('startLowerRationale') as string) || null,
        openToRelocation,
        relocationNotes: openToRelocation ? (formData.get('relocationNotes') as string) || null : null,
        dealBreakers: (formData.get('dealBreakers') as string) || null,
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
  redirect('/onboarding/score')
}
