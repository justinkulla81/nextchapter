'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { captureServerEvent } from '@/lib/posthog/server'
import type { LeaderboardDisplayMode } from '@prisma/client'

// PART FOUR §15 — Weekly Leaderboards opt-in. Kept in its own file rather
// than folded into ./actions.ts — that file already covers Privacy Tier,
// Recruiter Database, notifications, SMS, and account actions; a sixth
// unrelated settings surface belongs in its own module, same reasoning that
// keeps share-actions.ts separate.
const VALID_DISPLAY_MODES: LeaderboardDisplayMode[] = ['FIRST_NAME_LAST_INITIAL', 'GENERATED_HANDLE', 'NOT_LISTED']

export type LeaderboardSettingsResult = { error?: string } | undefined

// Opting IN requires a display mode chosen in the same call — there is no
// valid "opted in, no display mode yet" state (every query in
// queries.ts's getEligibleCandidatePool requires leaderboardDisplayMode
// not null as part of the eligibility gate, so a null mode would silently
// exclude someone who thinks they're opted in). Opting OUT never needs a
// mode and is always available in one tap (§18) — immediate and retroactive
// by construction, since every board is a live query with no cache to
// invalidate.
export async function setLeaderboardOptIn(optIn: boolean, displayMode?: LeaderboardDisplayMode): Promise<LeaderboardSettingsResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'You need to be logged in to change this.' }

  const profile = await getOrCreateCandidateProfile(user.id)

  // §4.1 — hard exclusion, not defaulted off: the opt-in control isn't even
  // shown to a Confidential Search Mode candidate in the UI, but this is the
  // real server-side gate a client can never bypass.
  if (optIn && profile.confidentialSearchMode) {
    return { error: 'Leaderboards are unavailable while Confidential Search Mode is on.' }
  }

  if (optIn && (!displayMode || !VALID_DISPLAY_MODES.includes(displayMode))) {
    return { error: 'Choose how you want to appear before opting in.' }
  }

  await prisma.candidateProfile.update({
    where: { id: profile.id },
    data: {
      leaderboardOptIn: optIn,
      leaderboardDisplayMode: optIn ? displayMode : null,
      leaderboardOptInAt: optIn ? new Date() : profile.leaderboardOptInAt,
    },
  })

  captureServerEvent(profile.id, optIn ? 'leaderboard_opted_in' : 'leaderboard_opted_out', {
    displayMode: optIn ? displayMode : undefined,
  })

  revalidatePath('/dashboard/privacy')
  revalidatePath('/dashboard/stats')
  revalidatePath('/dashboard/community')
  revalidatePath('/dashboard')
}

export async function setLeaderboardDisplayMode(displayMode: LeaderboardDisplayMode): Promise<LeaderboardSettingsResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'You need to be logged in to change this.' }
  if (!VALID_DISPLAY_MODES.includes(displayMode)) return { error: 'Choose a valid display option.' }

  const profile = await getOrCreateCandidateProfile(user.id)
  if (!profile.leaderboardOptIn) return { error: 'Opt in to leaderboards first.' }

  await prisma.candidateProfile.update({
    where: { id: profile.id },
    data: { leaderboardDisplayMode: displayMode },
  })

  captureServerEvent(profile.id, 'leaderboard_display_mode_changed', { displayMode })

  revalidatePath('/dashboard/privacy')
  revalidatePath('/dashboard/stats')
  revalidatePath('/dashboard/community')
}
