import 'server-only'
import { prisma } from '@/lib/prisma'
import type { CommunityFeedItem } from '@/lib/community/community-feed'

// The first candidate-facing in-app surface for MARKET_BRIEF research —
// previously this content only ever reached coaches/recruiters/employers via
// the Weekly Market Digest email (getDigestNugget, src/lib/admin/digest-composer.ts).
// Same queuedForDigest gate (an admin has reviewed and queued the item), just
// findMany instead of findFirst since the feed can show more than one.
export async function getMarketBriefFeedItems(limit = 5): Promise<CommunityFeedItem[]> {
  const items = await prisma.researchLibraryItem.findMany({
    where: { bucket: 'MARKET_BRIEF', queuedForDigest: true },
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
