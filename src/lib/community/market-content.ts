import 'server-only'
import { prisma } from '@/lib/prisma'
import type { CommunityFeedItem } from '@/lib/community/community-feed'

// The first candidate-facing in-app surface for MARKET_BRIEF research —
// previously this content only ever reached coaches/recruiters/employers via
// the Weekly Market Digest email (getDigestNuggets, src/lib/admin/digest-composer.ts).
// Same "an admin has queued this item" gate, scoped specifically to items
// queued for the CANDIDATE audience (per-article audience targeting — an
// item queued only for coaches/recruiters/employers has no business showing
// up in a candidate-facing feed), just findMany instead of findFirst since
// the feed can show more than one.
export async function getMarketBriefFeedItems(limit = 5): Promise<CommunityFeedItem[]> {
  const items = await prisma.researchLibraryItem.findMany({
    where: { bucket: 'MARKET_BRIEF', digestAudiences: { has: 'CANDIDATE' } },
    orderBy: { dateFound: 'desc' },
    take: limit,
    select: { id: true, title: true, url: true, summary: true, dateFound: true },
  })

  return items.map((item) => ({
    id: `market-brief-${item.id}`,
    type: 'marketBrief',
    displayName: null,
    avatarUrl: null,
    detail: item.summary ?? item.title ?? 'A market update worth a read.',
    occurredAt: item.dateFound,
    url: item.url,
  }))
}
