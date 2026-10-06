import type { MetadataRoute } from 'next'
import { GUIDE_LANDING_CONTENT } from '@/lib/constants/guide-landing-content'
import { PERSONAS } from '@/lib/constants/personas'
import { COMPETITOR_COMPARISONS } from '@/lib/marketing/competitor-comparisons'
import { getPublishedNews } from '@/lib/news/published'
import { REPORT_EDITIONS, latestReport } from '@/lib/reports'
import { AUTHORS } from '@/lib/seo/authors'
import { SITE_URL } from '@/lib/seo/facts'
import { INSIGHT_ARTICLES } from '@/lib/seo/insights'
import { ALL_STATE_CODES, stateSlug } from '@/lib/seo/states'
import { UI_LAST_VERIFIED } from '@/lib/data/state-ui'
import { TWENTY_FOUR_MONTHS_MS, getCompanies, getStateSummaries } from '@/lib/warn/layoff-pages'

// Rebuilt on a timer so a newly published take reaches the sitemap.
export const revalidate = 3600

type Freq = NonNullable<MetadataRoute.Sitemap[number]['changeFrequency']>

/**
 * Pages whose content has no date of its own. `updated` is the day the page's
 * content last changed — bump it when you edit the page. It is a fixed date on
 * purpose: stamping every page with the build time tells search engines
 * everything changed on every deploy, so they learn to ignore the field.
 *
 * Only public, indexable pages belong here. Never list sign-in pages,
 * redirects (/employers, /for-coaches) or anything robots.ts disallows.
 */
const STATIC_PAGES: { path: string; updated: string; freq: Freq; priority: number }[] = [
  { path: '/about', updated: '2026-10-06', freq: 'monthly', priority: 0.7 },
  { path: '/how-it-works', updated: '2026-10-02', freq: 'monthly', priority: 0.6 },
  { path: '/why-stuck', updated: '2026-10-02', freq: 'monthly', priority: 0.6 },
  { path: '/pricing', updated: '2026-10-02', freq: 'monthly', priority: 0.6 },
  { path: '/dossier', updated: '2026-10-02', freq: 'monthly', priority: 0.6 },
  { path: '/faq', updated: '2026-10-02', freq: 'monthly', priority: 0.5 },
  { path: '/contact', updated: '2026-09-29', freq: 'yearly', priority: 0.5 },
  { path: '/submit-resume', updated: '2026-10-02', freq: 'monthly', priority: 0.4 },
  { path: '/refer', updated: '2026-10-02', freq: 'monthly', priority: 0.3 },
  { path: '/for-organizations', updated: '2026-10-06', freq: 'monthly', priority: 0.5 },
  { path: '/outplacement', updated: '2026-10-06', freq: 'monthly', priority: 0.5 },
  { path: '/recruiters', updated: '2026-08-15', freq: 'monthly', priority: 0.5 },
  { path: '/talent', updated: '2026-08-26', freq: 'monthly', priority: 0.5 },
  { path: '/government-workforce', updated: '2026-07-14', freq: 'monthly', priority: 0.5 },
  { path: '/nonprofits', updated: '2026-07-14', freq: 'monthly', priority: 0.5 },
  { path: '/coaching', updated: '2026-08-07', freq: 'monthly', priority: 0.5 },
  { path: '/coaches', updated: '2026-08-15', freq: 'monthly', priority: 0.5 },
  { path: '/coach-platform', updated: '2026-08-15', freq: 'monthly', priority: 0.4 },
  { path: '/membership', updated: '2026-08-22', freq: 'monthly', priority: 0.5 },
  { path: '/rfp-template', updated: '2026-08-25', freq: 'yearly', priority: 0.4 },
  { path: '/for-managers/give-a-reference', updated: '2026-08-12', freq: 'yearly', priority: 0.3 },
  { path: '/security', updated: '2026-10-02', freq: 'monthly', priority: 0.4 },
  { path: '/editorial-standards', updated: '2026-10-06', freq: 'yearly', priority: 0.3 },
  { path: '/privacy-policy', updated: '2026-10-02', freq: 'yearly', priority: 0.2 },
]

// /start/[persona] content lives in personas.ts; /vs/[competitor] in competitor-comparisons.ts.
const PERSONAS_UPDATED = '2026-10-02'
const COMPARISONS_UPDATED = '2026-08-25'

const latestOf = (dates: string[]) => dates.reduce((a, b) => (b > a ? b : a), dates[0])

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // News items that have their own page — the ones with our take.
  const [news, layoffStates, companies] = await Promise.all([
    getPublishedNews(500),
    getStateSummaries().catch(() => []),
    getCompanies().catch(() => new Map()),
  ])
  const newestNotice = layoffStates.length ? latestOf(layoffStates.map((s) => s.latest.toISOString())) : null
  const newsPages = news.filter((i) => i.slug)
  const newestNews = news.length ? latestOf(news.map((i) => i.liveAt)) : null
  const newestReport = latestReport()?.publishedAt ?? null
  const newestGuide = latestOf(GUIDE_LANDING_CONTENT.map((g) => g.lastUpdated))
  const newestInsight = latestOf(INSIGHT_ARTICLES.map((a) => a.lastUpdated))

  const entry = (path: string, updated: string, freq: Freq, priority: number) => ({
    url: path === '/' ? SITE_URL : `${SITE_URL}${path}`,
    lastModified: new Date(updated),
    changeFrequency: freq,
    priority,
  })

  return [
    // The homepage shows the latest News, so it changes when News does.
    entry('/', latestOf(['2026-10-06', ...(newestNews ? [newestNews] : [])]), 'weekly', 1),
    ...STATIC_PAGES.map((p) => entry(p.path, p.updated, p.freq, p.priority)),

    // The Displacement Report: hub, the evergreen index, and every edition.
    // The index is refreshed with each edition.
    ...(newestReport
      ? [entry('/reports', newestReport, 'monthly', 0.7), entry('/reports/white-collar-index', newestReport, 'monthly', 0.7)]
      : []),
    ...REPORT_EDITIONS.map((e) => entry(`/reports/${e.slug}`, e.publishedAt, 'monthly', 0.7)),

    // Guides.
    entry('/resources', newestGuide, 'monthly', 0.5),
    ...GUIDE_LANDING_CONTENT.map((g) => entry(`/resources/${g.slug}`, g.lastUpdated, 'yearly', 0.6)),

    // Insights for employers.
    entry('/insights', newestInsight, 'monthly', 0.5),
    ...INSIGHT_ARTICLES.map((a) => entry(`/insights/${a.slug}`, a.lastUpdated, 'yearly', 0.5)),

    // Outplacement comparisons.
    entry('/vs', COMPARISONS_UPDATED, 'monthly', 0.5),
    ...COMPETITOR_COMPARISONS.map((c) => entry(`/vs/${c.slug}`, COMPARISONS_UPDATED, 'monthly', 0.5)),

    // Situational starting points.
    ...PERSONAS.map((p) => entry(`/start/${p.slug}`, PERSONAS_UPDATED, 'monthly', 0.6)),

    // News: the hub and every item with our take.
    ...(newestNews ? [entry('/news', newestNews, 'daily', 0.6)] : []),
    ...newsPages.map((i) => entry(`/news/${i.slug}`, i.liveAt, 'monthly', 0.5)),

    // The layoff tracker: hub, states with a notice in the last 12 months, and
    // every employer whose newest notice is under two years old (older ones
    // are noindex). Each dated by its newest notice.
    ...(newestNotice ? [entry('/layoffs', newestNotice, 'daily', 0.7)] : []),
    ...layoffStates.map((s) => entry(`/layoffs/${stateSlug(s.state)}`, s.latest.toISOString(), 'daily', 0.6)),
    ...[...companies.values()]
      .filter((c) => Date.now() - c.latest.getTime() <= TWENTY_FOUR_MONTHS_MS)
      .map((c) => entry(`/layoffs/company/${c.slug}`, c.latest.toISOString(), 'weekly', 0.4)),

    // Unemployment benefits: dated by the last verification against sources.
    entry('/unemployment-benefits', UI_LAST_VERIFIED, 'monthly', 0.7),
    ...ALL_STATE_CODES.map((c) => entry(`/unemployment-benefits/${stateSlug(c)}`, UI_LAST_VERIFIED, 'monthly', 0.6)),

    // Author pages.
    ...Object.keys(AUTHORS).map((slug) => entry(`/authors/${slug}`, latestOf([newestGuide, newestInsight, ...(newestReport ? [newestReport] : [])]), 'monthly', 0.4)),
  ]
}
