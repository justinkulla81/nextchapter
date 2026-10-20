'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { captureServerEvent } from '@/lib/posthog/server'
import { parseAnswer } from '@/lib/reports/market-reality-brief/answers'

export type AnswerState = { ok?: true; error?: string } | undefined

/**
 * Saves one in-place answer from the Market Reality Report to the existing field it belongs to,
 * then refreshes the report so the row it resolves recalculates. Whitelisted and validated in
 * parseAnswer; never writes anything the member did not choose.
 */
export async function answerReportQuestion(_prev: AnswerState, formData: FormData): Promise<AnswerState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Please sign in again to save this.' }
  const profile = await getOrCreateCandidateProfile(user.id)

  const field = String(formData.get('field') ?? '')
  const parsed = parseAnswer(field, formData.get('value'))
  if (!parsed.ok) return { error: parsed.error }

  await prisma.candidateProfile.update({
    where: { id: profile.id },
    data: { ...parsed.data, ...(parsed.confirmLinkedIn ? { linkedInConfirmedAt: new Date() } : {}) },
  })
  captureServerEvent(profile.id, 'market_reality_inline_answer_saved', { field })
  revalidatePath('/dashboard/market-reality')
  return { ok: true }
}
