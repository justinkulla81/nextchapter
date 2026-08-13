'use server'

import { revalidatePath } from 'next/cache'
import type { ContentLikeType } from '@prisma/client'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { registerForWebinar } from '@/lib/webinars/webinars'
import { toggleContentLike } from '@/lib/content/content-likes'
import { captureServerEvent } from '@/lib/posthog/server'

async function getAuthedProfile() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  return getOrCreateCandidateProfile(user.id)
}

export async function registerForWebinarAction(webinarId: string) {
  const profile = await getAuthedProfile()
  if (!profile) return
  await registerForWebinar(webinarId, profile.id)
  revalidatePath('/dashboard/webinars')
}

// Backing action for ContentLikeButton, shared by all four carousels
// (contentType distinguishes which). See toggleContentLike for the
// like/unlike + first-like-only feed-post behavior.
export async function toggleContentLikeAction(contentType: ContentLikeType, contentId: string, title: string) {
  const profile = await getAuthedProfile()
  if (!profile) return
  const result = await toggleContentLike(profile.id, { contentType, contentId, title })
  captureServerEvent(profile.id, 'content_liked', { contentType, contentId, liked: result.liked })
  revalidatePath('/dashboard/webinars')
  revalidatePath('/dashboard/community')
}
