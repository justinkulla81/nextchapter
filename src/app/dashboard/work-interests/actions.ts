'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { captureServerEvent } from '@/lib/posthog/server'
import { estimateActionEffort } from '@/lib/weekly/action-effort'
import { getCurrentWeekSprint, autoCompleteEngagementAction } from '@/lib/weekly/sprint'
import { fetchInterestQuestions } from '@/lib/onet/interest-profiler'
import { scoreInterests } from '@/lib/work-interests/areas'

export type FormState = { error?: string } | undefined

export async function submitWorkInterests(_prevState: FormState, formData: FormData): Promise<FormState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'You need to be logged in to do this.' }

  const profile = await getOrCreateCandidateProfile(user.id)

  let questions
  try {
    questions = await fetchInterestQuestions()
  } catch {
    return { error: 'We couldn’t reach O*NET to score your answers. Your answers are still on screen — try saving again in a minute.' }
  }

  const answers = questions.map((q) => ({ index: q.index, answer: Number(formData.get(`answer__${q.index}`)) }))
  const unanswered = answers.filter((a) => !(a.answer >= 1 && a.answer <= 5)).length
  if (unanswered > 0) {
    return { error: `Please answer all 60 questions — ${unanswered} still need an answer.` }
  }

  const result = scoreInterests(questions, answers)
  if (!result) return { error: 'Some answers weren’t valid. Please re-check them and save again.' }

  const data = {
    candidateId: profile.id,
    answers,
    scores: result.scores,
    topAreas: result.topAreas,
    completedAt: new Date(),
  }
  await prisma.workInterestsResponse.upsert({
    where: { candidateId: profile.id },
    create: data,
    update: data,
  })

  captureServerEvent(profile.id, 'work_interests_completed', {
    candidateId: profile.id,
    topAreas: result.topAreas,
    scores: result.scores,
    isRetake: !!profile.workInterestsCompletedAt,
  })

  if (!profile.workInterestsCompletedAt) {
    const sprint = await getCurrentWeekSprint(profile.id)
    if (sprint) {
      const effort = estimateActionEffort({ actionType: 'WORK_INTERESTS_COMPLETED' })
      await autoCompleteEngagementAction(profile.id, {
        actionType: 'WORK_INTERESTS_COMPLETED',
        text: 'Complete Work Interests',
        points: effort.points,
        estimatedMinutes: effort.minutes,
      })
    }
    await prisma.candidateProfile.update({
      where: { id: profile.id },
      data: { workInterestsCompletedAt: new Date() },
    })
  }

  revalidatePath('/dashboard/work-interests')
  revalidatePath('/dashboard/skills-assessments')
  revalidatePath('/dashboard')
}
