'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { recalculateScore } from '@/lib/scoring/recalculate'

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

  const alreadyAnswered = await prisma.interviewResponse.findFirst({
    where: { candidateId: profile.id, questionId },
  })
  if (alreadyAnswered) {
    return { error: "You've already answered this question." }
  }

  await prisma.interviewResponse.create({
    data: {
      candidateId: profile.id,
      questionId,
      questionText,
      responseType: 'text',
      responseText,
    },
  })

  await recalculateScore(profile.id, 'interview_response_added')

  revalidatePath('/dashboard/interview')
  revalidatePath('/dashboard')
}
