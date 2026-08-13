import 'server-only'
import { prisma } from '@/lib/prisma'
import type { ContentLikeType, CuratedVideo } from '@prisma/client'
import { contentLikeKey } from '@/lib/content/content-likes'

export interface ContentStatsRow {
  contentType: ContentLikeType
  contentId: string
  title: string
  formatLabel: 'Video' | 'Short' | 'AI Tool Video' | 'AI Tool Short' | 'LinkedIn Tip' | 'Webinar' | 'Podcast'
  likeCount: number
  dislikeCount: number
  clickCount: number
}

function videoFormatLabel(v: Pick<CuratedVideo, 'category' | 'format'>): ContentStatsRow['formatLabel'] {
  if (v.category === 'LINKEDIN_TIPS') return 'LinkedIn Tip'
  if (v.category === 'AI_TOOLS') return v.format === 'SHORT' ? 'AI Tool Short' : 'AI Tool Video'
  return v.format === 'SHORT' ? 'Short' : 'Video'
}

export interface AuthorStatsRow {
  channelTitle: string
  likeCount: number
  dislikeCount: number
  // Count of distinct candidates who've individually hit the 2-dislike
  // threshold against this channel — the same threshold getCarouselVideos
  // uses to exclude the channel from that candidate's carousels.
  // Informational only, computed live, no stored flag.
  blockedForCandidates: number
}

// Powers the admin Stats tab (src/app/support/admin/(portal)/webinars/page.tsx).
// Only currently-active catalog items (not removed/cancelled) get a row in
// the per-item table — same scope as the other tabs on that page — but the
// author rollup sums likes/dislikes against ALL CuratedVideo rows ever
// created (including removed ones), since a channel's reputation shouldn't
// reset just because one of its videos was later pulled from the carousel.
export async function getAdminContentStats(): Promise<{ items: ContentStatsRow[]; authors: AuthorStatsRow[] }> {
  const [videos, podcasts, webinars, allVideosForChannelLookup] = await Promise.all([
    prisma.curatedVideo.findMany({ where: { removedAt: null } }),
    prisma.podcast.findMany({ where: { removedAt: null } }),
    prisma.webinar.findMany({ where: { cancelledAt: null } }),
    prisma.curatedVideo.findMany({ select: { id: true, channelTitle: true } }),
  ])

  const [likeCounts, dislikeCounts, clickCounts, channelDislikesByCandidate] = await Promise.all([
    prisma.contentLike.groupBy({ by: ['contentType', 'contentId'], _count: { _all: true } }),
    prisma.contentDislike.groupBy({ by: ['contentType', 'contentId'], _count: { _all: true } }),
    prisma.contentClick.groupBy({ by: ['contentType', 'contentId'], _count: { _all: true } }),
    prisma.contentDislike.groupBy({
      by: ['channelTitle', 'candidateId'],
      where: { contentType: 'CURATED_VIDEO', channelTitle: { not: null } },
      _count: { _all: true },
    }),
  ])

  const likeMap = new Map(likeCounts.map((l) => [contentLikeKey(l.contentType, l.contentId), l._count._all]))
  const dislikeMap = new Map(dislikeCounts.map((d) => [contentLikeKey(d.contentType, d.contentId), d._count._all]))
  const clickMap = new Map(clickCounts.map((c) => [contentLikeKey(c.contentType, c.contentId), c._count._all]))
  const countFor = (map: Map<string, number>, type: ContentLikeType, id: string) =>
    map.get(contentLikeKey(type, id)) ?? 0

  const items: ContentStatsRow[] = [
    ...videos.map((v) => ({
      contentType: 'CURATED_VIDEO' as const,
      contentId: v.id,
      title: v.title,
      formatLabel: videoFormatLabel(v),
      likeCount: countFor(likeMap, 'CURATED_VIDEO', v.id),
      dislikeCount: countFor(dislikeMap, 'CURATED_VIDEO', v.id),
      clickCount: countFor(clickMap, 'CURATED_VIDEO', v.id),
    })),
    ...podcasts.map((p) => ({
      contentType: 'PODCAST' as const,
      contentId: p.id,
      title: p.title,
      formatLabel: 'Podcast' as const,
      likeCount: countFor(likeMap, 'PODCAST', p.id),
      dislikeCount: countFor(dislikeMap, 'PODCAST', p.id),
      clickCount: countFor(clickMap, 'PODCAST', p.id),
    })),
    ...webinars.map((w) => ({
      contentType: 'WEBINAR' as const,
      contentId: w.id,
      title: w.title,
      formatLabel: 'Webinar' as const,
      likeCount: countFor(likeMap, 'WEBINAR', w.id),
      dislikeCount: countFor(dislikeMap, 'WEBINAR', w.id),
      clickCount: countFor(clickMap, 'WEBINAR', w.id),
    })),
    // Most-disliked first (surfaces problem content), ties broken by most-clicked.
  ].sort((a, b) => b.dislikeCount - a.dislikeCount || b.clickCount - a.clickCount)

  const channelById = new Map(allVideosForChannelLookup.map((v) => [v.id, v.channelTitle]))
  const authorLikeCounts = new Map<string, number>()
  for (const l of likeCounts) {
    if (l.contentType !== 'CURATED_VIDEO') continue
    const channel = channelById.get(l.contentId)
    if (!channel) continue
    authorLikeCounts.set(channel, (authorLikeCounts.get(channel) ?? 0) + l._count._all)
  }
  const authorDislikeCounts = new Map<string, number>()
  for (const d of dislikeCounts) {
    if (d.contentType !== 'CURATED_VIDEO') continue
    const channel = channelById.get(d.contentId)
    if (!channel) continue
    authorDislikeCounts.set(channel, (authorDislikeCounts.get(channel) ?? 0) + d._count._all)
  }

  const blockedCandidatesByChannel = new Map<string, Set<string>>()
  for (const row of channelDislikesByCandidate) {
    if (!row.channelTitle || row._count._all < 2) continue
    const set = blockedCandidatesByChannel.get(row.channelTitle) ?? new Set<string>()
    set.add(row.candidateId)
    blockedCandidatesByChannel.set(row.channelTitle, set)
  }

  const allChannels = new Set([
    ...authorLikeCounts.keys(),
    ...authorDislikeCounts.keys(),
    ...blockedCandidatesByChannel.keys(),
  ])
  const authors: AuthorStatsRow[] = [...allChannels]
    .map((channelTitle) => ({
      channelTitle,
      likeCount: authorLikeCounts.get(channelTitle) ?? 0,
      dislikeCount: authorDislikeCounts.get(channelTitle) ?? 0,
      blockedForCandidates: blockedCandidatesByChannel.get(channelTitle)?.size ?? 0,
    }))
    // Actually-blocked authors first, then most-disliked.
    .sort((a, b) => b.blockedForCandidates - a.blockedForCandidates || b.dislikeCount - a.dislikeCount)

  return { items, authors }
}
