import 'server-only'
import { cache } from 'react'
import { heavy } from '@/lib/db/heavy'
import { unstable_cache } from 'next/cache'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { PUBLIC_JOB_SELECT } from '@/lib/jobs/public-job-page-server'
import { getConfirmedGhostIds } from '@/lib/jobs/job-dismiss-server'
import { isPublicJob } from '@/lib/jobs/public-job-page'
import { cleanEmployer } from '@/lib/warn/public-tracker'
import { employerSlug as layoffEmployerSlug, TWELVE_MONTHS_MS } from '@/lib/warn/layoff-pages'
import { employerSlug } from '@/lib/seo/employer-slug'
import { EMPLOYER_MIN_OPEN_ROLES } from '@/lib/seo/employer-pages'
import { hasUpcomingDates } from '@/lib/events/format'
import { employersForConference } from '@/lib/events/conference-employers'
import { effectiveFunctions, inferFunctions } from '@/lib/seo/function-inference'
import { assessConference, type Assessment } from '@/lib/seo/topic-quality'
import type { ConferenceRow } from '@/lib/events/types'
import {
  ASSOCIATION_MIN_CONFERENCES,
  CRAWLER_INDUSTRY_BUCKET,
  INDUSTRIES,
  associationSlug,
  bucketFromIndustryText,
  bucketFromWarn,
  type JobRule,
} from '@/lib/seo/topics'

// Data for the public industry, function, conference and association pages (topics.ts has the rules).
// Every job listed is one with a public page (the same allowlist as /jobs/[id]), so each row links inside the site.

// ---- jobs ------------------------------------------------------------------------------------------------

export type JobFilter = { rule: JobRule } | { fn: string }

function filterSql(f: JobFilter): Prisma.Sql {
  if ('fn' in f) return Prisma.sql`"targetFunction" = ${f.fn}`
  const r = f.rule
  const parts: Prisma.Sql[] = []
  if (r.codes?.length) parts.push(Prisma.sql`industry = ANY(${r.codes}::text[])`)
  if (r.sourceCategory?.length) parts.push(Prisma.sql`"sourceCategory" = ANY(${r.sourceCategory}::text[])`)
  if (r.company) parts.push(Prisma.sql`"companyName" ~* ${r.company}`)
  if (r.title) parts.push(Prisma.sql`title ~* ${r.title}`)
  return parts.length ? Prisma.join(parts, ' AND ') : Prisma.sql`false`
}

// The cheap half of the public-page allowlist (the full rule scans the whole board and takes tens of seconds):
// open, shown to everyone, named employer, verified live in the last week. Counts use this; the rows shown are
// re-checked against the full rule (isPublicJob) so every listed job really has a page.
const PUBLIC = Prisma.sql`status = 'approved' AND "archivedAt" IS NULL AND "closeReason" IS NULL AND disclosure = 'OPEN' AND distribution = 'OPEN'
  AND "institutionScopeId" IS NULL AND "orgScopeId" IS NULL AND "lastVerifiedAt" > now() - interval '7 days'`

export interface TopicJob {
  id: string
  title: string
  company: string
  location: string | null
  postedAt: string
  pay: string | null
}

const k = (n: number) => `$${Math.round(n / 1000)}k`
function payText(min: number | null, max: number | null, period: string | null): string | null {
  if (!min || !max || period !== 'year' || max < min || min < 20_000 || max > 2_000_000) return null
  return min === max ? k(min) : `${k(min)}–${k(max)}`
}

export interface TopicJobs {
  total: number
  jobs: TopicJob[]
  functions: { name: string; count: number }[]
  industries: { name: string; count: number }[]
  employers: { name: string; slug: string; count: number }[]
}

async function loadJobs(f: JobFilter): Promise<TopicJobs> {
  const where = Prisma.sql`${PUBLIC} AND ${filterSql(f)}`
  // One scan of the open board, shared by every figure below (it used to be five scans on five connections, 18-35 s each).
  // The partial index ExclusiveJobPosting_seo_topic_idx (prisma/manual/2026-10-26-seo-page-indexes.sql) makes this scan an
  // index-only read; without it the query still works, just slowly.
  const [agg, ghosts] = await Promise.all([
    prisma.$queryRaw<
      { total: number; ids: string[] | null; functions: { name: string; n: number }[] | null; industries: { name: string; n: number }[] | null; employers: { cid: string; n: number }[] | null }[]
    >`WITH f AS MATERIALIZED (
        SELECT id, "postedAt", "targetFunction", industry, "companyId" FROM "ExclusiveJobPosting" WHERE ${where}
      )
      SELECT (SELECT count(*) FROM f)::int AS total,
        (SELECT json_agg(x.id ORDER BY x."postedAt" DESC NULLS LAST) FROM (SELECT id, "postedAt" FROM f ORDER BY "postedAt" DESC NULLS LAST LIMIT 80) x) AS ids,
        (SELECT json_agg(x) FROM (SELECT "targetFunction" AS name, count(*)::int AS n FROM f WHERE "targetFunction" IS NOT NULL GROUP BY 1 ORDER BY 2 DESC LIMIT 8) x) AS functions,
        (SELECT json_agg(x) FROM (SELECT industry AS name, count(*)::int AS n FROM f WHERE industry IS NOT NULL GROUP BY 1 ORDER BY 2 DESC LIMIT 6) x) AS industries,
        (SELECT json_agg(x) FROM (SELECT "companyId" AS cid, count(*)::int AS n FROM f WHERE "companyId" IS NOT NULL GROUP BY 1 ORDER BY 2 DESC LIMIT 60) x) AS employers`,
    getConfirmedGhostIds(),
  ])
  const a = agg[0]
  const count = [{ n: a?.total ?? 0 }]
  const ids = (a?.ids ?? []).map((id) => ({ id }))
  const fnRows = a?.functions ?? []
  const indRows = a?.industries ?? []
  // Only employers that have a public page get a link: the 60 busiest, joined to their company record in a second, small query.
  const topEmployers = a?.employers ?? []
  const empRows = topEmployers.length
    ? await prisma.$queryRaw<{ id: string; name: string; canonical: string }[]>`
        SELECT c.id, c.name, c."canonicalNameNormalized" AS canonical
        FROM "Company" c JOIN "CompanyHiringProfile" p ON p."companyId" = c.id
        WHERE c.id = ANY(${topEmployers.map((e) => e.cid)}::text[]) AND p."openNow" >= ${EMPLOYER_MIN_OPEN_ROLES}`
    : []
  const nByCompany = new Map(topEmployers.map((e) => [e.cid, e.n]))
  const empSorted = empRows.map((r) => ({ ...r, n: nByCompany.get(r.id) ?? 0 })).sort((x, y) => y.n - x.n).slice(0, 12)
  const wide = await prisma.exclusiveJobPosting.findMany({ where: { id: { in: ids.map((r) => r.id) } }, select: PUBLIC_JOB_SELECT })
  const byId = new Map(wide.map((w) => [w.id, w]))
  const now = Date.now()
  const rows = ids.flatMap((r) => {
    const w = byId.get(r.id)
    return w && isPublicJob(w, now, ghosts.has(w.id)) ? [w] : []
  }).slice(0, 15)
  return {
    total: count[0]?.n ?? 0,
    jobs: rows.map((r) => ({ id: r.id, title: r.title, company: r.companyName, location: r.location, postedAt: (r.postedAt ?? r.createdAt).toISOString(), pay: payText(r.salaryMin, r.salaryMax, r.payPeriod) })),
    functions: fnRows.map((r) => ({ name: r.name, count: r.n })),
    industries: mergeBuckets(indRows),
    employers: empSorted.map((r) => ({ name: r.name, slug: employerSlug(r.canonical, r.id), count: r.n })),
  }
}

/** Crawler codes -> buckets, counts summed. */
function mergeBuckets(rows: { name: string; n: number }[]): { name: string; count: number }[] {
  const m = new Map<string, number>()
  for (const r of rows) {
    const b = CRAWLER_INDUSTRY_BUCKET[r.name]
    if (b) m.set(b, (m.get(b) ?? 0) + r.n)
  }
  return [...m].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count)
}

const cachedJobs = unstable_cache((f: string) => heavy(() => loadJobs(JSON.parse(f) as JobFilter)), ['topic-jobs-v4'], { revalidate: 3600 })

/** Open public jobs for an industry rule or a function, with the functions/industries/employers they sit in. */
export async function getTopicJobs(f: JobFilter): Promise<TopicJobs> {
  return cachedJobs(JSON.stringify(f))
}

// ---- layoffs ---------------------------------------------------------------------------------------------

export interface TopicNotice {
  id: string
  state: string
  employer: string
  slug: string
  workers: number | null
  noticeDate: string
  bucket: string | null
  companyId: string | null
}

async function loadNotices(): Promise<TopicNotice[]> {
  const since = new Date(Date.now() - TWELVE_MONTHS_MS)
  const rows = await prisma.warnNotice.findMany({
    where: {
      dismissedAt: null, source: 'WARN_FILING', state: { not: null }, noticeDate: { gte: since, lte: new Date() },
      NOT: { sourceUrl: { contains: 'layoffs.fyi', mode: 'insensitive' } },
    },
    select: { id: true, state: true, employer: true, employees: true, noticeDate: true, industry: true, companyId: true, companyMatchStatus: true, company: { select: { name: true, industry: true } } },
    orderBy: [{ noticeDate: 'desc' }, { employees: 'desc' }],
  })
  return rows.map((r) => {
    const matched = r.companyMatchStatus === 'MATCHED' ? r.company : null
    return {
      id: r.id,
      state: r.state!,
      employer: cleanEmployer(r.employer, matched?.name ?? null),
      slug: layoffEmployerSlug(r.employer, matched?.name ?? null),
      workers: r.employees,
      noticeDate: r.noticeDate!.toISOString(),
      bucket: bucketFromWarn(r.industry, r.employer, matched?.industry ?? r.company?.industry),
      companyId: r.companyId,
    }
  })
}

const cachedNotices = unstable_cache(loadNotices, ['topic-notices-v1'], { revalidate: 3600 })
export const getRecentNotices = cache(() => cachedNotices().catch(() => [] as TopicNotice[]))

export async function getIndustryNotices(bucket: string): Promise<TopicNotice[]> {
  return (await getRecentNotices()).filter((n) => n.bucket === bucket)
}

/** Notices at employers that also have open public jobs in the function. */
export async function getFunctionNotices(fn: string): Promise<TopicNotice[]> {
  const notices = await getRecentNotices()
  const ids = [...new Set(notices.map((n) => n.companyId).filter((x): x is string => !!x))]
  if (ids.length === 0) return []
  const rows = await prisma.$queryRaw<{ companyId: string }[]>`
    SELECT DISTINCT "companyId" FROM "ExclusiveJobPosting"
    WHERE ${PUBLIC} AND "targetFunction" = ${fn} AND "companyId" = ANY(${ids}::text[])`
  const hiring = new Set(rows.map((r) => r.companyId))
  return notices.filter((n) => n.companyId && hiring.has(n.companyId))
}

/** Buckets with notices, counted: which industries the layoff record touches. */
export async function noticeCountsByBucket(): Promise<Map<string, number>> {
  const m = new Map<string, number>()
  for (const n of await getRecentNotices()) if (n.bucket) m.set(n.bucket, (m.get(n.bucket) ?? 0) + 1)
  return m
}

// ---- conferences -----------------------------------------------------------------------------------------

export type Conf = ConferenceRow & { id: string; linkStatus: string | null }

const startOfToday = () => {
  const d = new Date()
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

/** Upcoming confirmed dates first (soonest), then the rest by importance. */
export function sortConferences<T extends Pick<Conf, 'datesConfirmed' | 'startDate' | 'endDate' | 'importance' | 'name'>>(rows: T[]): T[] {
  const now = new Date()
  const up = (r: T) => hasUpcomingDates(r, now)
  return [...rows].sort((a, b) => {
    if (up(a) !== up(b)) return up(a) ? -1 : 1
    if (up(a)) return a.startDate!.getTime() - b.startDate!.getTime()
    return a.importance - b.importance || a.name.localeCompare(b.name)
  })
}

export interface ConfList { total: number; upcoming: number; rows: Conf[]; summary: ConfSummary }

async function listConferences(where: Prisma.ConferenceEventWhereInput, take = 60): Promise<ConfList> {
  const all = (await prisma.conferenceEvent.findMany({ where: { published: true, ...where }, orderBy: [{ importance: 'asc' }, { name: 'asc' }], take: 600 })) as unknown as Conf[]
  const sorted = sortConferences(all)
  const now = new Date()
  return { total: all.length, upcoming: all.filter((c) => hasUpcomingDates(c, now)).length, rows: sorted.slice(0, take), summary: summarizeConferences(all) }
}

export const conferencesForIndustry = (bucket: string, take?: number) => listConferences({ industries: { has: bucket } }, take)
/** Conferences tagged for the function, plus those with no function tag whose roles point to it (function-inference.ts). */
export async function conferencesForFunction(fn: string, take?: number): Promise<ConfList> {
  const inferred = (await getCatalogIndex()).filter((c) => c.ownFunctions.length === 0 && inferFunctions(c.roles).includes(fn)).map((c) => c.id)
  return listConferences({ OR: [{ functions: { has: fn } }, ...(inferred.length ? [{ id: { in: inferred } }] : [])] }, take)
}
export const conferencesForOrganizer = (organizers: string[]) => listConferences({ organizer: { in: organizers } }, 100)

/** Every published conference's slug inputs, for the sitemap, the hub and association grouping. */
async function loadCatalogIndex() {
  const rows = await prisma.conferenceEvent.findMany({
    where: { published: true },
    select: {
      id: true, name: true, organizer: true, updatedAt: true, industries: true, functions: true, importance: true,
      datesConfirmed: true, startDate: true, typicalMonth: true, format: true, city: true, state: true, access: true, costLow: true, costHigh: true,
      speaking: true, speakingDeadline: true, seniorities: true, roles: true, programFormats: true, whyAttend: true, cheaperWays: true, verified: true, checkedAt: true,
    },
  })
  return rows.map((r) => ({ ...r, ownFunctions: r.functions, functions: effectiveFunctions(r), updatedAt: r.updatedAt.toISOString(), startDate: r.startDate?.toISOString() ?? null, speakingDeadline: r.speakingDeadline?.toISOString() ?? null, checkedAt: r.checkedAt?.toISOString() ?? null }))
}
const cachedCatalog = unstable_cache(loadCatalogIndex, ['topic-conference-index-v2'], { revalidate: 3600 })
export const getCatalogIndex = cache(() => cachedCatalog())

export interface Association { slug: string; name: string; organizers: string[]; count: number }

/** Organizers with two or more published conferences, grouped by slug (spelling variants merge). */
export async function getAssociations(): Promise<Association[]> {
  const by = new Map<string, { names: Map<string, number>; count: number }>()
  for (const r of await getCatalogIndex()) {
    const name = r.organizer?.trim()
    if (!name) continue
    const slug = associationSlug(name)
    if (!slug) continue
    const e = by.get(slug) ?? { names: new Map(), count: 0 }
    e.count++
    e.names.set(name, (e.names.get(name) ?? 0) + 1)
    by.set(slug, e)
  }
  return [...by]
    .filter(([, e]) => e.count >= ASSOCIATION_MIN_CONFERENCES)
    .map(([slug, e]) => {
      const names = [...e.names].sort((a, b) => b[1] - a[1]).map(([n]) => n)
      return { slug, name: names[0], organizers: names, count: e.count }
    })
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
}

export async function getAssociation(slug: string): Promise<Association | null> {
  return (await getAssociations()).find((a) => a.slug === slug) ?? null
}

export interface ConferenceDetail {
  conf: Conf
  editions: { year: number; startDate: Date | null; endDate: Date | null; city: string | null; state: string | null; status: string }[]
  opportunities: { id: string; type: string; title: string; url: string | null; opensAt: Date | null; deadline: Date | null; eligibility: string | null; notes: string | null }[]
  employers: { name: string; role: string; year: number | null; sourceUrl: string | null }[]
  association: Association | null
  related: Conf[]
}

export async function getConference(id: string): Promise<ConferenceDetail | null> {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id)) return null
  const conf = (await prisma.conferenceEvent.findFirst({ where: { id, published: true } })) as unknown as Conf | null
  if (!conf) return null
  const today = startOfToday()
  const [editions, opportunities, employers, associations, related] = await Promise.all([
    prisma.conferenceEdition.findMany({ where: { seriesId: id, status: { not: 'CANCELLED' } }, orderBy: { year: 'desc' }, take: 6, select: { year: true, startDate: true, endDate: true, city: true, state: true, status: true } }),
    prisma.conferenceOpportunity.findMany({
      where: { seriesId: id, published: true, OR: [{ deadline: null }, { deadline: { gte: today } }] },
      orderBy: [{ deadline: { sort: 'asc', nulls: 'last' } }],
      take: 12,
      select: { id: true, type: true, title: true, url: true, opensAt: true, deadline: true, eligibility: true, notes: true },
    }),
    // The table is applied by hand (prisma/manual/conference-employers.sql); a deploy that lands first must not 500.
    employersForConference(id),
    getAssociations().catch(() => [] as Association[]),
    conf.industries.length
      ? prisma.conferenceEvent.findMany({ where: { published: true, id: { not: id }, industries: { hasSome: conf.industries } }, orderBy: [{ importance: 'asc' }], take: 120 })
      : Promise.resolve([]),
  ])
  const slug = conf.organizer ? associationSlug(conf.organizer) : ''
  return {
    conf,
    editions,
    opportunities,
    employers,
    association: associations.find((a) => a.slug === slug) ?? null,
    related: sortConferences(related as unknown as Conf[]).slice(0, 6),
  }
}

// ---- hub counts ------------------------------------------------------------------------------------------

export async function industryConferenceCounts(): Promise<Map<string, number>> {
  const m = new Map<string, number>()
  for (const r of await getCatalogIndex()) for (const i of r.industries) m.set(i, (m.get(i) ?? 0) + 1)
  return m
}

export { INDUSTRIES, bucketFromIndustryText }


// ---- quality gate over the whole catalog ----------------------------------------------------------------

/** id -> assessment for every published conference, from the rows alone (no per-page queries), so the sitemap and the page agree. */
export const getConferenceAssessments = cache(async (): Promise<Map<string, Assessment>> => {
  const [catalog, associations] = await Promise.all([getCatalogIndex(), getAssociations()])
  const assocSlugs = new Set(associations.map((a) => a.slug))
  const perIndustry = new Map<string, number>()
  for (const c of catalog) for (const i of c.industries) perIndustry.set(i, (perIndustry.get(i) ?? 0) + 1)
  const out = new Map<string, Assessment>()
  for (const c of catalog) {
    const related = c.industries.length ? Math.max(0, ...c.industries.map((i) => (perIndustry.get(i) ?? 1) - 1)) : 0
    const hasAssoc = !!c.organizer && assocSlugs.has(associationSlug(c.organizer))
    out.set(c.id, assessConference(c, hasAssoc, related))
  }
  return out
})

// ---- market snapshot (jobs) ------------------------------------------------------------------------------

export interface JobStats {
  /** Verified open jobs the figures are drawn from (the newest 5,000 at most). */
  sample: number
  paid: number
  p25: number | null
  p50: number | null
  p75: number | null
  entryPct: number
  noExperiencePct: number
  aiSkillPct: number
  aiExposedPct: number
  remotePct: number
  skills: { name: string; count: number }[]
  states: { state: string; count: number }[]
}

async function loadJobStats(f: JobFilter): Promise<JobStats | null> {
  const where = Prisma.sql`${PUBLIC} AND ${filterSql(f)}`
  const sample = Prisma.sql`SELECT level, "postingSignals", "aiSkillGroups", "aiExposed", "workArrangement", "locationState", "salaryMin", "salaryMax", "payPeriod", skills
    FROM "ExclusiveJobPosting" WHERE ${where} ORDER BY "postedAt" DESC NULLS LAST LIMIT 5000`
  const paidOk = Prisma.sql`"payPeriod" = 'year' AND "salaryMin" BETWEEN 20000 AND 2000000 AND "salaryMax" >= "salaryMin" AND "salaryMax" <= 2000000`
  const [agg, skills, states] = await Promise.all([
    prisma.$queryRaw<{ n: number; entry: number; noexp: number; aiskill: number; aiexp: number; remote: number; paid: number; p25: number | null; p50: number | null; p75: number | null }[]>`
      WITH s AS (${sample})
      SELECT count(*)::int AS n,
        count(*) FILTER (WHERE level IN ('ENTRY_IC','EARLY_IC'))::int AS entry,
        count(*) FILTER (WHERE 'no_experience_ok' = ANY("postingSignals"))::int AS noexp,
        count(*) FILTER (WHERE cardinality("aiSkillGroups") > 0)::int AS aiskill,
        count(*) FILTER (WHERE "aiExposed")::int AS aiexp,
        count(*) FILTER (WHERE "workArrangement" = 'remote')::int AS remote,
        count(*) FILTER (WHERE ${paidOk})::int AS paid,
        (percentile_cont(0.25) WITHIN GROUP (ORDER BY ("salaryMin" + "salaryMax") / 2.0) FILTER (WHERE ${paidOk}))::float AS p25,
        (percentile_cont(0.5) WITHIN GROUP (ORDER BY ("salaryMin" + "salaryMax") / 2.0) FILTER (WHERE ${paidOk}))::float AS p50,
        (percentile_cont(0.75) WITHIN GROUP (ORDER BY ("salaryMin" + "salaryMax") / 2.0) FILTER (WHERE ${paidOk}))::float AS p75
      FROM s`,
    prisma.$queryRaw<{ name: string; n: number }[]>`WITH s AS (${sample}) SELECT sk AS name, count(*)::int AS n FROM s, unnest(skills) sk GROUP BY 1 ORDER BY 2 DESC LIMIT 10`,
    prisma.$queryRaw<{ name: string; n: number }[]>`WITH s AS (${sample}) SELECT "locationState" AS name, count(*)::int AS n FROM s WHERE "locationState" IS NOT NULL GROUP BY 1 ORDER BY 2 DESC LIMIT 5`,
  ])
  const a = agg[0]
  if (!a || a.n < 30) return null
  const pct = (x: number) => Math.round((x / a.n) * 100)
  const round = (x: number | null) => (x == null ? null : Math.round(x / 1000) * 1000)
  return {
    sample: a.n,
    paid: a.paid,
    p25: a.paid >= 30 ? round(a.p25) : null,
    p50: a.paid >= 30 ? round(a.p50) : null,
    p75: a.paid >= 30 ? round(a.p75) : null,
    entryPct: pct(a.entry),
    noExperiencePct: pct(a.noexp),
    aiSkillPct: pct(a.aiskill),
    aiExposedPct: pct(a.aiexp),
    remotePct: pct(a.remote),
    skills: skills.map((r) => ({ name: r.name, count: r.n })),
    states: states.map((r) => ({ state: r.name, count: r.n })),
  }
}

const cachedStats = unstable_cache((f: string) => loadJobStats(JSON.parse(f) as JobFilter), ['topic-job-stats-v1'], { revalidate: 3600 })
export const getJobStats = (f: JobFilter) => cachedStats(JSON.stringify(f)).catch(() => null)

// ---- conference summary for a list ----------------------------------------------------------------------

export interface ConfSummary {
  total: number
  upcoming: number
  next: { id: string; name: string; start: string }[]
  cfpOpen: number
  medianCost: number | null
  costed: number
  freeCount: number
  topOrganizers: { name: string; count: number }[]
  topStates: { state: string; count: number }[]
}

export function summarizeConferences(all: Pick<Conf, 'id' | 'name' | 'startDate' | 'endDate' | 'datesConfirmed' | 'speaking' | 'speakingDeadline' | 'costLow' | 'access' | 'organizer' | 'state'>[]): ConfSummary {
  const now = new Date()
  const up = all.filter((c) => hasUpcomingDates(c, now)).sort((a, b) => a.startDate!.getTime() - b.startDate!.getTime())
  const costs = all.map((c) => c.costLow).filter((x): x is number => x != null && x > 0).sort((a, b) => a - b)
  const tally = (pick: (c: (typeof all)[number]) => string | null) => {
    const m = new Map<string, number>()
    for (const c of all) { const v = pick(c); if (v) m.set(v, (m.get(v) ?? 0) + 1) }
    return [...m].sort((a, b) => b[1] - a[1])
  }
  return {
    total: all.length,
    upcoming: up.length,
    next: up.slice(0, 4).map((c) => ({ id: c.id, name: c.name, start: c.startDate!.toISOString() })),
    cfpOpen: all.filter((c) => c.speaking === 'OPEN_CFP' && (!c.speakingDeadline || c.speakingDeadline >= now)).length,
    medianCost: costs.length >= 5 ? costs[Math.floor(costs.length / 2)] : null,
    costed: costs.length,
    freeCount: all.filter((c) => c.access === 'FREE').length,
    topOrganizers: tally((c) => c.organizer).slice(0, 5).map(([name, count]) => ({ name, count })),
    topStates: tally((c) => c.state).slice(0, 5).map(([state, count]) => ({ state, count })),
  }
}
