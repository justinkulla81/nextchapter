'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { HOW_I_PERFORM_ITEMS } from '@/lib/constants/how-i-perform-items'
import { recordPerformanceAssessment } from '@/lib/assessments/performance-record'
import type { PerformanceResponseInput } from '@/lib/scoring/performance-vectors'

export type FormState = { error?: string } | undefined

export async function submitPerformanceAssessment(_prevState: FormState, formData: FormData): Promise<FormState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'You need to be logged in to do this.' }

  const profile = await getOrCreateCandidateProfile(user.id)

  const responses: PerformanceResponseInput[] = []
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith('performanceScore-')) continue
    const itemId = Number(key.slice('performanceScore-'.length))
    const score = Number(value)
    if (!Number.isInteger(itemId) || !Number.isInteger(score) || score < 1 || score > 4) {
      return { error: 'Invalid response received.' }
    }
    responses.push({ itemId, score: score as 1 | 2 | 3 | 4 })
  }

  if (responses.length !== HOW_I_PERFORM_ITEMS.length) {
    return { error: 'Please answer every statement before continuing.' }
  }

  await recordPerformanceAssessment(profile.id, responses)

  revalidatePath('/dashboard/how-i-perform')
  revalidatePath('/dashboard/skills-assessments')
  revalidatePath('/dashboard')
}
