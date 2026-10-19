'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { captureServerEvent } from '@/lib/posthog/server'
import { getUnlockStatus, startNewCycle } from '@/lib/effort/load'
import { getOrDraftSearchStrategyGuidance } from '@/lib/reports/search-strategy-guidance'

export type UnlockState = { ok?: true; error?: string } | undefined

/**
 * Generates the member's next search strategy once their effort points have earned it. Checked
 * again here, server-side: the button is only shown when unlocked, but the action is callable.
 * The next cycle starts only if the strategy was actually produced, so a failed draft costs nothing.
 */
export async function unlockNextStrategy(_prev: UnlockState, _formData: FormData): Promise<UnlockState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Please sign in again to continue.' }
  const profile = await getOrCreateCandidateProfile(user.id)

  const status = await getUnlockStatus(profile.id, 'STRATEGY')
  if (!status.unlocked) return { error: `Your next strategy is not unlocked yet: ${status.blockers.join(', ')}.` }

  const guidance = await getOrDraftSearchStrategyGuidance(profile.id, { force: true })
  if (!guidance) return { error: 'We could not write your strategy just now. Nothing was used up, so please try again in a moment.' }

  await startNewCycle(profile.id, 'STRATEGY')
  captureServerEvent(profile.id, 'next_strategy_generated', { points: status.score.total, bar: status.bar.points, workKinds: status.score.workKinds })
  revalidatePath('/dashboard/search-strategy')
  return { ok: true }
}
