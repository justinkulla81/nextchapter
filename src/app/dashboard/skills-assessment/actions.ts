'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { captureServerEvent } from '@/lib/posthog/server'
import { estimateActionEffort } from '@/lib/weekly/action-effort'
import { getCurrentWeekSprint, autoCompleteEngagementAction } from '@/lib/weekly/sprint'
import { clampMulti } from '@/lib/forms/clamp-multi'
import { TOP_STRENGTHS_MAX, GROWTH_AREAS_MAX } from '@/lib/constants/onboarding'

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

  // isPeopleManager/teamSizeManaged are no longer asked here — moved to
  // Track Record (spec §4.2 item 16). isPeopleManager still gates the
  // managementSkillConfidence slider below, read from the profile value
  // Track Record wrote rather than from this form.
  const isPeopleManager = profile.isPeopleManager
  const topStrengths = clampMulti(formData, 'topStrengths', TOP_STRENGTHS_MAX)
  const growthAreas = clampMulti(formData, 'growthAreas', GROWTH_AREAS_MAX)
  const growthAreasElaboration = (formData.get('growthAreasElaboration') as string | null)?.trim() || null
  const functionSkillConfidence = formData.get('functionSkillConfidence')
  const aiFlexibilityLevel = formData.get('aiFlexibilityLevel')
  const managementSkillConfidence = formData.get('managementSkillConfidence')

  // actionOrientedConfidence/creativityConfidence/communicatorConfidence are
  // deliberately not read here — the spec's dedup kill-list (§6.1) cut these
  // 3 questions as duplicates of How I Work Best/How I Perform dimensions.
  // Not writing them (rather than writing null) preserves any value a
  // candidate already gave before this form stopped asking, since the
  // scoring formulas that read them still fall back to it.
  await prisma.candidateProfile.update({
    where: { id: profile.id },
    data: {
      topStrengths,
      growthAreas,
      growthAreasElaboration,
      functionSkillConfidence: functionSkillConfidence ? Number(functionSkillConfidence) : null,
      aiFlexibilityLevel: aiFlexibilityLevel ? Number(aiFlexibilityLevel) : null,
      managementSkillConfidence: isPeopleManager && managementSkillConfidence ? Number(managementSkillConfidence) : null,
    },
  })

  captureServerEvent(profile.id, 'skills_assessment_updated', { growthAreasCount: growthAreas.length })

  if (!profile.skillsAssessmentCompletedAt) {
    const sprint = await getCurrentWeekSprint(profile.id)
    if (sprint) {
      const effort = estimateActionEffort({ actionType: 'SKILLS_ASSESSMENT_COMPLETED' })
      await autoCompleteEngagementAction(profile.id, {
        actionType: 'SKILLS_ASSESSMENT_COMPLETED',
        text: 'Complete the Skills Assessment',
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
