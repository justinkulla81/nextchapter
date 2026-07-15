'use server'

import { revalidatePath } from 'next/cache'
import type { ContentVenue } from '@prisma/client'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { generatePostIdeas, draftPost, type PostIdea } from '@/lib/network/thought-leadership'

async function getAuthedProfile() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  return getOrCreateCandidateProfile(user.id)
}

export type UnlockFormState = { error?: string } | undefined

export async function submitThoughtLeadershipUnlock(
  _prevState: UnlockFormState,
  formData: FormData
): Promise<UnlockFormState> {
  const profile = await getAuthedProfile()
  if (!profile) return { error: 'You need to be logged in to do this.' }

  const comfortLevel = Number(formData.get('comfortLevel'))
  const venues = formData.getAll('venues') as ContentVenue[]

  if (!Number.isFinite(comfortLevel)) {
    return { error: 'Please answer the comfort question first.' }
  }
  if (venues.length === 0) {
    return { error: 'Pick at least one venue.' }
  }

  await prisma.candidateProfile.update({
    where: { id: profile.id },
    data: { contentComfortLevel: comfortLevel, contentVenues: venues },
  })

  revalidatePath('/dashboard/thought-leadership')
}

export type IdeasFormState = { ideas?: PostIdea[]; error?: string } | undefined

export async function generateIdeasAction(_prevState: IdeasFormState): Promise<IdeasFormState> {
  const profile = await getAuthedProfile()
  if (!profile) return { error: 'You need to be logged in to do this.' }

  const ideas = await generatePostIdeas(profile.id)
  if (ideas.length === 0) return { error: 'Could not generate ideas right now — try again in a moment.' }
  return { ideas }
}

export type DraftFormState = { draft?: string; error?: string } | undefined

export async function draftPostAction(
  _prevState: DraftFormState,
  formData: FormData
): Promise<DraftFormState> {
  const profile = await getAuthedProfile()
  if (!profile) return { error: 'You need to be logged in to do this.' }

  const title = formData.get('title') as string | null
  const angle = formData.get('angle') as string | null
  const venue = formData.get('venue') as ContentVenue | null
  if (!title || !angle) return { error: 'Missing idea details.' }
  if (!venue) return { error: 'Pick a venue to draft for.' }

  const draft = await draftPost(profile.id, { title, angle }, venue)
  return { draft }
}

export async function generateArticleAction(
  _prevState: DraftFormState,
  formData: FormData
): Promise<DraftFormState> {
  const profile = await getAuthedProfile()
  if (!profile) return { error: 'You need to be logged in to do this.' }

  const topic = (formData.get('topic') as string | null)?.trim()
  if (!topic) return { error: 'Give it a topic or angle first.' }

  const draft = await draftPost(profile.id, { title: topic, angle: topic }, 'SUBSTACK')
  return { draft }
}
