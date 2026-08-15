'use server'

import { createClient } from '@/lib/supabase/server'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { getStoredPersonalBest } from '@/lib/leaderboard/personal-bests'

// §19 — "Weekly Search Sprint gets one line at week's end: 'You finished at
// 140 points. Your best is 185.' No ranking inside the Sprint." Read-only
// lookup of the stored record (see getStoredPersonalBest's own doc comment
// on why this doesn't pay for a live recompute here — the Stats page
// already keeps the record fresh on every visit there). A small server
// action rather than threading a new prop through SuccessSprintCard's
// caller (dashboard/page.tsx) — SuccessSprintCard is a client component, so
// it fetches this itself on mount via PersonalBestLine.
export async function getMyActionScorePersonalBest() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const profile = await getOrCreateCandidateProfile(user.id)
  const best = await getStoredPersonalBest(profile.id, 'ACTION_SCORE')
  return best ? { bestValue: best.bestValue, weekStartDate: best.weekStartDate.toISOString() } : null
}
