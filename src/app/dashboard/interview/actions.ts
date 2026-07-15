'use server'

import { revalidatePath } from 'next/cache'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { recalculateScore } from '@/lib/scoring/recalculate'
import { evaluatePracticeAnswer } from '@/lib/interview-prep/evaluate-practice-answer'

export type FormState = { error?: string } | undefined

export async function submitInterviewResponse(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'You need to be logged in to answer questions.' }
  }

  const questionId = formData.get('questionId') as string | null
  const questionText = formData.get('questionText') as string | null
  const responseText = (formData.get('responseText') as string | null)?.trim()

  if (!questionId || !questionText || !responseText) {
    return { error: 'Please write a response before submitting.' }
  }

  if (responseText.length < 20) {
    return { error: 'Try to give a bit more detail — at least a few sentences.' }
  }

  const profile = await getOrCreateCandidateProfile(user.id)

  const feedback = await evaluatePracticeAnswer(questionText, responseText, profile.activeJobDescription)
  const feedbackValue = feedback ? (feedback as unknown as Prisma.InputJsonValue) : undefined

  const existing = await prisma.interviewResponse.findFirst({
    where: { candidateId: profile.id, questionId },
    select: { id: true },
  })

  if (existing) {
    await prisma.interviewResponse.update({
      where: { id: existing.id },
      data: { responseText, feedback: feedbackValue },
    })
  } else {
    await prisma.interviewResponse.create({
      data: {
        candidateId: profile.id,
        questionId,
        questionText,
        responseType: 'text',
        responseText,
        feedback: feedbackValue,
      },
    })
  }

  await recalculateScore(profile.id, 'interview_response_added')

  revalidatePath('/dashboard/interview')
  revalidatePath('/dashboard')
}
