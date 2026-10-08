// The NextChapter Displacement Report: the list of published editions.
//
// This is the one place a new edition is registered. Adding next month is a
// single entry at the top of REPORT_EDITIONS; the hub, the sitemap, the news
// feed and /reports/latest all read from here.

/** The production origin, spelled out so absolute URLs (JSON-LD, OG, feeds) agree. */
export const SITE_URL = 'https://launchyournextchapter.com'

export interface ReportEdition {
  /** URL slug under /reports — also the folder name of its page. */
  slug: string
  /** Human month label, e.g. "September 2026". */
  month: string
  /** Cover headline for the edition. */
  title: string
  /** One- to two-sentence summary for cards and listings. */
  dek: string
  /** ISO date (YYYY-MM-DD) the edition was published. */
  publishedAt: string
  /** ISO date of the latest revised version, when the edition has been updated since. */
  updatedAt?: string
  /** 1200×630 share image under /public. */
  ogImage: string
}

// Newest first is the job of helpers below; author order here is free.
export const REPORT_EDITIONS: ReportEdition[] = [
  {
    slug: 'displacement-report-september-2026',
    month: 'September 2026',
    title: 'Fewer layoffs, longer searches',
    dek: 'Hiring stalled and announced layoffs fell in September 2026, but long-term unemployment among managers and professionals rose about a third from a year earlier. The monthly read on white-collar job loss, AI, and the safety net.',
    publishedAt: '2026-10-05',
    updatedAt: '2026-10-06',
    ogImage: '/reports/displacement-report-2026-09-og.png',
  },
]

/** Editions newest-first by publish date. */
export function reportsNewestFirst(): ReportEdition[] {
  return [...REPORT_EDITIONS].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
}

/** The most recent edition, or null if none are registered yet. */
export function latestReport(): ReportEdition | null {
  return reportsNewestFirst()[0] ?? null
}

/** The canonical path for an edition, e.g. /reports/displacement-report-september-2026. */
export function reportPath(edition: ReportEdition): string {
  return `/reports/${edition.slug}`
}
