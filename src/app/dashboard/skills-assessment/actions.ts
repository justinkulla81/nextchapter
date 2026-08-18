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
import { getOrGenerateSkillGapSuggestions, type SkillGapSuggestions } from '@/lib/skills/skill-gap-suggestions'

export type FormState =
  | { error?: string; success?: boolean; firstTimeCompletion?: boolean; aiFlexibilityLevel?: number | null }
  | undefined

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
  // Captured before the update below — the write flips this field, so this
  // is the only point where "was this the first-ever completion" is still
  // knowable. Drives whether the client wizard reveals the post-questionnaire
  // Skills You Have / Skills You Need confirmation steps.
  const wasFirstCompletion = !profile.skillsAssessmentCompletedAt

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
  // Skills Recommendations (build-learning-plan.ts), and the Market Reality
  // Report — all of which read straight from CandidateProfile, so a fresh
  // render is enough; nothing needs to be recomputed/cached here.
  revalidatePath('/dashboard/skills-assessment')
  revalidatePath('/dashboard/skills-assessments')
  revalidatePath('/dashboard/learning')
  revalidatePath('/dashboard/find-my-job')
  revalidatePath('/dashboard')

  return {
    success: true,
    firstTimeCompletion: wasFirstCompletion,
    aiFlexibilityLevel: aiFlexibilityLevel ? Number(aiFlexibilityLevel) : null,
  }
}

export type SkillsHaveFormState = { error?: string; success?: boolean } | undefined

// First-time confirmation (right after the questionnaire) or any later
// edit — same action either way. confirmedSkillsHave is the candidate's
// own edited copy; resumeKeywords itself stays untouched and keeps
// auto-refreshing on resume re-upload (see schema comment).
export async function confirmSkillsHave(
  _prevState: SkillsHaveFormState,
  formData: FormData
): Promise<SkillsHaveFormState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'You need to be logged in to do this.' }

  const profile = await getOrCreateCandidateProfile(user.id)
  const confirmedSkillsHave = formData.getAll('confirmedSkillsHave') as string[]

  await prisma.candidateProfile.update({
    where: { id: profile.id },
    data: { confirmedSkillsHave, skillsHaveConfirmedAt: new Date() },
  })

  captureServerEvent(profile.id, 'skills_have_confirmed', { count: confirmedSkillsHave.length })

  revalidatePath('/dashboard/skills-assessment')
  revalidatePath('/dashboard/skills-assessments')
  revalidatePath('/dashboard/find-my-job')

  return { success: true }
}

// Plain (non-form) server action the client wizard calls once it reaches
// the Skills You Need step — deliberately fetched then, not up front, so a
// first-time candidate's suggestions reflect the target role/AI-comfort
// answers they just gave in the questionnaire above (getOrGenerateSkillGapSuggestions
// fingerprints on those same fields — see that file). Self-caching, so a
// retake candidate re-opening this page doesn't re-trigger the LLM call.
export async function fetchSkillGapSuggestions(): Promise<SkillGapSuggestions | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const profile = await getOrCreateCandidateProfile(user.id)
  return getOrGenerateSkillGapSuggestions(profile.id)
}
