'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/lib/supabase/get-current-user'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { applySituation, isSituationKey } from '@/lib/onboarding/apply-situation'
import { getScanSummary } from '@/lib/onboarding/scan-summary'
import type { ScanSummary } from '@/lib/onboarding/scan-summary-core'
import { isOnboardingV2Enabled } from '@/lib/onboarding/v2-flag'

type FormState = { error?: string } | undefined

// The signed-up member, or null. Unlike the classic steps this never starts an
// anonymous session: the reveal only exists after Google sign-in.
async function currentMember() {
  if (!isOnboardingV2Enabled()) return null
  const user = await getCurrentUser()
  if (!user || user.is_anonymous) return null
  return getOrCreateCandidateProfile(user.id)
}

// The situation question, asked on the reveal while the inbox is being read.
// Saves the answer and stays on the page; the page then offers the next step.
export async function submitRevealSituation(_prevState: FormState, formData: FormData): Promise<FormState> {
  const profile = await currentMember()
  if (!profile) return { error: 'Your session ended. Please sign in again to continue.' }

  const situation = formData.get('situation')
  if (!isSituationKey(situation)) return { error: 'Please choose the option that best describes you.' }

  const error = await applySituation(profile.id, situation)
  if (error) return { error }

  revalidatePath('/onboarding/reveal')
  return undefined
}

// Polled by the reveal while the first read is still running.
export async function getScanSummaryAction(): Promise<ScanSummary | null> {
  const profile = await currentMember()
  return profile ? getScanSummary(profile.id) : null
}
