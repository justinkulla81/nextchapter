import 'server-only'
import { cache } from 'react'
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
  const [count, ids, fnRows, indRows, empRows, ghosts] = await Promise.all([
    prisma.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM "ExclusiveJobPosting" WHERE ${where}`,
    prisma.$queryRaw<{ id: string }[]>`SELECT id FROM "ExclusiveJobPosting" WHERE ${where} ORDER BY "postedAt" DESC NULLS LAST LIMIT 80`,
    prisma.$queryRaw<{ name: string; n: number }[]>`
      SELECT "targetFunction" AS name, count(*)::int AS n FROM "ExclusiveJobPosting" WHERE ${where} AND "targetFunction" IS NOT NULL GROUP BY 1 ORDER BY 2 DESC LIMIT 8`,
    prisma.$queryRaw<{ name: string; n: number }[]>`
      SELECT industry AS name, count(*)::int AS n FROM "ExclusiveJobPosting" WHERE ${where} AND industry IS NOT NULL GROUP BY 1 ORDER BY 2 DESC LIMIT 6`,
    prisma.$queryRaw<{ id: string; name: string; canonical: string; n: number }[]>`
      SELECT c.id, c.name, c."canonicalNameNormalized" AS canonical, t.n
      FROM (SELECT "companyId" AS cid, count(*)::int AS n FROM "ExclusiveJobPosting" WHERE ${where} AND "companyId" IS NOT NULL GROUP BY 1 ORDER BY 2 DESC LIMIT 60) t
      JOIN "Company" c ON c.id = t.cid JOIN "CompanyHiringProfile" p ON p."companyId" = c.id
      WHERE p."openNow" >= ${EMPLOYER_MIN_OPEN_ROLES}
      ORDER BY t.n DESC LIMIT 12`,
    getConfirmedGhostIds(),
  ])
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
    employers: empRows.map((r) => ({ name: r.name, slug: employerSlug(r.canonical, r.id), count: r.n })),
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

const cachedJobs = unstable_cache((f: string) => loadJobs(JSON.parse(f) as JobFilter), ['topic-jobs-v3'], { revalidate: 3600 })

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

export interface ConfList { total: number; upcoming: number; rows: Conf[] }

async function listConferences(where: Prisma.ConferenceEventWhereInput, take = 60): Promise<ConfList> {
  const all = (await prisma.conferenceEvent.findMany({ where: { published: true, ...where }, orderBy: [{ importance: 'asc' }, { name: 'asc' }], take: 600 })) as unknown as Conf[]
  const sorted = sortConferences(all)
  const now = new Date()
  return { total: all.length, upcoming: all.filter((c) => hasUpcomingDates(c, now)).length, rows: sorted.slice(0, take) }
}

export const conferencesForIndustry = (bucket: string, take?: number) => listConferences({ industries: { has: bucket } }, take)
export const conferencesForFunction = (fn: string, take?: number) => listConferences({ functions: { has: fn } }, take)
export const conferencesForOrganizer = (organizers: string[]) => listConferences({ organizer: { in: organizers } }, 100)

/** Every published conference's slug inputs, for the sitemap, the hub and association grouping. */
async function loadCatalogIndex() {
  const rows = await prisma.conferenceEvent.findMany({ where: { published: true }, select: { id: true, name: true, organizer: true, updatedAt: true, industries: true, functions: true, importance: true } })
  return rows.map((r) => ({ ...r, updatedAt: r.updatedAt.toISOString() }))
}
const cachedCatalog = unstable_cache(loadCatalogIndex, ['topic-conference-index-v1'], { revalidate: 3600 })
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
    prisma.conferenceEmployer.findMany({ where: { seriesId: id }, orderBy: [{ role: 'asc' }, { name: 'asc' }], take: 200, select: { name: true, role: true, year: true, sourceUrl: true } }).catch(() => []),
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
