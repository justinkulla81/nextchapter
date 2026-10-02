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
  /** Our own paragraph, when there is one — and the page it lives on. */
  take: string | null
  slug: string | null
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
const SELECT = {
  id: true, url: true, newsKind: true, newsTitle: true, newsBlurb: true, newsImageUrl: true,
  newsSource: true, newsPublishedAt: true, newsTags: true, newsTake: true, newsSlug: true,
} as const

type Row = {
  id: string; url: string; newsKind: string | null; newsTitle: string | null; newsBlurb: string | null
  newsImageUrl: string | null; newsSource: string | null; newsPublishedAt: Date | null; newsTags: string[]
  newsTake: string | null; newsSlug: string | null
}

function toView(r: Row): NewsItemView {
  return {
    id: r.id,
    kind: r.newsKind as NewsKind,
    url: r.url,
    title: r.newsTitle,
    blurb: r.newsBlurb,
    imageUrl: r.newsImageUrl,
    source: r.newsSource ?? '',
    tags: cleanNewsTags(r.newsTags),
    // A page exists only where there is a take to put on it.
    take: r.newsTake,
    slug: r.newsTake && r.newsSlug ? r.newsSlug : null,
    dateLabel: dateLabel(r.newsPublishedAt!),
    publishedAt: r.newsPublishedAt!.toISOString(),
  }
}

export async function getPublishedNews(limit: number): Promise<NewsItemView[]> {
  try {
    const rows = await prisma.researchLibraryItem.findMany({
      where: { newsPublishedAt: { not: null }, newsKind: { not: null } },
      orderBy: { newsPublishedAt: 'desc' },
      take: limit,
      select: SELECT,
    })
    return rows.map(toView)
  } catch (e) {
    console.error('News could not be loaded', e)
    return []
  }
}

/** One published item by its page address, or null — also null when it has no take. */
export async function getNewsItemBySlug(slug: string): Promise<NewsItemView | null> {
  try {
    const r = await prisma.researchLibraryItem.findFirst({
      where: { newsSlug: slug, newsPublishedAt: { not: null }, newsKind: { not: null }, newsTake: { not: null } },
      select: SELECT,
    })
    return r ? toView(r) : null
  } catch (e) {
    console.error('News item could not be loaded', e)
    return null
  }
}
