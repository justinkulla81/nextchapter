'use server'

import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { normalizeOrgName } from '@/lib/text/org-name-match'

export type FollowState = { signedIn: boolean; following: boolean }

/** For a cached public page: is the visitor a signed-in member, and do they already follow this company? Reads only, never creates a profile. */
export async function getFollowState(companyName: string): Promise<FollowState> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { signedIn: false, following: false }
    const profile = await prisma.candidateProfile.findUnique({ where: { userId: user.id }, select: { id: true } })
    if (!profile) return { signedIn: false, following: false }
    const normalized = normalizeOrgName(companyName)
    const entry = normalized ? await prisma.companyWatchlistEntry.findFirst({ where: { candidateId: profile.id, companyNameNormalized: normalized }, select: { id: true } }) : null
    return { signedIn: true, following: !!entry }
  } catch {
    return { signedIn: false, following: false }
  }
}
