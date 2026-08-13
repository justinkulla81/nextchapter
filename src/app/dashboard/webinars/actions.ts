'use server'

import { revalidatePath } from 'next/cache'
import type { ContentLikeType } from '@prisma/client'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { registerForWebinar } from '@/lib/webinars/webinars'
import { toggleContentLike } from '@/lib/content/content-likes'
import { dislikeContent } from '@/lib/content/content-dislikes'
import { logContentClick } from '@/lib/content/content-clicks'
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

// Backing action for ContentDislikeButton, shared by all four carousels.
// One-directional (see dislikeContent) — un-likes the item if it was liked,
// and for CURATED_VIDEO/Shorts and Podcasts excludes it from this
// candidate's future carousel queries (getCarouselVideos/getCarouselPodcasts
// take the candidateId and filter on ContentDislike). Two dislikes against
// the same CuratedVideo.channelTitle additionally blocks that whole channel
// — see getCarouselVideos in src/lib/content/curated-content.ts.
export async function dislikeContentAction(contentType: ContentLikeType, contentId: string) {
  const profile = await getAuthedProfile()
  if (!profile) return
  await dislikeContent(profile.id, { contentType, contentId })
  captureServerEvent(profile.id, 'content_disliked', { contentType, contentId })
  revalidatePath('/dashboard/webinars')
}

// Fire-and-forget click log — called from CuratedVideoCard.tsx/PodcastCard.tsx
// without awaiting, alongside opening VideoPlayerModal. No revalidatePath:
// this has no visible UI effect of its own (per design-principles.md, the
// video player opening IS the click's real feedback — logging it is a
// silent side effect, not the primary action), and no return value is read.
export async function logContentClickAction(contentType: ContentLikeType, contentId: string) {
  const profile = await getAuthedProfile()
  if (!profile) return
  await logContentClick(profile.id, contentType, contentId)
  captureServerEvent(profile.id, 'content_clicked', { contentType, contentId })
}
