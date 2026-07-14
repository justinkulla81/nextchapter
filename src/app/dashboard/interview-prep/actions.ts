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

  await prisma.candidateNarrative.upsert({
    where: { candidateId: profile.id },
    create: { candidateId: profile.id, coreStatement: trimmed, adaptations: {} },
    update: { coreStatement: trimmed },
  })
  await generateAdaptations(profile.id)
  revalidatePath('/dashboard/interview-prep')
}

export async function requestToughAnswer(question: string): Promise<string | null> {
  const profile = await getAuthedProfile()
  if (!profile) return null

  return generateToughAnswer(profile.id, question)
}

export async function requestPracticeEvaluation(
  question: string,
  answerText: string
): Promise<PracticeEvaluation | null> {
  const profile = await getAuthedProfile()
  if (!profile) return null
  if (!answerText.trim()) return null

  return evaluatePracticeAnswer(question, answerText, profile.activeJobDescription)
}

export async function requestThankYouEmail(input: ThankYouEmailInput): Promise<string | null> {
  const profile = await getAuthedProfile()
  if (!profile) return null

  return generateThankYouEmail({ ...input, jobDescription: profile.activeJobDescription })
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
