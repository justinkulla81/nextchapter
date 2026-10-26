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
import { STATE_NAMES } from '@/lib/workforce/places'
import { UI_LAST_VERIFIED } from '@/lib/data/state-ui'
import { TWENTY_FOUR_MONTHS_MS, getCompanies, getStateSummaries } from '@/lib/warn/layoff-pages'
import { isNetworkCompany } from '@/lib/network/eligibility'
import { TOPICS } from '@/lib/seo/explainers'
import { ASSOCIATION_MIN_CONFERENCES, INDUSTRIES, JOB_FUNCTIONS, associationSlug } from '@/lib/seo/topics'
import { getCatalogIndex, getConferenceAssessments } from '@/lib/seo/topic-data'
import { assessAssociation } from '@/lib/seo/topic-quality'
import { getStateBoards, getStateColleges, getStatesWithBoards } from '@/lib/seo/workforce-pages'
import { getStateNonprofitCounts, nonprofitsForSitemap } from '@/lib/seo/nonprofit-pages'
import { prisma } from '@/lib/prisma'

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
 * redirects (/for-coaches, /coach-platform) or anything robots.ts disallows.
 */
const STATIC_PAGES: { path: string; updated: string; freq: Freq; priority: number }[] = [
  { path: '/jobs', updated: '2026-10-22', freq: 'daily', priority: 0.8 },
  { path: '/about', updated: '2026-10-06', freq: 'monthly', priority: 0.7 },
  { path: '/how-it-works', updated: '2026-10-02', freq: 'monthly', priority: 0.6 },
  { path: '/why-stuck', updated: '2026-10-02', freq: 'monthly', priority: 0.6 },
  { path: '/glossary', updated: '2026-10-26', freq: 'monthly', priority: 0.6 },
  { path: '/tools', updated: '2026-10-26', freq: 'monthly', priority: 0.6 },
  { path: '/tools/severance-calculator', updated: '2026-10-26', freq: 'yearly', priority: 0.7 },
  { path: '/funding', updated: '2026-10-23', freq: 'monthly', priority: 0.8 },
  { path: '/pricing', updated: '2026-10-24', freq: 'monthly', priority: 0.6 },
  { path: '/ai-skills', updated: '2026-10-20', freq: 'weekly', priority: 0.7 },
  { path: '/ai-training', updated: '2026-10-20', freq: 'monthly', priority: 0.6 },
  { path: '/dossier', updated: '2026-10-02', freq: 'monthly', priority: 0.6 },
  { path: '/faq', updated: '2026-10-02', freq: 'monthly', priority: 0.5 },
  { path: '/contact', updated: '2026-09-29', freq: 'yearly', priority: 0.5 },
  { path: '/submit-resume', updated: '2026-10-02', freq: 'monthly', priority: 0.4 },
  { path: '/submit-search', updated: '2026-10-09', freq: 'monthly', priority: 0.4 },
  { path: '/refer', updated: '2026-10-02', freq: 'monthly', priority: 0.3 },
  { path: '/for-organizations', updated: '2026-10-24', freq: 'monthly', priority: 0.5 },
  { path: '/higher-education', updated: '2026-10-24', freq: 'monthly', priority: 0.6 },
  { path: '/employers', updated: '2026-10-24', freq: 'monthly', priority: 0.7 },
  { path: '/employees', updated: '2026-10-24', freq: 'monthly', priority: 0.6 },
  { path: '/outplacement', updated: '2026-10-24', freq: 'monthly', priority: 0.5 },
  { path: '/recruiters', updated: '2026-10-24', freq: 'monthly', priority: 0.5 },
  { path: '/talent', updated: '2026-10-24', freq: 'monthly', priority: 0.5 },
  { path: '/government-workforce', updated: '2026-10-24', freq: 'monthly', priority: 0.5 },
  { path: '/nonprofits', updated: '2026-10-24', freq: 'monthly', priority: 0.5 },
  { path: '/coaching', updated: '2026-08-07', freq: 'monthly', priority: 0.5 },
  { path: '/coaches', updated: '2026-10-24', freq: 'monthly', priority: 0.5 },
  { path: '/membership', updated: '2026-08-22', freq: 'monthly', priority: 0.5 },
  { path: '/rfp-template', updated: '2026-08-25', freq: 'yearly', priority: 0.4 },
  { path: '/for-managers/give-a-reference', updated: '2026-08-12', freq: 'yearly', priority: 0.3 },
  { path: '/scam-watch', updated: '2026-10-14', freq: 'monthly', priority: 0.5 },
  { path: '/security', updated: '2026-10-14', freq: 'monthly', priority: 0.4 },
  { path: '/editorial-standards', updated: '2026-10-06', freq: 'yearly', priority: 0.3 },
  { path: '/privacy-policy', updated: '2026-10-14', freq: 'yearly', priority: 0.2 },
  { path: '/terms', updated: '2026-10-07', freq: 'yearly', priority: 0.2 },
]

// /start/[persona] content lives in personas.ts; /vs/[competitor] in competitor-comparisons.ts.
const PERSONAS_UPDATED = '2026-10-02'
const COMPARISONS_UPDATED = '2026-08-25'

const EXPLAINERS_UPDATED = '2026-10-25'

// /reports/replication mirrors the replication repository's README.
const REPLICATION_UPDATED = '2026-10-07'

// The board and college directories are refreshed from CareerOneStop and IPEDS about monthly.
const DIRECTORY_UPDATED = '2026-10-25'

async function loadSeoStatePages(entry: (path: string, updated: string, freq: Freq, priority: number) => MetadataRoute.Sitemap[number]) {
  try {
    const states = await getStatesWithBoards()
    return await Promise.all(
      states.map(async (s) => {
        const slug = stateSlug(s.state)
        const [boards, colleges] = await Promise.all([getStateBoards(s.state), getStateColleges(s.state)])
        return [
          entry(`/workforce-boards/${slug}`, DIRECTORY_UPDATED, 'monthly', 0.5),
          entry(`/rapid-response/${slug}`, DIRECTORY_UPDATED, 'monthly', 0.5),
          ...(colleges.length ? [entry(`/higher-education/${slug}`, DIRECTORY_UPDATED, 'monthly', 0.5)] : []),
          ...boards.map((b) => entry(`/workforce-boards/${slug}/${b.slug}`, DIRECTORY_UPDATED, 'monthly', 0.4)),
        ]
      }),
    )
  } catch {
    return []
  }
}

// Nonprofit pages (IRS records, $1 million or more in revenue) and economic development pages by state.
async function loadNonprofitPages(entry: (path: string, updated: string, freq: Freq, priority: number) => MetadataRoute.Sitemap[number]) {
  try {
    const [counts, orgs, edo] = await Promise.all([
      getStateNonprofitCounts(),
      nonprofitsForSitemap(),
      prisma.localPartnerOrg.groupBy({ by: ['state'], where: { OR: [{ confidence: null }, { confidence: { not: 'low' } }] }, _count: { _all: true } }),
    ])
    return [
      ...counts.filter((c) => c.state in STATE_NAMES).map((c) => entry(`/nonprofits/${stateSlug(c.state)}`, DIRECTORY_UPDATED, 'monthly', 0.5)),
      ...orgs.filter((o) => o.state in STATE_NAMES).map((o) => entry(`/nonprofits/${stateSlug(o.state)}/${o.slug}`, DIRECTORY_UPDATED, 'monthly', 0.4)),
      ...edo.filter((e) => e.state in STATE_NAMES).map((e) => entry(`/economic-development/${stateSlug(e.state)}`, DIRECTORY_UPDATED, 'monthly', 0.5)),
    ]
  } catch {
    return []
  }
}

// Industry, function, conference and association pages. A database failure leaves the conference and association
// rows out rather than failing the sitemap; the industry and function pages are fixed lists.
const TOPICS_UPDATED = '2026-10-25'
async function loadTopicPages(entry: (path: string, updated: string, freq: Freq, priority: number) => MetadataRoute.Sitemap[number]) {
  const hubs = [
    entry('/industries', TOPICS_UPDATED, 'weekly', 0.7),
    entry('/functions', TOPICS_UPDATED, 'weekly', 0.7),
    entry('/top-employers', TOPICS_UPDATED, 'daily', 0.8),
    ...JOB_FUNCTIONS.map((f) => entry(`/top-employers/${f.slug}`, TOPICS_UPDATED, 'daily', 0.6)),
    entry('/conferences', TOPICS_UPDATED, 'daily', 0.7),
    entry('/associations', TOPICS_UPDATED, 'weekly', 0.6),
  ]
  // A page below its quality bar renders for visitors but is noindex, so it stays out of the sitemap too
  // (src/lib/seo/topic-quality.ts). It returns by itself once its data passes the bar. Conferences and associations are
  // judged from the catalog rows, so the sitemap and the page agree without rendering every page. Industry and function
  // pages are built from thousands of live jobs and pass by construction; their on-page gate still applies.
  try {
    const [catalog, assessments] = await Promise.all([getCatalogIndex(), getConferenceAssessments()])
    const newest = new Map<string, string>()
    const byOrg = new Map<string, typeof catalog>()
    for (const c of catalog) if (c.organizer) {
      const slug = associationSlug(c.organizer)
      if (c.updatedAt > (newest.get(slug) ?? '')) newest.set(slug, c.updatedAt)
      byOrg.set(slug, [...(byOrg.get(slug) ?? []), c])
    }
    const assocEntries = [...byOrg]
      .filter(([, rows]) => rows.length >= ASSOCIATION_MIN_CONFERENCES && assessAssociation(rows).indexable)
      .map(([slug]) => entry(`/associations/${slug}`, newest.get(slug) ?? TOPICS_UPDATED, 'weekly', 0.5))
    return [
      ...hubs,
      ...INDUSTRIES.filter((i) => i.rule).map((i) => entry(`/industries/${i.slug}`, TOPICS_UPDATED, 'daily', 0.7)),
      ...JOB_FUNCTIONS.map((f) => entry(`/functions/${f.slug}`, TOPICS_UPDATED, 'daily', 0.7)),
      ...catalog.filter((c) => assessments.get(c.id)?.indexable).map((c) => entry(`/conferences/${c.id}`, c.updatedAt, 'weekly', c.importance === 1 ? 0.6 : 0.5)),
      ...assocEntries,
    ]
  } catch (error) {
    console.error('topic pages left out of the sitemap:', error instanceof Error ? error.message : error)
    return hubs
  }
}

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

  const [stateAndWorkforcePages, topicPages, nonprofitPages] = await Promise.all([loadSeoStatePages(entry), loadTopicPages(entry), loadNonprofitPages(entry)])
  const seoStatePages = [...stateAndWorkforcePages, nonprofitPages]

  return [
    // The homepage shows the latest News, so it changes when News does.
    entry('/', latestOf(['2026-10-06', ...(newestNews ? [newestNews] : [])]), 'weekly', 1),
    ...STATIC_PAGES.map((p) => entry(p.path, p.updated, p.freq, p.priority)),

    // The White Collar Employment Report: hub, the evergreen index, and every edition.
    // The index is refreshed with each edition.
    ...(newestReport
      ? [entry('/reports', newestReport, 'monthly', 0.7), entry('/reports/white-collar-index', newestReport, 'monthly', 0.7), entry('/reports/early-warning', newestReport, 'monthly', 0.7)]
      : []),
    ...REPORT_EDITIONS.map((e) => entry(`/reports/${e.slug}`, e.updatedAt ?? e.publishedAt, 'monthly', 0.7)),
    entry('/reports/replication', REPLICATION_UPDATED, 'monthly', 0.5),

    // Topic explainers: severance, resumes, job search strategy, career pivot, career exploration, recruiters.
    entry('/topics', EXPLAINERS_UPDATED, 'monthly', 0.6),
    ...TOPICS.map((t) => entry(`/topics/${t.slug}`, t.updated, 'monthly', 0.7)),

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

    // Employer network pages: the same employers, kept only where the page qualifies (recent notice, enough workers).
    ...[...companies.values()]
      .filter((c) => isNetworkCompany(c))
      .map((c) => entry(`/network/company/${c.slug}`, c.latest.toISOString(), 'weekly', 0.5)),

    // Unemployment benefits: dated by the last verification against sources.
    entry('/unemployment-benefits', UI_LAST_VERIFIED, 'monthly', 0.7),
    ...ALL_STATE_CODES.map((c) => entry(`/unemployment-benefits/${stateSlug(c)}`, UI_LAST_VERIFIED, 'monthly', 0.6)),

    // Workforce boards, rapid response and higher education by state, and the WARN checker. Dated by the
    // directory refresh, which is monthly; a database failure leaves these out rather than failing the sitemap.
    entry('/workforce-boards', DIRECTORY_UPDATED, 'monthly', 0.6),
    entry('/rapid-response', DIRECTORY_UPDATED, 'monthly', 0.6),
    entry('/tools/warn-act-checker', DIRECTORY_UPDATED, 'yearly', 0.6),
    entry('/economic-development', DIRECTORY_UPDATED, 'monthly', 0.6),
    ...seoStatePages.flatMap((p) => p),

    // Industry, function, conference and association pages.
    ...topicPages,

    // Author pages.
    ...Object.keys(AUTHORS).map((slug) => entry(`/authors/${slug}`, latestOf([newestGuide, newestInsight, ...(newestReport ? [newestReport] : [])]), 'monthly', 0.4)),
  ]
}
