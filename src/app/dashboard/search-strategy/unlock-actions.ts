'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { captureServerEvent } from '@/lib/posthog/server'
import { unlockProgressText } from '@/lib/effort/unlock-text'
import { getUnlockStatus, startNewCycle } from '@/lib/effort/load'
import { getOrDraftSearchStrategyGuidance } from '@/lib/reports/search-strategy-guidance'
import { generateMarketRealityReport } from '@/lib/reports/market-reality-report'

export type UnlockState = { ok?: true; error?: string } | undefined

/**
 * Generates the member's next search strategy, and refreshes their report with it, once their search
 * effort has earned it. Checked again here, server-side: the button is only shown when unlocked, but
 * the action is callable. The next cycle starts only if the strategy was actually produced, so a failed
 * draft costs nothing. The report refresh (resume rewrites and weekly plan) is best-effort: if it fails
 * the strategy still stands and the report keeps its last version.
 */
export async function unlockNextStrategy(_prev: UnlockState, _formData: FormData): Promise<UnlockState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Please sign in again to continue.' }
  const profile = await getOrCreateCandidateProfile(user.id)

  const status = await getUnlockStatus(profile.id)
  if (!status.unlocked) {
    const text = unlockProgressText(status)
    return { error: `${text.headline}. ${text.detail}` }
  }

  const guidance = await getOrDraftSearchStrategyGuidance(profile.id, { force: true })
  if (!guidance) return { error: 'We could not write your strategy just now. Nothing was used up, so please try again in a moment.' }

  let reportRefreshed = true
  try {
    await generateMarketRealityReport(profile.id)
  } catch (error) {
    reportRefreshed = false
    console.error('Report refresh after unlock failed', error)
  }

  await startNewCycle(profile.id)
  captureServerEvent(profile.id, 'next_strategy_generated', { minutes: status.minutes, bar: status.bar.minutes, reportRefreshed })
  revalidatePath('/dashboard/search-strategy')
  revalidatePath('/dashboard/market-reality')
  return { ok: true }
}
