'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { quickQuestionFor } from '@/lib/search-strategy/quick-questions'

export type QuickAnswerResult = { ok: true } | { ok: false; error: string }

/**
 * Saves one answer from the one-at-a-time flow to the existing field it belongs to. Whitelisted and
 * validated in quick-questions.ts, so it only ever writes a value the member could have picked.
 * Victoria's read is not redrafted per answer: it refreshes with the next strategy unlock.
 */
export async function saveQuickAnswer(key: string, value: string): Promise<QuickAnswerResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Please sign in again to save this.' }
  const profile = await getOrCreateCandidateProfile(user.id)

  const question = quickQuestionFor(key)
  const data = question?.toData(value) ?? null
  if (!question || !data) return { ok: false, error: 'Choose one of the options. Nothing was saved.' }

  await prisma.candidateProfile.update({ where: { id: profile.id }, data })
  revalidatePath('/dashboard/search-strategy')
  revalidatePath('/dashboard/market-reality')
  return { ok: true }
}
