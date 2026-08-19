'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { createWebinar } from '@/lib/webinars/webinars'
import { fetchYouTubeVideoMetadata, extractYouTubeVideoId, isYouTubeIngestConfigured } from '@/lib/content/youtube-ingest'
import { captureServerEvent } from '@/lib/posthog/server'
import { VideoCategory } from '@prisma/client'

export type FormState = { error?: string } | undefined

export async function createWebinarAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin()

  const title = (formData.get('title') as string | null)?.trim()
  const description = (formData.get('description') as string | null)?.trim() || null
  const hostLabel = (formData.get('hostLabel') as string | null)?.trim()
  const scheduledAtRaw = formData.get('scheduledAt') as string | null
  const durationMinutes = Number(formData.get('durationMinutes')) || 45

  if (!title || !hostLabel || !scheduledAtRaw) {
    return { error: 'Title, host, and date/time are required.' }
  }
  const scheduledAt = new Date(scheduledAtRaw)
  if (Number.isNaN(scheduledAt.getTime())) {
    return { error: 'Invalid date/time.' }
  }

  const webinar = await createWebinar({ title, description, hostLabel, scheduledAt, durationMinutes })
  captureServerEvent(admin?.email ?? 'admin', 'webinar_created', { webinarId: webinar.id })

  revalidatePath('/support/admin/webinars')
  return undefined
}

export async function cancelWebinarAction(webinarId: string) {
  const admin = await requireAdmin()
  await prisma.webinar.update({ where: { id: webinarId }, data: { cancelledAt: new Date() } })
  captureServerEvent(admin?.email ?? 'admin', 'webinar_cancelled', { webinarId })
  revalidatePath('/support/admin/webinars')
}

// Admin pastes a YouTube URL or bare video ID. If YOUTUBE_API_KEY is
// configured, metadata (title/thumbnail/channel/duration/publishedAt) is
// fetched automatically via the same videos.list call the ingest cron uses.
// If it isn't configured (or the fetch fails), the admin's manually-typed
// title/thumbnailUrl are used instead — so this form isn't fully blocked by
// the missing credential. Always source: 'ADMIN_ADDED', so it sorts ahead
// of AUTO_PULLED rows (see sortCuratedVideos).
export async function addCuratedVideoAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin()

  const videoIdOrUrl = (formData.get('videoIdOrUrl') as string | null)?.trim()
  const manualTitle = (formData.get('title') as string | null)?.trim()
  const manualThumbnailUrl = (formData.get('thumbnailUrl') as string | null)?.trim()
  const videoIndustry = (formData.get('videoIndustry') as string | null)?.trim() || null
  const videoFunction = (formData.get('videoFunction') as string | null)?.trim() || null
  const videoSkill = (formData.get('videoSkill') as string | null)?.trim() || null
  const categoryRaw = formData.get('category') as string | null
  const category: VideoCategory = categoryRaw && categoryRaw in VideoCategory ? (categoryRaw as VideoCategory) : 'GENERAL'

  if (!videoIdOrUrl) {
    return { error: 'Paste a YouTube URL or video ID.' }
  }
  const youtubeVideoId = extractYouTubeVideoId(videoIdOrUrl)
  if (!youtubeVideoId) {
    return { error: "Couldn't read a video ID from that — paste the full URL or the 11-character video ID." }
  }

  const existing = await prisma.curatedVideo.findUnique({ where: { youtubeVideoId } })
  if (existing && !existing.removedAt) {
    return { error: 'This video is already in the carousel.' }
  }

  const fetched = isYouTubeIngestConfigured() ? await fetchYouTubeVideoMetadata(videoIdOrUrl) : null

  if (!fetched && (!manualTitle || !manualThumbnailUrl)) {
    return {
      error: isYouTubeIngestConfigured()
        ? "Couldn't fetch that video's details — enter a title and thumbnail URL manually."
        : 'YouTube API key is not configured yet — enter a title and thumbnail URL manually.',
    }
  }

  const data = fetched
    ? {
        title: fetched.title,
        description: fetched.description,
        thumbnailUrl: fetched.thumbnailUrl,
        channelTitle: fetched.channelTitle,
        publishedAt: fetched.publishedAt,
        durationSeconds: fetched.durationSeconds,
        format: fetched.format,
      }
    : {
        title: manualTitle!,
        description: null,
        thumbnailUrl: manualThumbnailUrl!,
        channelTitle: 'Unknown',
        publishedAt: new Date(),
        durationSeconds: 0,
        // No duration signal without the API — default to LONG_FORM; admin
        // can remove/re-add once the API key lands if this guess is wrong.
        format: 'LONG_FORM' as const,
      }

  if (existing) {
    await prisma.curatedVideo.update({
      where: { id: existing.id },
      data: { ...data, category, videoIndustry, videoFunction, videoSkill, source: 'ADMIN_ADDED', addedByAdminId: admin.id, removedAt: null },
    })
  } else {
    await prisma.curatedVideo.create({
      data: { ...data, category, videoIndustry, videoFunction, videoSkill, youtubeVideoId, source: 'ADMIN_ADDED', addedByAdminId: admin.id },
    })
  }

  captureServerEvent(admin?.email ?? 'admin', 'curated_video_added', { youtubeVideoId })
  revalidatePath('/support/admin/webinars')
  return undefined
}

export async function removeCuratedVideoAction(videoId: string) {
  const admin = await requireAdmin()
  await prisma.curatedVideo.update({ where: { id: videoId }, data: { removedAt: new Date() } })
  captureServerEvent(admin?.email ?? 'admin', 'curated_video_removed', { videoId })
  revalidatePath('/support/admin/webinars')
}

export async function createPodcastAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin()

  const title = (formData.get('title') as string | null)?.trim()
  const description = (formData.get('description') as string | null)?.trim() || null
  const thumbnailUrl = (formData.get('thumbnailUrl') as string | null)?.trim() || null
  const appleUrl = (formData.get('appleUrl') as string | null)?.trim() || null
  const spotifyUrl = (formData.get('spotifyUrl') as string | null)?.trim() || null
  const youtubeUrl = (formData.get('youtubeUrl') as string | null)?.trim() || null
  const publishedAtRaw = formData.get('publishedAt') as string | null

  if (!title) {
    return { error: 'Title is required.' }
  }
  if (!appleUrl && !spotifyUrl && !youtubeUrl) {
    return { error: 'Add at least one platform link (Apple Podcasts, Spotify, or YouTube).' }
  }
  const publishedAt = publishedAtRaw ? new Date(publishedAtRaw) : new Date()
  if (Number.isNaN(publishedAt.getTime())) {
    return { error: 'Invalid publish date.' }
  }

  const podcast = await prisma.podcast.create({
    data: { title, description, thumbnailUrl, appleUrl, spotifyUrl, youtubeUrl, publishedAt },
  })
  captureServerEvent(admin?.email ?? 'admin', 'podcast_added', { podcastId: podcast.id })

  revalidatePath('/support/admin/webinars')
  return undefined
}

export async function removePodcastAction(podcastId: string) {
  const admin = await requireAdmin()
  await prisma.podcast.update({ where: { id: podcastId }, data: { removedAt: new Date() } })
  captureServerEvent(admin?.email ?? 'admin', 'podcast_removed', { podcastId })
  revalidatePath('/support/admin/webinars')
}
