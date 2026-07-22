'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { generateCoreNarrative } from '@/lib/narrative/generate-core-narrative'
import { generateAdaptations } from '@/lib/narrative/generate-adaptations'
import { generateToughAnswer } from '@/lib/interview-prep/generate-tough-answer'
import { evaluatePracticeAnswer, type PracticeEvaluation } from '@/lib/interview-prep/evaluate-practice-answer'
import { generateThankYouEmail, type ThankYouEmailInput } from '@/lib/interview-prep/generate-thank-you-email'
import { fetchJobPosting } from '@/lib/jobs/fetch-job-posting'
import { captureServerEvent } from '@/lib/posthog/server'

async function getAuthedProfile() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  return getOrCreateCandidateProfile(user.id)
}

export async function generateNarrative() {
  const profile = await getAuthedProfile()
  if (!profile) return

  await generateCoreNarrative(profile.id)
  await generateAdaptations(profile.id)
  revalidatePath('/dashboard/interview-prep')
}

export async function updateCoreStatement(newStatement: string) {
  const profile = await getAuthedProfile()
  if (!profile) return

  const trimmed = newStatement.trim()
  if (!trimmed) return

  const existing = await prisma.candidateNarrative.findFirst({
    where: { candidateId: profile.id },
    orderBy: { generatedAt: 'asc' },
  })

  if (existing) {
    await prisma.candidateNarrative.update({ where: { id: existing.id }, data: { coreStatement: trimmed } })
  } else {
    await prisma.candidateNarrative.create({
      data: { candidateId: profile.id, coreStatement: trimmed, adaptations: {} },
    })
  }
  await generateAdaptations(profile.id)
  revalidatePath('/dashboard/interview-prep')
}

export async function requestToughAnswer(question: string): Promise<string | null> {
  const profile = await getAuthedProfile()
  if (!profile) return null

  return generateToughAnswer(profile.id, question)
}

export async function requestToughAnswerFeedback(
  question: string,
  answerText: string,
  redraftCount = 0
): Promise<PracticeEvaluation | null> {
  const profile = await getAuthedProfile()
  if (!profile) return null

  const evaluation = await evaluatePracticeAnswer(question, answerText, profile.activeJobDescription)
  captureServerEvent(profile.id, 'tough_question_answered', { redraftCount })
  return evaluation
}

export async function requestPracticeEvaluation(
  question: string,
  answerText: string,
  redraftCount = 0
): Promise<PracticeEvaluation | null> {
  const profile = await getAuthedProfile()
  if (!profile) return null
  if (!answerText.trim()) return null

  const evaluation = await evaluatePracticeAnswer(question, answerText, profile.activeJobDescription)
  captureServerEvent(profile.id, 'interview_response_submitted', { redraftCount })
  return evaluation
}

export async function requestThankYouEmail(input: ThankYouEmailInput): Promise<string | null> {
  const profile = await getAuthedProfile()
  if (!profile) return null

  const note = await generateThankYouEmail({ ...input, jobDescription: profile.activeJobDescription })
  captureServerEvent(profile.id, 'thank_you_note_generated')
  return note
}

export async function updateActiveJobDescription(text: string) {
  const profile = await getAuthedProfile()
  if (!profile) return

  await prisma.candidateProfile.update({
    where: { id: profile.id },
    data: { activeJobDescription: text.trim() || null },
  })
  revalidatePath('/dashboard/interview-prep')
}

export async function fetchActiveJobDescriptionFromUrl(
  url: string
): Promise<{ success: boolean; text: string | null }> {
  const profile = await getAuthedProfile()
  if (!profile) return { success: false, text: null }

  const result = await fetchJobPosting(url)
  if (result.status !== 'success' || !result.text) return { success: false, text: null }

  await prisma.candidateProfile.update({
    where: { id: profile.id },
    data: { activeJobDescription: result.text },
  })
  revalidatePath('/dashboard/interview-prep')
  return { success: true, text: result.text }
}

export async function updateComfortCheck(fields: {
  storyComfort: number
  interviewComfort: number
  elevatorPitchReady: number
}) {
  const profile = await getAuthedProfile()
  if (!profile) return

  await prisma.candidateProfile.update({
    where: { id: profile.id },
    data: fields,
  })
  revalidatePath('/dashboard/interview-prep')
}
