import 'server-only'
import { prisma } from '@/lib/prisma'
import type { NewsKind } from './kind'
import { cleanNewsTags, type NewsTagKey } from './tags'

/** What the public cards are given — nothing internal to Market Pulse. */
export interface NewsItemView {
  id: string
  kind: NewsKind
  url: string
  title: string | null
  blurb: string | null
  imageUrl: string | null
  source: string
  tags: NewsTagKey[]
  /** Formatted on the server, so the page and the browser can't disagree on the day. */
  dateLabel: string
  publishedAt: string
}

const dateLabel = (d: Date) =>
  d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/New_York' })

/**
 * Published News, newest first.
 *
 * Returns [] rather than throwing: this runs inside the homepage, and a
 * database hiccup should cost the page its News section, not the page.
 */
export async function getPublishedNews(limit: number): Promise<NewsItemView[]> {
  try {
    const rows = await prisma.researchLibraryItem.findMany({
      where: { newsPublishedAt: { not: null }, newsKind: { not: null } },
      orderBy: { newsPublishedAt: 'desc' },
      take: limit,
      select: {
        id: true, url: true, newsKind: true, newsTitle: true, newsBlurb: true,
        newsImageUrl: true, newsSource: true, newsPublishedAt: true, newsTags: true,
      },
    })
    return rows.map((r) => ({
      id: r.id,
      kind: r.newsKind as NewsKind,
      url: r.url,
      title: r.newsTitle,
      blurb: r.newsBlurb,
      imageUrl: r.newsImageUrl,
      source: r.newsSource ?? '',
      tags: cleanNewsTags(r.newsTags),
      dateLabel: dateLabel(r.newsPublishedAt!),
      publishedAt: r.newsPublishedAt!.toISOString(),
    }))
  } catch (e) {
    console.error('News could not be loaded', e)
    return []
  }
}
