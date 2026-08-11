'use server'

import { revalidatePath } from 'next/cache'
import type { Prisma } from '@prisma/client'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { captureServerEvent } from '@/lib/posthog/server'
import { estimateActionEffort } from '@/lib/weekly/action-effort'
import { getCurrentWeekSprint, autoCompleteEngagementAction } from '@/lib/weekly/sprint'
import { HOW_I_PERFORM_ITEMS } from '@/lib/constants/how-i-perform-items'
import { computePerformanceScores, type PerformanceResponseInput } from '@/lib/scoring/performance-vectors'

export type FormState = { error?: string } | undefined

export async function submitPerformanceAssessment(_prevState: FormState, formData: FormData): Promise<FormState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'You need to be logged in to do this.' }

  const profile = await getOrCreateCandidateProfile(user.id)

  const responses: PerformanceResponseInput[] = []
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith('performanceScore-')) continue
    const itemId = Number(key.slice('performanceScore-'.length))
    const score = Number(value)
    if (!Number.isInteger(itemId) || !Number.isInteger(score) || score < 1 || score > 4) {
      return { error: 'Invalid response received.' }
    }
    responses.push({ itemId, score: score as 1 | 2 | 3 | 4 })
  }

  if (responses.length !== HOW_I_PERFORM_ITEMS.length) {
    return { error: 'Please answer every statement before continuing.' }
  }

  const scores = computePerformanceScores(responses)

  const isFirstResponse = (await prisma.performanceAssessmentResponse.count({
    where: { candidateId: profile.id },
  })) === 0

  await prisma.performanceAssessmentResponse.create({
    data: {
      candidateId: profile.id,
      responses: responses as unknown as Prisma.InputJsonValue,
      executionScore: scores.execution,
      judgmentScore: scores.judgment,
      composureScore: scores.composure,
      influenceScore: scores.influence,
      integrityScore: scores.integrity,
    },
  })

  captureServerEvent(profile.id, 'performance_assessment_completed', {
    isRetake: !isFirstResponse,
  })

  if (isFirstResponse) {
    const sprint = await getCurrentWeekSprint(profile.id)
    if (sprint) {
      const effort = estimateActionEffort({ actionType: 'PERFORMANCE_ASSESSMENT_COMPLETED' })
      await autoCompleteEngagementAction(profile.id, {
        actionType: 'PERFORMANCE_ASSESSMENT_COMPLETED',
        text: 'Complete How I Perform',
        points: effort.points,
        estimatedMinutes: effort.minutes,
      })
    }
  }

  revalidatePath('/dashboard/how-i-perform')
  revalidatePath('/dashboard/skills-assessments')
  revalidatePath('/dashboard')
}
