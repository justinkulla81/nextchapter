'use server'

import { createClient } from '@/lib/supabase/server'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { prisma } from '@/lib/prisma'

// Resets the Badges "new since last visit" baseline — same "visiting clears
// it" convention as markBackchannelViewed/markWatchlistPageViewed. Called
// once per page load from MarkBadgesViewedOnMount, always with the
// currently-earned count so the next visit's open/closed default is
// computed against what the candidate has actually already seen.
export async function markBadgesViewed(earnedBadgesCount: number) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const profile = await getOrCreateCandidateProfile(user.id)
  if (profile.badgesLastSeenCount === earnedBadgesCount) return

  await prisma.candidateProfile.update({
    where: { id: profile.id },
    data: { badgesLastSeenCount: earnedBadgesCount },
  })
}
