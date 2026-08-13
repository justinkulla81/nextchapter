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

async function searchVideoIds(apiKey: string, keyword: string, videoDuration?: 'short'): Promise<string[]> {
  const url = new URL(YOUTUBE_SEARCH_URL)
  url.searchParams.set('key', apiKey)
  url.searchParams.set('part', 'snippet')
  url.searchParams.set('type', 'video')
  url.searchParams.set('q', keyword)
  url.searchParams.set('maxResults', String(RESULTS_PER_KEYWORD))
  url.searchParams.set('safeSearch', 'strict')
  url.searchParams.set('relevanceLanguage', 'en')
  // YouTube's own "short" bucket (<4min) is broader than our own <=180s
  // Shorts cutoff below, but it's a much better prior than an unfiltered
  // search — most generic job-search-keyword results are long-form, so
  // without this the Shorts carousel ends up thin (only the rare video
  // that happens to run under 3 minutes). formatFromDuration() still makes
  // the final LONG_FORM/SHORT call per-video from the real duration either
  // way, so this can never misclassify anything — it only changes which
  // videos get considered at all.
  if (videoDuration) url.searchParams.set('videoDuration', videoDuration)

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

// Shared by refreshYouTubeVideos and refreshAiToolVideos below — fetches
// details for a batch of video IDs and upserts each into CuratedVideo.
// categoryData is merged into both the create and update payload, so an
// AI-tools video that also happens to match a later general-keyword refresh
// (or vice versa) always ends up tagged by whichever pass runs LAST — see
// refreshAiToolVideos' own comment for why that's the desired order.
async function ingestVideoIds(
  apiKey: string,
  ids: string[],
  categoryData: { category: 'GENERAL' | 'AI_TOOLS'; aiToolIndustry: string | null }
): Promise<void> {
  if (ids.length === 0) return

  const existing = await prisma.curatedVideo.findMany({
    where: { youtubeVideoId: { in: ids } },
    select: { youtubeVideoId: true, removedAt: true },
  })
  // An admin removed this video previously — never resurrect it on a later
  // refresh.
  const removedIds = new Set(existing.filter((v) => v.removedAt !== null).map((v) => v.youtubeVideoId))
  const existingIds = new Set(existing.map((v) => v.youtubeVideoId))

  const idsToFetch = ids.filter((id) => !removedIds.has(id))
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
      ...categoryData,
    }

    if (existingIds.has(video.id)) {
      // Never touch `source` (an admin may have separately ADMIN_ADDED this
      // same video; keep it that way) or `removedAt`.
      await prisma.curatedVideo.update({ where: { youtubeVideoId: video.id }, data })
    } else {
      await prisma.curatedVideo.create({
        data: { ...data, youtubeVideoId: video.id, source: 'AUTO_PULLED' },
      })
    }
  }
}

// One search per topic — a fixed cross-industry query plus one per
// well-represented industry bucket (chosen from
// src/lib/constants/industry-buckets.ts as the buckets that reliably surface
// real AI-tool vendor/explainer content on YouTube; the full ~27-bucket list
// would mostly return nothing for niches like Aerospace & Defense). Query
// phrasing leans on "demo"/"explainer" language since that's what actually
// surfaces vendor-made content (e.g. a "Stacks AI for CFOs" style video)
// rather than third-party listicles — best-effort, not guaranteed, same as
// the Shorts duration heuristic above.
const AI_TOOL_TOPICS: { industry: string | null; query: string }[] = [
  { industry: null, query: 'best AI tools for professionals 2026 demo' },
  { industry: 'Financial Services & Banking', query: 'AI tools for finance teams CFO demo explainer' },
  { industry: 'Technology & Software', query: 'AI coding tools for software engineers demo' },
  { industry: 'Advertising, Marketing & PR', query: 'AI tools for marketers demo explainer' },
  { industry: 'Healthcare & Hospital Systems', query: 'AI tools for healthcare professionals demo' },
  { industry: 'Legal Services', query: 'AI tools for lawyers legal teams demo' },
  { industry: 'Staffing & Human Capital', query: 'AI tools for HR recruiting teams demo' },
  { industry: 'Transportation & Logistics', query: 'AI tools for supply chain logistics demo' },
  { industry: 'Retail & E-commerce', query: 'AI tools for retail e-commerce teams demo' },
  { industry: 'Professional Services & Consulting', query: 'AI tools for consultants demo explainer' },
]

// Populates the "Tools for You" carousel — same YOUTUBE_API_KEY gate and
// upsert mechanics as refreshYouTubeVideos, just a different search pass and
// the AI_TOOLS category tag. Called from within refreshYouTubeVideos (after
// the general pass) rather than as a second cron entry point, so a video
// that matches BOTH a general job-search keyword and an AI-tool topic ends
// up correctly tagged AI_TOOLS (the more specific category) regardless of
// search order.
async function refreshAiToolVideos(apiKey: string): Promise<void> {
  for (const topic of AI_TOOL_TOPICS) {
    const ids = await searchVideoIds(apiKey, topic.query)
    await ingestVideoIds(apiKey, ids, { category: 'AI_TOOLS', aiToolIndustry: topic.industry })
  }
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
    const generalIds = await searchVideoIds(apiKey, keyword)
    generalIds.forEach((id) => idSet.add(id))
    // Dedicated shorts-duration pass per keyword — without this, the Shorts
    // carousel only ever gets the rare video that happens to run under 3
    // minutes out of an otherwise long-form-heavy result set (most
    // job-search content is long-form), leaving it much thinner than the
    // Videos carousel. See searchVideoIds' own comment.
    const shortIds = await searchVideoIds(apiKey, keyword, 'short')
    shortIds.forEach((id) => idSet.add(id))
  }
  await ingestVideoIds(apiKey, [...idSet], { category: 'GENERAL', aiToolIndustry: null })

  await refreshAiToolVideos(apiKey)
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
