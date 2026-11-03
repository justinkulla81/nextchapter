'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { captureServerEvent } from '@/lib/posthog/server'
import { leaveCommunity } from '@/lib/community/communities'
import { joinAlumniNetwork } from '@/lib/community/alumni-networks'

async function member() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user ? getOrCreateCandidateProfile(user.id) : null
}

/** "Not for me" on a suggested company. It stays out of the suggestions from then on. */
export async function dismissSuggestion(companyId: string): Promise<{ ok: boolean; error?: string }> {
  const profile = await member()
  if (!profile) return { ok: false, error: 'You need to be logged in to do this.' }
  const id = companyId?.trim()
  if (!id) return { ok: false, error: 'Pick a company to hide.' }
  try {
    await prisma.companySuggestionDismissal.upsert({
      where: { candidateId_companyId: { candidateId: profile.id, companyId: id } },
      create: { candidateId: profile.id, companyId: id },
      update: {},
    })
  } catch {
    return { ok: false, error: 'We could not save that. Try again in a moment.' }
  }
  captureServerEvent(profile.id, 'company_suggestion_dismissed', { companyId: id, source: 'following_page' })
  revalidatePath('/dashboard/following')
  return { ok: true }
}

/** Leave a group. Alumni networks can be rejoined; the field and place groups cannot. */
export async function leaveGroup(communityId: string): Promise<{ ok: boolean; error?: string }> {
  const profile = await member()
  if (!profile) return { ok: false, error: 'You need to be logged in to do this.' }
  try {
    await leaveCommunity(profile.id, communityId)
  } catch {
    return { ok: false, error: 'We could not save that. Try again in a moment.' }
  }
  captureServerEvent(profile.id, 'community_left', { communityId, source: 'following_page' })
  revalidatePath('/dashboard/following')
  revalidatePath('/dashboard/community')
  return { ok: true }
}

/** Join an alumni network (a school or a past employer). The server re-checks that the member qualifies. */
export async function joinNetwork(kind: 'SCHOOL' | 'FORMER_EMPLOYER', refId: string): Promise<{ ok: boolean; error?: string }> {
  const profile = await member()
  if (!profile) return { ok: false, error: 'You need to be logged in to do this.' }
  const result = await joinAlumniNetwork(profile.id, kind, refId)
  captureServerEvent(profile.id, 'alumni_network_joined', { kind, refId, ok: result.ok, source: 'following_page' })
  if (!result.ok) return { ok: false, error: result.error }
  revalidatePath('/dashboard/following')
  revalidatePath('/dashboard/community')
  return { ok: true }
}
