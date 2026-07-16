'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { generateHeadshot, generateLinkedInBanner } from '@/lib/ai/nanobanana'
import { captureServerEvent } from '@/lib/posthog/server'

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

export type ImageGenState =
  | { error: string; image?: undefined }
  | { image: { dataUrl: string }; error?: undefined }
  | undefined

const MAX_PHOTO_BYTES = 10 * 1024 * 1024

export async function generateHeadshotAction(
  _prevState: ImageGenState,
  formData: FormData
): Promise<ImageGenState> {
  const profile = await getAuthedProfile()
  if (!profile) return { error: 'You need to be logged in to do this.' }

  const file = formData.get('photo') as File | null
  if (!file || file.size === 0) return { error: 'Please choose a photo first.' }
  if (file.size > MAX_PHOTO_BYTES) return { error: 'Photo is too large — please use one under 10MB.' }
  if (!file.type.startsWith('image/')) return { error: 'Please upload an image file (JPG or PNG).' }

  try {
    const buffer = await file.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')
    const result = await generateHeadshot(base64, file.type)
    captureServerEvent(profile.id, 'linkedin_headshot_generated')
    return { image: { dataUrl: `data:${result.mimeType};base64,${result.base64}` } }
  } catch (error) {
    console.error('Headshot generation failed:', error)
    return { error: "Something went wrong generating your headshot — please try again." }
  }
}

export async function generateBannerAction(
  _prevState: ImageGenState,
  _formData: FormData
): Promise<ImageGenState> {
  const profile = await getAuthedProfile()
  if (!profile) return { error: 'You need to be logged in to do this.' }

  try {
    const result = await generateLinkedInBanner(profile.primaryFunction)
    captureServerEvent(profile.id, 'linkedin_banner_generated')
    return { image: { dataUrl: `data:${result.mimeType};base64,${result.base64}` } }
  } catch (error) {
    console.error('Banner generation failed:', error)
    return { error: "Something went wrong generating your banner — please try again." }
  }
}
