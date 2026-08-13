import 'server-only'
import { prisma } from '@/lib/prisma'
import type { VideoFormat } from '@prisma/client'
import { extractYouTubeVideoId } from './youtube-video-id'

const YOUTUBE_SEARCH_URL = 'https://www.googleapis.com/youtube/v3/search'
const YOUTUBE_VIDEOS_URL = 'https://www.googleapis.com/youtube/v3/videos'

// Keyword set chosen to surface content a job-searching candidate actually
// cares about. Kept small, fixed, and shared (not per-candidate/dynamic) so
// one refresh serves everyone the same curated pool — admin review still
// gates what's visible, since AUTO_PULLED rows are exactly as removable as
// ADMIN_ADDED ones (see refreshYouTubeVideos below).
const SEARCH_KEYWORDS = [
  'job search tips',
  'interview preparation',
  'resume writing career coach',
  'career transition advice',
  'networking for job seekers',
] as const

const RESULTS_PER_KEYWORD = 10

export function isYouTubeIngestConfigured(): boolean {
  return !!process.env.YOUTUBE_API_KEY
}

let hasLoggedUnconfigured = false

// Parses a YouTube contentDetails.duration ISO 8601 string (e.g. "PT4M13S")
// into whole seconds.
function parseIso8601DurationSeconds(duration: string): number {
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(duration)
  if (!match) return 0
  const [, hours, minutes, seconds] = match
  return (Number(hours) || 0) * 3600 + (Number(minutes) || 0) * 60 + (Number(seconds) || 0)
}

// YouTube Data API v3 has no literal "is this a Short" field on a video
// resource — search.list/videos.list never return one. The documented
// Shorts eligibility window is <=180 seconds (YouTube raised this from the
// original 60s cap in 2024); there's no reliable aspect-ratio signal
// available from contentDetails/snippet either (that would require a
// separate oEmbed/player call per video, impractical at ingest-batch
// scale). So this uses the <=180s duration cutoff as the SOLE signal for
// LONG_FORM vs. SHORT — a deliberate, documented heuristic, not something
// the API guarantees. Consequence: a genuinely long-form video that happens
// to run under 3 minutes will get misclassified as a Short. The reverse
// (a real Short misclassified as long-form) essentially never happens,
// since Shorts are capped at 180s by YouTube itself.
const SHORTS_MAX_DURATION_SECONDS = 180

function formatFromDuration(durationSeconds: number): VideoFormat {
  return durationSeconds <= SHORTS_MAX_DURATION_SECONDS ? 'SHORT' : 'LONG_FORM'
}

interface YouTubeSearchItem {
  id: { videoId: string }
}

interface YouTubeVideoItem {
  id: string
  snippet: {
    title: string
    description: string
    channelTitle: string
    publishedAt: string
    thumbnails: { high?: { url: string }; medium?: { url: string }; default?: { url: string } }
  }
  contentDetails: { duration: string }
}

async function searchVideoIds(apiKey: string, keyword: string): Promise<string[]> {
  const url = new URL(YOUTUBE_SEARCH_URL)
  url.searchParams.set('key', apiKey)
  url.searchParams.set('part', 'snippet')
  url.searchParams.set('type', 'video')
  url.searchParams.set('q', keyword)
  url.searchParams.set('maxResults', String(RESULTS_PER_KEYWORD))
  url.searchParams.set('safeSearch', 'strict')
  url.searchParams.set('relevanceLanguage', 'en')

  const response = await fetch(url.toString())
  if (!response.ok) {
    console.error('YouTube search.list failed:', keyword, response.status, await response.text())
    return []
  }
  const data = (await response.json()) as { items?: YouTubeSearchItem[] }
  return (data.items ?? []).map((item) => item.id.videoId).filter(Boolean)
}

async function fetchVideoDetails(apiKey: string, videoIds: string[]): Promise<YouTubeVideoItem[]> {
  if (videoIds.length === 0) return []
  const results: YouTubeVideoItem[] = []
  // videos.list accepts up to 50 IDs per call.
  for (let i = 0; i < videoIds.length; i += 50) {
    const batch = videoIds.slice(i, i + 50)
    const url = new URL(YOUTUBE_VIDEOS_URL)
    url.searchParams.set('key', apiKey)
    url.searchParams.set('part', 'snippet,contentDetails')
    url.searchParams.set('id', batch.join(','))

    const response = await fetch(url.toString())
    if (!response.ok) {
      console.error('YouTube videos.list failed:', response.status, await response.text())
      continue
    }
    const data = (await response.json()) as { items?: YouTubeVideoItem[] }
    results.push(...(data.items ?? []))
  }
  return results
}

function bestThumbnail(thumbnails: YouTubeVideoItem['snippet']['thumbnails']): string {
  return thumbnails.high?.url ?? thumbnails.medium?.url ?? thumbnails.default?.url ?? ''
}

// Gated entirely on YOUTUBE_API_KEY. When absent, this no-ops cleanly (logs
// once, never throws) — the same "build complete, gate on env presence"
// pattern this codebase uses for other deferred credential-gated
// integrations (Twilio SMS, Google Meet/Calendar/Gmail — all structurally
// wired but inert until real credentials land). Intended to run on a
// schedule via src/app/api/cron/refresh-youtube-content/route.ts.
export async function refreshYouTubeVideos(): Promise<void> {
  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey) {
    if (!hasLoggedUnconfigured) {
      console.log('refreshYouTubeVideos: YOUTUBE_API_KEY not configured — skipping.')
      hasLoggedUnconfigured = true
    }
    return
  }

  const idSet = new Set<string>()
  for (const keyword of SEARCH_KEYWORDS) {
    const ids = await searchVideoIds(apiKey, keyword)
    ids.forEach((id) => idSet.add(id))
  }
  const allIds = [...idSet]
  if (allIds.length === 0) return

  const existing = await prisma.curatedVideo.findMany({
    where: { youtubeVideoId: { in: allIds } },
    select: { youtubeVideoId: true, removedAt: true },
  })
  // An admin removed this video previously — never resurrect it on a later
  // refresh.
  const removedIds = new Set(existing.filter((v) => v.removedAt !== null).map((v) => v.youtubeVideoId))
  const existingIds = new Set(existing.map((v) => v.youtubeVideoId))

  const idsToFetch = allIds.filter((id) => !removedIds.has(id))
  if (idsToFetch.length === 0) return

  const details = await fetchVideoDetails(apiKey, idsToFetch)

  for (const video of details) {
    if (removedIds.has(video.id)) continue // belt-and-suspenders

    const durationSeconds = parseIso8601DurationSeconds(video.contentDetails.duration)
    const data = {
      title: video.snippet.title,
      description: video.snippet.description || null,
      thumbnailUrl: bestThumbnail(video.snippet.thumbnails),
      channelTitle: video.snippet.channelTitle,
      publishedAt: new Date(video.snippet.publishedAt),
      durationSeconds,
      format: formatFromDuration(durationSeconds),
    }

    if (existingIds.has(video.id)) {
      // Refresh metadata only — never touch `source` (an admin may have
      // separately ADMIN_ADDED this same video; keep it that way) or
      // `removedAt`.
      await prisma.curatedVideo.update({ where: { youtubeVideoId: video.id }, data })
    } else {
      await prisma.curatedVideo.create({
        data: { ...data, youtubeVideoId: video.id, source: 'AUTO_PULLED' },
      })
    }
  }
}

export interface FetchedVideoMetadata {
  youtubeVideoId: string
  title: string
  description: string | null
  thumbnailUrl: string
  channelTitle: string
  publishedAt: Date
  durationSeconds: number
  format: VideoFormat
}

// Used by the admin manual-add form: fetches metadata for a single
// admin-pasted YouTube URL or video ID via the same videos.list call.
// Returns null if YOUTUBE_API_KEY isn't configured or the video isn't
// found — callers fall back to a manual-entry form in that case.
export async function fetchYouTubeVideoMetadata(videoIdOrUrl: string): Promise<FetchedVideoMetadata | null> {
  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey) return null

  const videoId = extractYouTubeVideoId(videoIdOrUrl)
  if (!videoId) return null

  const details = await fetchVideoDetails(apiKey, [videoId])
  const video = details[0]
  if (!video) return null

  const durationSeconds = parseIso8601DurationSeconds(video.contentDetails.duration)
  return {
    youtubeVideoId: video.id,
    title: video.snippet.title,
    description: video.snippet.description || null,
    thumbnailUrl: bestThumbnail(video.snippet.thumbnails),
    channelTitle: video.snippet.channelTitle,
    publishedAt: new Date(video.snippet.publishedAt),
    durationSeconds,
    format: formatFromDuration(durationSeconds),
  }
}

export { extractYouTubeVideoId }
