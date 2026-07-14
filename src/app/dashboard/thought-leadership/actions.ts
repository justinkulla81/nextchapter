'use server'

import { createClient } from '@/lib/supabase/server'
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
  if (!title || !angle) return { error: 'Missing idea details.' }

  const draft = await draftPost(profile.id, { title, angle })
  return { draft }
}
