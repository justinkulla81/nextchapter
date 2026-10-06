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
  /** When it went live here — the date of our take, for its byline and JSON-LD. */
  liveAt: string
}

const dateLabel = (d: Date) =>
  d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/New_York' })

/**
 * Published News, newest article first (by the publisher's date).
 *
 * Returns [] rather than throwing: this runs inside the homepage, and a
 * database hiccup should cost the page its News section, not the page.
 */
const SELECT = {
  id: true, url: true, newsKind: true, newsTitle: true, newsBlurb: true, newsImageUrl: true,
  newsSource: true, newsPublishedAt: true, newsArticleDate: true, newsTags: true, newsTake: true, newsSlug: true,
} as const

type Row = {
  id: string; url: string; newsKind: string | null; newsTitle: string | null; newsBlurb: string | null
  newsImageUrl: string | null; newsSource: string | null; newsPublishedAt: Date | null; newsArticleDate: Date | null; newsTags: string[]
  newsTake: string | null; newsSlug: string | null
}

/** The date News sorts and shows by: the article's own, else when it went live. */
const shownDate = (r: Pick<Row, 'newsArticleDate' | 'newsPublishedAt'>) => r.newsArticleDate ?? r.newsPublishedAt!

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
    dateLabel: dateLabel(shownDate(r)),
    publishedAt: shownDate(r).toISOString(),
    liveAt: r.newsPublishedAt!.toISOString(),
  }
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

/**
 * Pins a NextChapter report published in the last 30 days to the top, then
 * everything else newest-first. Done here on the server (not in the client
 * card component, where calling the clock during render is disallowed). Sort
 * is stable, so the non-report order is untouched.
 */
function pinRecentReports(items: NewsItemView[]): NewsItemView[] {
  const now = Date.now()
  const pinned = (i: NewsItemView) =>
    i.kind === 'report' && now - new Date(i.publishedAt).getTime() < THIRTY_DAYS_MS
  return [...items].sort((a, b) => (pinned(b) ? 1 : 0) - (pinned(a) ? 1 : 0))
}

export async function getPublishedNews(limit: number): Promise<NewsItemView[]> {
  try {
    // Newest article first, by the publisher's date, not by when it was
    // added here. The fallback to the go-live date can't be expressed as a
    // database sort, so every live item is read (a few hundred at most) and
    // sorted here.
    const rows = await prisma.researchLibraryItem.findMany({
      where: { newsPublishedAt: { not: null }, newsKind: { not: null } },
      take: 1000,
      select: SELECT,
    })
    return pinRecentReports(
      rows
        .sort((a, b) => shownDate(b).getTime() - shownDate(a).getTime())
        .slice(0, limit)
        .map(toView),
    )
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
