'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { createClient } from '@/lib/supabase/server'
import { captureServerEvent } from '@/lib/posthog/server'
import { cleanSelfTags, COMMUNITY_TAGS } from '@/lib/benefits/match'

// The member's own answers about which groups they belong to, used only to match funding. Private: never
// shown to employers, recruiters, schools or coaches, and nothing here reads the EEOC survey fields.
export async function saveFundingTags(formData: FormData): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const profile = await getOrCreateCandidateProfile(user.id)
  const tags = cleanSelfTags(formData.getAll('tag'))
  // Opt-in to use the answers they already gave in the voluntary self-ID survey. The answers are read at match time and never copied here.
  const useSelfId = formData.get('useSelfId') === 'on'
  const details = { ...((profile.journeyDetails as Record<string, unknown> | null) ?? {}), funding: { tags, useSelfId, savedAt: new Date().toISOString() } }
  await prisma.candidateProfile.update({ where: { id: profile.id }, data: { journeyDetails: details as never } })
  // Community and heritage answers are never sent to analytics: only situation tags and a count.
  captureServerEvent(profile.id, 'funding_tags_saved', { tags: tags.filter((t) => !COMMUNITY_TAGS.has(t)), count: tags.length, communityCount: tags.filter((t) => COMMUNITY_TAGS.has(t)).length, useSelfId })
  revalidatePath('/dashboard/funding')
  revalidatePath('/dashboard')
}
