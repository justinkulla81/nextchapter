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

export async function getCarouselVideos(): Promise<{ longForm: CuratedVideo[]; shorts: CuratedVideo[] }> {
  const videos = await prisma.curatedVideo.findMany({ where: { removedAt: null } })
  return {
    longForm: sortCuratedVideos(videos.filter((v) => v.format === 'LONG_FORM')),
    shorts: sortCuratedVideos(videos.filter((v) => v.format === 'SHORT')),
  }
}

export async function getCarouselPodcasts() {
  return prisma.podcast.findMany({ where: { removedAt: null }, orderBy: { publishedAt: 'desc' } })
}
