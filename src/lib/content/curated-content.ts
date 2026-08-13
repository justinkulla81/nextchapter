import 'server-only'
import { prisma } from '@/lib/prisma'
import type { CuratedVideo } from '@prisma/client'

// Manually-added items must sort BEFORE auto-pulled items within each
// format group (per spec), each group then sorted by recency.
//
// This can't be done with `orderBy: [{ source: 'asc' }, ...]` — Prisma
// sorts enums by their DECLARATION order in schema.prisma, not
// alphabetically, and VideoContentSource is declared `AUTO_PULLED` then
// `ADMIN_ADDED`, so a plain ascending orderBy would put AUTO_PULLED first,
// the opposite of what's needed. Sorted explicitly in application code
// instead. Shared by both the candidate carousel (getCarouselVideos) and
// the admin curation page so both read the same order.
export function sortCuratedVideos(videos: CuratedVideo[]): CuratedVideo[] {
  return [...videos].sort((a, b) => {
    if (a.source !== b.source) return a.source === 'ADMIN_ADDED' ? -1 : 1
    return b.publishedAt.getTime() - a.publishedAt.getTime()
  })
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
// aiTools is the "Tools for You" carousel (category = AI_TOOLS, see
// youtube-ingest.ts's refreshAiToolVideos). With a candidateId, it's
// narrowed to that candidate's industryBucket when there's a match,
// falling back to the cross-industry pool (aiToolIndustry === null) when
// there isn't — never an empty section just because their specific
// industry hasn't been ingested yet. No candidateId (admin) returns every
// AI_TOOLS video unfiltered by industry, same rationale as dislikes above.
export async function getCarouselVideos(
  candidateId?: string
): Promise<{ longForm: CuratedVideo[]; shorts: CuratedVideo[]; aiTools: CuratedVideo[] }> {
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

  let aiTools = aiToolVideos
  if (candidateId) {
    const profile = await prisma.candidateProfile.findUnique({
      where: { id: candidateId },
      select: { industryBucket: true },
    })
    const matching = profile?.industryBucket
      ? aiToolVideos.filter((v) => v.aiToolIndustry === profile.industryBucket)
      : []
    aiTools = matching.length > 0 ? matching : aiToolVideos.filter((v) => v.aiToolIndustry === null)
  }

  return {
    longForm: sortCuratedVideos(general.filter((v) => v.format === 'LONG_FORM')),
    shorts: sortCuratedVideos(general.filter((v) => v.format === 'SHORT')),
    aiTools: sortCuratedVideos(aiTools),
  }
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
