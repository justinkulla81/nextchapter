// The NextChapter White Collar Employment Report (published as the NextChapter Displacement Report through October 12, 2026): the list of published editions.
//
// This is the one place a new edition is registered. Adding next month is a
// single entry at the top of REPORT_EDITIONS; the hub, the sitemap, the news
// feed and /reports/latest all read from here.

/** The report's name from the October 2026 edition on. */
export const REPORT_NAME = 'NextChapter White Collar Employment Report'

/**
 * The name the report was published under through October 12, 2026 (renamed October 13, 2026; measures unchanged). Keep it for
 * citing those editions by their published title; new editions and new copy use
 * REPORT_NAME.
 */
export const REPORT_LEGACY_NAME = 'NextChapter Displacement Report'

/** URL-slug prefix for editions published under the current name. */
export const REPORT_SLUG_PREFIX = 'white-collar-employment-report-'

const MONTH_SLUGS = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
]

/**
 * The slug for a new edition, e.g. reportSlugFor(2026, 10) is
 * 'white-collar-employment-report-october-2026'. Month is 1 to 12.
 */
export function reportSlugFor(year: number, month: number): string {
  if (!Number.isInteger(year) || year < 2000 || year > 2100) throw new Error(`Invalid report year: ${year}`)
  if (!Number.isInteger(month) || month < 1 || month > 12) throw new Error(`Invalid report month: ${month}`)
  return `${REPORT_SLUG_PREFIX}${MONTH_SLUGS[month - 1]}-${year}`
}

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
    title: 'Jobs are growing, and some searches are taking longer',
    dek: 'The economy added 612,000 jobs in the first nine months of 2026 and there is about one opening per unemployed person, while long searches among managers and professionals were about a third more common than a year earlier. The monthly read on how people are working, being hired and changing jobs, with what public programs and technology are adding.',
    publishedAt: '2026-10-05',
    updatedAt: '2026-10-13',
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
