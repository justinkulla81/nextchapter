'use server'

import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { parseBreadth } from '@/lib/jobs/search-breadth'

/**
 * Saves the member's board breadth (Narrow / Wide) as a preference: the board opens on
 * it next time, and job emails follow it (they use Narrow unless the member chose Wide).
 */
export async function saveBoardBreadth(value: string): Promise<{ ok: boolean }> {
  const breadth = parseBreadth(value)
  if (!breadth) return { ok: false }
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false }
  const profile = await getOrCreateCandidateProfile(user.id)
  await prisma.candidateProfile.update({ where: { id: profile.id }, data: { boardBreadth: breadth } })
  return { ok: true }
}

