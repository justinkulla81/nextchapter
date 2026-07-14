'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { getOrCreateCandidateProfile } from '@/lib/profile'

async function getAuthedProfile() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  return getOrCreateCandidateProfile(user.id)
}

export type LinkedInUnlockState = { error?: string } | undefined

export async function submitLinkedInUnlock(
  _prevState: LinkedInUnlockState,
  formData: FormData
): Promise<LinkedInUnlockState> {
  const profile = await getAuthedProfile()
  if (!profile) return { error: 'You need to be logged in to do this.' }

  const opennessComfort = Number(formData.get('opennessComfort'))
  const usageFrequency = formData.get('usageFrequency') as string | null
  const profileUpToDate = formData.get('profileUpToDate') as string | null

  if (!Number.isFinite(opennessComfort)) {
    return { error: 'Please answer the openness question first.' }
  }
  if (!usageFrequency) {
    return { error: 'Please pick how often you use LinkedIn.' }
  }
  if (!profileUpToDate) {
    return { error: 'Please confirm whether your profile is up to date.' }
  }

  // Reuses the exact same fields the general Thought Leadership Studio gate
  // is built on (contentComfortLevel/contentVenues) so both entry points —
  // this dedicated LinkedIn page and /dashboard/thought-leadership — share
  // one post generator with no duplicated generation logic.
  await prisma.candidateProfile.update({
    where: { id: profile.id },
    data: {
      linkedinOpennessComfort: opennessComfort,
      linkedinUsageFrequency: usageFrequency,
      linkedinProfileUpToDate: profileUpToDate === 'yes',
      contentComfortLevel: profile.contentComfortLevel ?? opennessComfort,
      contentVenues: profile.contentVenues.includes('LINKEDIN')
        ? profile.contentVenues
        : [...profile.contentVenues, 'LINKEDIN'],
    },
  })

  revalidatePath('/dashboard/linkedin')
}
