'use server'

import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { captureServerEvent } from '@/lib/posthog/server'

/** The one-time Candidate+ unlock screen was shown: never again. Records candidate_plus_unlock_viewed with what it showed. */
export async function markCandidatePlusUnlockSeen(shown: { matches: number; searchFirms: number; resumes: number; recruiterVisible: boolean }): Promise<{ ok: boolean }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false }
  const profile = await getOrCreateCandidateProfile(user.id)
  const r = await prisma.candidateProfile.updateMany({ where: { id: profile.id, candidatePlusUnlockSeenAt: null }, data: { candidatePlusUnlockSeenAt: new Date() } })
  if (r.count > 0) {
    captureServerEvent(profile.id, 'candidate_plus_unlock_viewed', {
      matches: shown.matches,
      searchFirms: shown.searchFirms,
      resumes: shown.resumes,
      recruiterVisible: shown.recruiterVisible,
      unlockSource: profile.candidatePlusUnlockSource,
    })
  }
  return { ok: true }
}
