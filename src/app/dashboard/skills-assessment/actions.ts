'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { captureServerEvent } from '@/lib/posthog/server'
import { estimateActionEffort } from '@/lib/weekly/action-effort'
import { getCurrentWeekSprint, autoCompleteEngagementAction } from '@/lib/weekly/sprint'

export type FormState = { error?: string } | undefined

// Retakeable any time (unlike the Work Style quiz's 7-day cooldown) — these
// are just self-ratings, and personalization for Job Recs/Skills Recs
// should reflect the candidate's current read on themselves, not a snapshot
// from onboarding. The Weekly Sprint bonus only awards once, gated on
// skillsAssessmentCompletedAt, same pattern as networkComfortBonusAt.
export async function updateSkillsAssessment(_prevState: FormState, formData: FormData): Promise<FormState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'You need to be logged in to do this.' }

  const profile = await getOrCreateCandidateProfile(user.id)

  const isPeopleManagerRaw = formData.get('isPeopleManager') as string | null
  const isPeopleManager = isPeopleManagerRaw === 'yes'
  const topStrengths = formData.getAll('topStrengths').map(String)
  const functionSkillConfidence = formData.get('functionSkillConfidence')
  const aiFlexibilityLevel = formData.get('aiFlexibilityLevel')
  const managementSkillConfidence = formData.get('managementSkillConfidence')
  const actionOrientedConfidence = formData.get('actionOrientedConfidence')
  const creativityConfidence = formData.get('creativityConfidence')
  const communicatorConfidence = formData.get('communicatorConfidence')

  await prisma.candidateProfile.update({
    where: { id: profile.id },
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
      managementSkillConfidence: isPeopleManager && managementSkillConfidence ? Number(managementSkillConfidence) : null,
      actionOrientedConfidence: actionOrientedConfidence ? Number(actionOrientedConfidence) : null,
      creativityConfidence: creativityConfidence ? Number(creativityConfidence) : null,
      communicatorConfidence: communicatorConfidence ? Number(communicatorConfidence) : null,
    },
  })

  captureServerEvent(profile.id, 'skills_assessment_updated', {})

  if (!profile.skillsAssessmentCompletedAt) {
    const sprint = await getCurrentWeekSprint(profile.id)
    if (sprint) {
      const effort = estimateActionEffort({ actionType: 'SKILLS_ASSESSMENT_COMPLETED' })
      await autoCompleteEngagementAction(profile.id, {
        actionType: 'SKILLS_ASSESSMENT_COMPLETED',
        text: 'Completed the Skills Assessment',
        points: effort.points,
        estimatedMinutes: effort.minutes,
      })
    }
    await prisma.candidateProfile.update({
      where: { id: profile.id },
      data: { skillsAssessmentCompletedAt: new Date() },
    })
  }

  // These fields personalize Job Recommendations (compute-match-score.ts),
  // Skills Recommendations (build-learning-plan.ts), and the Hireability
  // Report — all of which read straight from CandidateProfile, so a fresh
  // render is enough; nothing needs to be recomputed/cached here.
  revalidatePath('/dashboard/skills-assessment')
  revalidatePath('/dashboard/skills-assessments')
  revalidatePath('/dashboard/learning')
  revalidatePath('/dashboard/find-my-job')
  revalidatePath('/dashboard')
}
