import 'server-only'
import { prisma } from '@/lib/prisma'
import type { CuratedVideo } from '@prisma/client'
import { normalizeIndustryBucket } from '@/lib/constants/industry-buckets'

// Popularity signal for "order by most liked/viewed" — a like counts more
// than a click since it's an active, considered signal (and the same
// weighting the Videos points system implicitly uses: liking is worth more
// than merely opening — see VIDEO_REACTION vs VIDEO_WATCHED in
// action-effort.ts). Ties (most commonly: two videos with zero engagement
// yet) fall through to sortCuratedVideos' existing admin-first-then-recency
// order, so a freshly-added, not-yet-watched video doesn't sort to the
// bottom of an otherwise-empty carousel.
const LIKE_WEIGHT = 3
const CLICK_WEIGHT = 1

async function getPopularityScores(videoIds: string[]): Promise<Map<string, number>> {
  if (videoIds.length === 0) return new Map()
  const [likeCounts, clickCounts] = await Promise.all([
    prisma.contentLike.groupBy({
      by: ['contentId'],
      where: { contentType: 'CURATED_VIDEO', contentId: { in: videoIds } },
      _count: { contentId: true },
    }),
    prisma.contentClick.groupBy({
      by: ['contentId'],
      where: { contentType: 'CURATED_VIDEO', contentId: { in: videoIds } },
      _count: { contentId: true },
    }),
  ])
  const scores = new Map<string, number>()
  for (const row of likeCounts) scores.set(row.contentId, (scores.get(row.contentId) ?? 0) + row._count.contentId * LIKE_WEIGHT)
  for (const row of clickCounts) scores.set(row.contentId, (scores.get(row.contentId) ?? 0) + row._count.contentId * CLICK_WEIGHT)
  return scores
}

// Manually-added items must sort BEFORE auto-pulled items within each
// format group (per spec), each group then sorted by recency. This is the
// fallback/tiebreak order — sortCuratedVideosByPopularity (below) is the
// one actually used for candidate-facing carousels now that videos sort by
// most liked/viewed first.
//
// This can't be done with `orderBy: [{ source: 'asc' }, ...]` — Prisma
// sorts enums by their DECLARATION order in schema.prisma, not
// alphabetically, and VideoContentSource is declared `AUTO_PULLED` then
// `ADMIN_ADDED`, so a plain ascending orderBy would put AUTO_PULLED first,
// the opposite of what's needed. Sorted explicitly in application code
// instead. Used as-is by the admin curation page (which has no popularity
// concept — admins curate by recency, not by candidate engagement).
export function sortCuratedVideos(videos: CuratedVideo[]): CuratedVideo[] {
  return [...videos].sort((a, b) => {
    if (a.source !== b.source) return a.source === 'ADMIN_ADDED' ? -1 : 1
    return b.publishedAt.getTime() - a.publishedAt.getTime()
  })
}

// Candidate-facing sort: most liked/viewed first, falling back to
// sortCuratedVideos' admin-first-then-recency order to break ties (most
// commonly zero-engagement videos, which are the majority of any freshly
// ingested pool).
async function sortCuratedVideosByPopularity(videos: CuratedVideo[]): Promise<CuratedVideo[]> {
  const scores = await getPopularityScores(videos.map((v) => v.id))
  return sortCuratedVideos(videos).sort((a, b) => (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0))
}

// candidateId is optional and personalizes the result two ways when given:
//   1. individual dislikes — any CuratedVideo the candidate has thumbs-down'd
//      is excluded outright.
//   2. author block — if the candidate has 2+ dislikes against the same
//      channelTitle (across CURATED_VIDEO, which covers both long-form and
//      Shorts), every video from that channel is excluded, not just the
//      individually-disliked ones.
// Called with NO candidateId from the admin curation page
// (src/app/support/admin/(portal)/webinars/page.tsx) deliberately — dislikes
// are per-candidate personalization, not a global removal, so admin always
// sees the full unfiltered catalog to curate it.
//
// toolsForYou is the personalized "Tools for You" carousel — category =
// AI_TOOLS rows whose aiToolIndustry or aiToolFunction matches the
// candidate's own industry, secondary industry, target function, or
// secondary function (either dimension matching is enough — a video tagged
// for the candidate's function is just as relevant as one tagged for their
// industry). No candidateId (admin) returns every tagged AI_TOOLS row
// regardless of match, same rationale as dislikes above.
//
// If nothing is tagged for any of the candidate's four signals, toolsForYou
// falls back to the same cross-industry/cross-function pool aiTips reads
// (industry-leading tools like ChatGPT/HubSpot that apply broadly) rather
// than rendering empty — a candidate should never see "nothing here" when
// there's genuinely useful AI-tool content available, even if it isn't
// precision-matched to them.
//
// aiTips is the separate, non-personalized "AI Tips & Tools" carousel —
// the AI_TOOLS rows with BOTH aiToolIndustry and aiToolFunction null (the
// true cross-industry/cross-function pool). Always visible to everyone
// regardless of match, so "why was this recommended" stays honest per
// section rather than mixing matched and unmatched reasons in one list.
export async function getCarouselVideos(candidateId?: string): Promise<{
  longForm: CuratedVideo[]
  shorts: CuratedVideo[]
  toolsForYou: CuratedVideo[]
  aiTips: CuratedVideo[]
}> {
  const videos = await prisma.curatedVideo.findMany({ where: { removedAt: null } })

  let filtered = videos
  if (candidateId) {
    const dislikes = await prisma.contentDislike.findMany({
      where: { candidateId, contentType: 'CURATED_VIDEO' },
      select: { contentId: true, channelTitle: true },
    })

    const dislikedIds = new Set(dislikes.map((d) => d.contentId))

    const channelDislikeCounts = new Map<string, number>()
    for (const d of dislikes) {
      if (!d.channelTitle) continue
      channelDislikeCounts.set(d.channelTitle, (channelDislikeCounts.get(d.channelTitle) ?? 0) + 1)
    }
    const blockedChannels = new Set(
      [...channelDislikeCounts.entries()].filter(([, count]) => count >= 2).map(([channel]) => channel)
    )

    filtered = videos.filter(
      (v) => !dislikedIds.has(v.id) && !blockedChannels.has(v.channelTitle)
    )
  }

  const general = filtered.filter((v) => v.category === 'GENERAL')
  const aiToolVideos = filtered.filter((v) => v.category === 'AI_TOOLS')
  const aiTips = aiToolVideos.filter((v) => v.aiToolIndustry === null && v.aiToolFunction === null)
  const taggedAiTools = aiToolVideos.filter((v) => v.aiToolIndustry !== null || v.aiToolFunction !== null)

  let toolsForYou = taggedAiTools
  if (candidateId) {
    const profile = await prisma.candidateProfile.findUnique({
      where: { id: candidateId },
      select: { industryBucket: true, secondaryIndustryContext: true, targetFunction: true, secondaryFunction: true },
    })
    const industryMatches = new Set(
      [profile?.industryBucket, normalizeIndustryBucket(profile?.secondaryIndustryContext ?? null)].filter(
        (v): v is string => !!v
      )
    )
    const functionMatches = new Set([profile?.targetFunction, profile?.secondaryFunction].filter((v): v is string => !!v))

    const matched = taggedAiTools.filter(
      (v) =>
        (v.aiToolIndustry !== null && industryMatches.has(v.aiToolIndustry)) ||
        (v.aiToolFunction !== null && functionMatches.has(v.aiToolFunction))
    )
    toolsForYou = matched.length > 0 ? matched : aiTips
  }

  return {
    longForm: await sortCuratedVideosByPopularity(general.filter((v) => v.format === 'LONG_FORM')),
    shorts: await sortCuratedVideosByPopularity(general.filter((v) => v.format === 'SHORT')),
    toolsForYou: await sortCuratedVideosByPopularity(toolsForYou),
    aiTips: await sortCuratedVideosByPopularity(aiTips),
  }
}

// The "LinkedIn Posting Tips" carousel on the Marketing Plan page —
// category = LINKEDIN_TIPS, same catalog for every candidate (no industry
// personalization, per spec). candidateId optional, same
// dislike-only-no-author-block rationale as getCarouselPodcasts (LinkedIn
// tip videos have no "author block" concept — one channel posting a bad
// tip video doesn't mean their other content is bad).
export async function getLinkedInTipsVideos(candidateId?: string): Promise<CuratedVideo[]> {
  const videos = await prisma.curatedVideo.findMany({
    where: { removedAt: null, category: 'LINKEDIN_TIPS' },
  })

  if (!candidateId) return sortCuratedVideos(videos)

  const dislikes = await prisma.contentDislike.findMany({
    where: { candidateId, contentType: 'CURATED_VIDEO' },
    select: { contentId: true },
  })
  const dislikedIds = new Set(dislikes.map((d) => d.contentId))
  return sortCuratedVideos(videos.filter((v) => !dislikedIds.has(v.id)))
}

// candidateId optional, same admin-vs-candidate rationale as
// getCarouselVideos above. Podcasts have no "author" concept (per spec), so
// only individual dislikes are filtered — no block-by-author logic here.
export async function getCarouselPodcasts(candidateId?: string) {
  const podcasts = await prisma.podcast.findMany({
    where: { removedAt: null },
    orderBy: { publishedAt: 'desc' },
  })

  if (!candidateId) return podcasts

  const dislikes = await prisma.contentDislike.findMany({
    where: { candidateId, contentType: 'PODCAST' },
    select: { contentId: true },
  })
  const dislikedIds = new Set(dislikes.map((d) => d.contentId))
  return podcasts.filter((p) => !dislikedIds.has(p.id))
}
