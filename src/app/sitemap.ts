import { FILING_GUIDE_UPDATED } from '@/lib/data/state-ui-appeals'
import { meetsCompanyLayoffBar, meetsStateBoardBar } from '@/lib/seo/page-bars'
import { CAREER_ROLES } from '@/lib/careers/roles'
import type { MetadataRoute } from 'next'
import { cachedIndexableOrgPages } from '@/lib/seo/org-pages'
import { GUIDE_LANDING_CONTENT } from '@/lib/constants/guide-landing-content'
import { PERSONAS } from '@/lib/constants/personas'
import { COMPETITOR_COMPARISONS } from '@/lib/marketing/competitor-comparisons'
import { getPublishedNews } from '@/lib/news/published'
import { REPORT_EDITIONS, latestReport } from '@/lib/reports'
import { AUTHORS } from '@/lib/seo/authors'
import { SITE_URL } from '@/lib/seo/facts'
import { INSIGHT_ARTICLES } from '@/lib/seo/insights'
import { ALL_STATE_CODES, stateSlug } from '@/lib/seo/states'
import { stateMeetsBar } from '@/lib/cobra-aca/states'
import { RULES_AS_OF as COBRA_ACA_UPDATED } from '@/lib/cobra-aca/rules'
import { STATE_NAMES } from '@/lib/workforce/places'
import { UI_LAST_VERIFIED } from '@/lib/data/state-ui'
import { getAnnouncements, hasRecentAnnouncement } from '@/lib/warn/company-announcements'
import { getCompanies, getStateSummaries } from '@/lib/warn/layoff-pages'
import { isNetworkCompany } from '@/lib/network/eligibility'
import { TOPICS } from '@/lib/seo/explainers'
import { INDUSTRIES, JOB_FUNCTIONS, associationSlug } from '@/lib/seo/topics'
import { WEEK_MIN_NOTICES, getWeeks } from '@/lib/layoffs/weekly'
import { MONTH_MIN_NOTICES, getMonths } from '@/lib/layoffs/monthly'
import { getCatalogIndex, getConferenceAssessments } from '@/lib/seo/topic-data'
import { assessAssociation } from '@/lib/seo/topic-quality'
import { topicsWithSnapshot } from '@/lib/seo/topic-snapshot'
import { boardSlugs } from '@/lib/seo/workforce-pages'
import { visibleBoards } from '@/lib/workforce/board-area'
import { NONPROFIT_ORG_PAGES_INDEXED, getStateNonprofitCounts, nonprofitsForSitemap } from '@/lib/seo/nonprofit-pages'
import { prisma } from '@/lib/prisma'
import { cachedSitemap } from '@/lib/seo/sitemap-cache'

// Rebuilt on a timer so a newly published take reaches the sitemap.
// Rendered per request, not at build: it reads the layoff, workforce, conference and nonprofit tables, which timed out the
// 2026-10-27 build. The CDN keeps it for an hour (next.config.ts headers).
export const dynamic = 'force-dynamic'

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
  { path: '/press', updated: '2026-10-27', freq: 'weekly', priority: 0.6 },
  { path: '/feeds', updated: '2026-10-27', freq: 'weekly', priority: 0.6 },
  { path: '/data', updated: '2026-10-27', freq: 'daily', priority: 0.7 },
  { path: '/data/embed', updated: '2026-10-27', freq: 'monthly', priority: 0.5 },
  { path: '/layoffs/2026', updated: '2026-10-30', freq: 'daily', priority: 0.8 },
  { path: '/layoffs/week', updated: '2026-10-27', freq: 'daily', priority: 0.6 },
  { path: '/layoffs/this-week', updated: '2026-10-27', freq: 'daily', priority: 0.7 },
  { path: '/jobs', updated: '2026-10-22', freq: 'daily', priority: 0.8 },
  { path: '/about', updated: '2026-10-06', freq: 'monthly', priority: 0.7 },
  { path: '/careers', updated: '2026-10-26', freq: 'weekly', priority: 0.7 },
  { path: '/how-it-works', updated: '2026-10-02', freq: 'monthly', priority: 0.6 },
  { path: '/why-stuck', updated: '2026-10-02', freq: 'monthly', priority: 0.6 },
  { path: '/glossary', updated: '2026-10-26', freq: 'monthly', priority: 0.6 },
  { path: '/tools', updated: '2026-10-26', freq: 'monthly', priority: 0.6 },
  { path: '/tools/severance-calculator', updated: '2026-10-27', freq: 'yearly', priority: 0.7 },
  { path: '/resources/severance-pay', updated: '2026-10-27', freq: 'monthly', priority: 0.7 },
  { path: '/tools/layoff-deadlines', updated: '2026-10-26', freq: 'yearly', priority: 0.7 },
  { path: '/tools/cobra-vs-aca-calculator', updated: '2026-10-26', freq: 'monthly', priority: 0.7 },
  { path: '/tools/salary-converter', updated: '2026-10-27', freq: 'yearly', priority: 0.7 },
  { path: '/tools/layoff-runway', updated: '2026-10-27', freq: 'yearly', priority: 0.7 },
  { path: '/tools/layoff-risk-check', updated: '2026-10-27', freq: 'monthly', priority: 0.7 },
  { path: '/resources/warn-act', updated: '2026-10-27', freq: 'monthly', priority: 0.7 },
  { path: '/layoffs/by-state', updated: '2026-10-27', freq: 'daily', priority: 0.6 },
  { path: '/tools/unemployment-estimator', updated: '2026-10-27', freq: 'yearly', priority: 0.7 },
  { path: '/tools/pay-check', updated: '2026-10-26', freq: 'yearly', priority: 0.7 },
  { path: '/tools/resume-check', updated: '2026-10-26', freq: 'yearly', priority: 0.7 },
  { path: '/funding', updated: '2026-10-23', freq: 'monthly', priority: 0.8 },
  { path: '/pricing', updated: '2026-10-24', freq: 'monthly', priority: 0.6 },
  { path: '/ai-skills', updated: '2026-10-20', freq: 'weekly', priority: 0.7 },
  { path: '/resources/ai-skills-pay-premium', updated: '2026-10-27', freq: 'weekly', priority: 0.7 },
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

// Two queries for every state (all boards, and which states have colleges), not one pair per state: this loader
// ran fifty-odd concurrent reads beside the topic and nonprofit loaders and, failing quietly, dropped every
// workforce, rapid-response and higher-education page from the sitemap.
async function loadSeoStatePages(entry: (path: string, updated: string, freq: Freq, priority: number) => MetadataRoute.Sitemap[number]) {
  try {
    const [rows, collegeStates, centerStates] = await Promise.all([
      prisma.workforceBoard.findMany({ select: { id: true, state: true, name: true, statewide: true }, orderBy: { name: 'asc' } }),
      prisma.localCollege.groupBy({ by: ['state'], where: { sector: { in: [1, 2, 4, 5] } }, _count: { _all: true } }),
      prisma.americanJobCenter.groupBy({ by: ['state'], _count: { _all: true } }),
    ])
    const centersIn = new Map(centerStates.map((c) => [c.state, c._count._all]))
    // A board page below the content bar (src/lib/seo/org-page-rules.ts) is noindex, so it stays out of the sitemap.
    const indexableBoards = new Set((await cachedIndexableOrgPages('WORKFORCE_BOARD').catch(() => null))?.map((p) => p.path))
    const hasColleges = new Set(collegeStates.map((c) => c.state))
    const byState = new Map<string, typeof rows>()
    for (const r of rows) byState.set(r.state, [...(byState.get(r.state) ?? []), r])
    return [...byState.entries()]
      .filter(([state]) => state in STATE_NAMES)
      .map(([state, all]) => {
        const slug = stateSlug(state)
        const boards = visibleBoards(all)
        const slugs = boardSlugs(boards)
        return [
          ...(meetsStateBoardBar(boards.length, centersIn.get(state) ?? 0)
            ? [entry(`/workforce-boards/${slug}`, DIRECTORY_UPDATED, 'monthly', 0.5), entry(`/rapid-response/${slug}`, DIRECTORY_UPDATED, 'monthly', 0.5)]
            : []),
          ...(hasColleges.has(state) ? [entry(`/higher-education/${slug}`, DIRECTORY_UPDATED, 'monthly', 0.5)] : []),
          ...boards.filter((b) => indexableBoards.size === 0 || indexableBoards.has(`/workforce-boards/${slug}/${slugs.get(b.id)}`)).map((b) => entry(`/workforce-boards/${slug}/${slugs.get(b.id)}`, DIRECTORY_UPDATED, 'monthly', 0.4)),
        ]
      })
  } catch (e) {
    console.error('sitemap: workforce state pages left out', e)
    return []
  }
}

// Nonprofit pages (IRS records, $1 million or more in revenue) and economic development pages by state.
async function loadNonprofitPages(entry: (path: string, updated: string, freq: Freq, priority: number) => MetadataRoute.Sitemap[number]) {
  try {
    const [counts, orgs, edo] = await Promise.all([
      getStateNonprofitCounts(),
      NONPROFIT_ORG_PAGES_INDEXED ? nonprofitsForSitemap() : Promise.resolve([]),
      prisma.localPartnerOrg.groupBy({ by: ['state'], where: { OR: [{ confidence: null }, { confidence: { not: 'low' } }] }, _count: { _all: true } }),
    ])
    return [
      ...counts.filter((c) => c.state in STATE_NAMES).map((c) => entry(`/nonprofits/${stateSlug(c.state)}`, DIRECTORY_UPDATED, 'monthly', 0.5)),
      ...orgs.filter((o) => o.state in STATE_NAMES).map((o) => entry(`/nonprofits/${stateSlug(o.state)}/${o.slug}`, DIRECTORY_UPDATED, 'monthly', 0.4)),
      ...edo.filter((e) => e.state in STATE_NAMES).map((e) => entry(`/economic-development/${stateSlug(e.state)}`, DIRECTORY_UPDATED, 'monthly', 0.5)),
    ]
  } catch (e) {
    console.error('sitemap: nonprofit and economic development pages left out', e)
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
  // pages are listed once the topic-snapshots cron has stored their job figures; their on-page gate still applies.
  try {
    const [catalog, assessments, snapshots] = await Promise.all([getCatalogIndex(), getConferenceAssessments(), topicsWithSnapshot()])
    const newest = new Map<string, string>()
    const byOrg = new Map<string, typeof catalog>()
    for (const c of catalog) if (c.organizer) {
      const slug = associationSlug(c.organizer)
      if (c.updatedAt > (newest.get(slug) ?? '')) newest.set(slug, c.updatedAt)
      byOrg.set(slug, [...(byOrg.get(slug) ?? []), c])
    }
    const assocEntries = [...byOrg]
      .filter(([, rows]) => assessAssociation(rows).indexable)
      .map(([slug]) => entry(`/associations/${slug}`, newest.get(slug) ?? TOPICS_UPDATED, 'weekly', 0.5))
    return [
      ...hubs,
      ...INDUSTRIES.filter((i) => i.rule && snapshots.has(JSON.stringify({ rule: i.rule }))).map((i) => entry(`/industries/${i.slug}`, TOPICS_UPDATED, 'daily', 0.7)),
      ...JOB_FUNCTIONS.filter((f) => snapshots.has(JSON.stringify({ fn: f.name }))).map((f) => entry(`/functions/${f.slug}`, TOPICS_UPDATED, 'daily', 0.7)),
      ...catalog.filter((c) => assessments.get(c.id)?.indexable).map((c) => entry(`/conferences/${c.id}`, c.updatedAt, 'weekly', c.importance === 1 ? 0.6 : 0.5)),
      ...assocEntries,
    ]
  } catch (error) {
    console.error('topic pages left out of the sitemap:', error instanceof Error ? error.message : error)
    return hubs
  }
}

const latestOf = (dates: string[]) => dates.reduce((a, b) => (b > a ? b : a), dates[0])

async function buildSitemap(): Promise<MetadataRoute.Sitemap> {
  // News items that have their own page — the ones with our take.
  const [news, layoffStates, companies, announcements, weeks, months] = await Promise.all([
    getPublishedNews(500),
    getStateSummaries().catch(() => []),
    getCompanies().catch(() => new Map()),
    getAnnouncements().catch(() => new Map()),
    getWeeks().catch(() => []),
    getMonths().catch(() => []),
  ])
  // Employers with a recent announcement are listed even without a WARN filing (their page exists and is indexable).
  const announced = [...announcements.values()].filter((a) => hasRecentAnnouncement(a))
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
    ...CAREER_ROLES.map((r) => entry(`/careers/${r.slug}`, '2026-10-26', 'weekly', r.kind === 'platform' ? 0.4 : 0.6)),

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
    // One page per complete week with at least three notices (fewer is noindex on the page).
    // One page per month of the year with at least ten notices; the current month changes daily.
    ...months.filter((m) => m.count >= MONTH_MIN_NOTICES).map((m) => entry(`/layoffs/2026/${m.slug}`, newestNotice ?? new Date().toISOString(), 'daily', 0.5)),
    ...weeks.filter((w) => w.count >= WEEK_MIN_NOTICES).map((w) => entry(`/layoffs/week/${w.id}`, new Date(w.monday.getTime() + 8 * 86_400_000).toISOString(), 'monthly', 0.4)),
    ...[...companies.values()]
      .filter((c) => meetsCompanyLayoffBar(c) && !announced.some((a) => a.slug === c.slug))
      .map((c) => entry(`/layoffs/company/${c.slug}`, c.latest.toISOString(), 'weekly', 0.4)),
    ...announced.map((a) => {
      const c = companies.get(a.slug)
      const newest = c && c.latest > a.latest ? c.latest : a.latest
      return entry(`/layoffs/company/${a.slug}`, newest.toISOString(), 'daily', 0.6)
    }),

    // Employer network pages: the same employers, kept only where the page qualifies (recent notice, enough workers).
    ...[...companies.values()]
      .filter((c) => isNetworkCompany(c))
      .map((c) => entry(`/network/company/${c.slug}`, c.latest.toISOString(), 'weekly', 0.5)),

    // Unemployment benefits: dated by the last verification against sources.
    entry('/unemployment-benefits', UI_LAST_VERIFIED, 'monthly', 0.7),
    ...ALL_STATE_CODES.map((c) => entry(`/unemployment-benefits/${stateSlug(c)}`, FILING_GUIDE_UPDATED, 'monthly', 0.6)),
    // COBRA vs ACA: the explainer lives at /resources/cobra-aca (a static page). State pages that meet their bar (src/lib/cobra-aca/states.ts).
    ...ALL_STATE_CODES.filter(stateMeetsBar).map((c) => entry(`/resources/cobra-aca/${stateSlug(c)}`, COBRA_ACA_UPDATED, 'monthly', 0.5)),

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

// The finished list is kept in the data cache (six hours, a stale copy served while it refreshes), like the other database-backed
// sitemaps. Without this every request to /sitemap.xml rebuilt it from the database (about 2 seconds, MISS on every call): the
// CDN header in next.config.ts is not applied to a dynamic route on Vercel.
const cachedMainSitemap = cachedSitemap('main-sitemap-v1', buildSitemap)

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return cachedMainSitemap()
}
