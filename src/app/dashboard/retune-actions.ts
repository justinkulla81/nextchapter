'use server'

import { createClient } from '@/lib/supabase/server'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { runRetune } from '@/lib/personalization/retune'
import { parseRetuneTrigger, type RetuneResult } from '@/lib/personalization/match-verdict'
import { mustArriveWithin } from '@/lib/perf/timed'

// The save has already happened; this only shows before and after. One run took 285 s on 2026-11-04, so the member waits at most this long.
const RETUNE_DEADLINE_MS = 20_000

/**
 * "Retuning your search": re-runs the member's matching on the server and returns before →
 * after with the top reasons (personalization/retune.ts). Called right after a save that
 * changes matching; the step list on screen shows only while this is running.
 */
export async function retuneSearch(rawTrigger: string): Promise<{ ok: true; result: RetuneResult | null } | { ok: false; error: string }> {
  const trigger = parseRetuneTrigger(rawTrigger)
  if (!trigger) return { ok: false, error: 'Unknown change.' }
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'You need to be logged in to do this.' }
  const profile = await getOrCreateCandidateProfile(user.id)
  try {
    return { ok: true, result: await mustArriveWithin('retune', trigger, profile.id, runRetune(profile, trigger), RETUNE_DEADLINE_MS) }
  } catch (error) {
    console.error('Retune failed:', error)
    return { ok: false, error: "We couldn't re-run your matches just now. Your change is saved — your board uses it next time it loads." }
  }
}
