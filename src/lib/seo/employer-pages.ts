import 'server-only'
import { cache } from 'react'
import { prisma } from '@/lib/prisma'
import { orgSlug } from '@/lib/crm/org-slug'
import { summarizePay, type PayGroup } from '@/lib/companies/pay-ranges'
import { PUBLIC_JOB_LIST_SELECT, getConfirmedGhostIdsForPage, withDescriptionStubs } from '@/lib/seo/employer-jobs'
import { isPublicJob } from '@/lib/jobs/public-job-page'
import { canonicalFromEmployerSlug, employerSlug, idSuffixFromSlug } from '@/lib/seo/employer-slug'
import { higherEdSql, isHigherEdName } from '@/lib/seo/higher-ed'

// Public employer pages (/employers/<slug>): what an employer is hiring for, what it pays, from our own tables
// (the nightly company hiring index and the live board). Layoff records are deliberately not shown. Public
// business facts only: nothing from the CRM except the slug of the organization's claim page.

/** Open roles an employer needs before its page is offered to search engines. */
export const EMPLOYER_MIN_OPEN_ROLES = 3
/**
 * Every company has a page (so each can be claimed and linked from the CRM), but a page is offered to search engines
 * only when it has data of its own: 3+ open roles, or 1-2 open roles plus a real hiring history (3+ roles opened in the
 * last 12 months) and a known industry. Thinner pages render with noindex and stay out of the sitemap until they qualify.
 */
export interface EmployerExtras {
  /** A WARN layoff notice in the last two years. */
  layoffNotice?: boolean
  /** An SEC filing event (funding, 8-K item) in the last two years: the page carries a dated timeline. */
  secEvent?: boolean
  /** A high-confidence headquarters on record. */
  hqConfirmed?: boolean
  /** A college or university: it has its own pages under /higher-education, so no employer page is offered. */
  higherEd?: boolean
}

export function isEmployerIndexable(p: { openNow: number; opened12mo: number } | null, industry: string | null, extras: EmployerExtras | boolean = {}): boolean {
  const x: EmployerExtras = typeof extras === 'boolean' ? { layoffNotice: extras } : extras
  if (x.higherEd) return false
  // A company with a layoff notice in the last two years has a page of its own substance (the notice, the local picture, the news), whatever it is hiring.
  if (x.layoffNotice) return true
  // A filing in the last two years gives the page a dated timeline of its own (funding, material events).
  if (x.secEvent) return true
  if (!p) return false
  if (p.openNow >= EMPLOYER_MIN_OPEN_ROLES || (p.openNow >= 1 && p.opened12mo >= 3 && !!industry)) return true
  // A confirmed headquarters, a known industry and a live role: jobs, where it is based and how it compares with its industry.
  return !!x.hqConfirmed && !!industry && p.openNow >= 1
}

/** The public path of an employer page. */
export const employerPath = (canonicalNameNormalized: string, id: string) => `/employers/${employerSlug(canonicalNameNormalized, id)}`

export interface EmployerJob { id: string; title: string; location: string | null; pay: string | null }

export interface EmployerPage {
  id: string
  slug: string
  name: string
  website: string | null
  industry: string | null
  sizeBand: string | null
  hqMetro: string | null
  /** Headquarters from the company HQ table: city and state, high or medium confidence only. */
  hq: { city: string | null; state: string | null } | null
  profile: {
    openNow: number; opened90d: number; opened12mo: number; totalSeen: number
    states: string[]; remoteShare: number | null; siteType: string
    topFunctions: { function: string; count: number }[]
    levelMix: { group: string; count: number }[]
    topLocations: { location: string; count: number }[]
    directorPlusShare: number | null
    payLevel: string; payLevelSample: number; payLevelRatio: number | null; postedPayShare: number | null
    firstSeenAt: Date | null
  } | null
  jobs: EmployerJob[]
  pay: PayGroup[]
  claimSlug: string | null
  /** True when the page has enough of its own content to be offered to search engines. */
  indexable: boolean
}

const asArray = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : [])

function money(n: number): string {
  return n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${n}`
}

export const getEmployerBySlug = cache(async (slug: string): Promise<EmployerPage | null> => {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return null
  const select = {
    id: true, name: true, canonicalNameNormalized: true, website: true, industry: true, sizeBand: true, hqMetro: true,
    hiringProfile: true,
    crmOrganizations: { select: { canonicalNameNormalized: true }, take: 1 },
  } as const
  let company = await prisma.company.findUnique({ where: { canonicalNameNormalized: canonicalFromEmployerSlug(slug) }, select })
  const suffix = idSuffixFromSlug(slug)
  if (!company && suffix) {
    const candidate = await prisma.company.findFirst({ where: { id: { endsWith: suffix } }, select })
    if (candidate && employerSlug(candidate.canonicalNameNormalized, candidate.id) === slug) company = candidate
  }
  if (!company || employerSlug(company.canonicalNameNormalized, company.id) !== slug) return null

  const [listed, ghosts] = await Promise.all([
    prisma.exclusiveJobPosting.findMany({
      where: { companyId: company.id, status: 'approved', archivedAt: null },
      select: PUBLIC_JOB_LIST_SELECT,
      orderBy: { lastVerifiedAt: 'desc' },
      take: 60,
    }),
    getConfirmedGhostIdsForPage(),
  ])
  const rows = await withDescriptionStubs(listed)

  const now = Date.now()
  const live = rows.filter((r) => isPublicJob(r, now, ghosts.has(r.id)))
  const jobs: EmployerJob[] = live.slice(0, 10).map((r) => ({
    id: r.id,
    title: r.title,
    location: r.location,
    pay: r.salaryMin && r.salaryMax && r.salaryMax >= r.salaryMin && r.salaryMax < 2_000_000 && r.salaryMin >= 20_000 ? (r.salaryMin === r.salaryMax ? money(r.salaryMin) : `${money(r.salaryMin)}–${money(r.salaryMax)}`) : null,
  }))
  const pay = summarizePay(live.map((r) => ({ title: r.title, salaryMin: r.salaryMin, salaryMax: r.salaryMax, salaryCurrency: r.salaryCurrency }))).filter((g) => g.postings >= 2).slice(0, 6)

  const p = company.hiringProfile
  const hasLayoffNotice = (await prisma.warnNotice.count({ where: { companyId: company.id, dismissedAt: null, OR: [{ noticeDate: { gte: new Date(Date.now() - 2 * 365 * 86_400_000) } }, { noticeDate: null, fetchedAt: { gte: new Date(Date.now() - 2 * 365 * 86_400_000) } }] } }).catch(() => 0)) > 0
  const [secEvents, hq] = await Promise.all([
    prisma.companyEvent.count({ where: { companyId: company.id, eventDate: { gte: new Date(Date.now() - 2 * 365 * 86_400_000) } } }).catch(() => 0),
    prisma.companyHq.findUnique({ where: { companyId: company.id }, select: { confidence: true, city: true, state: true } }).catch(() => null),
  ])
  const openNow = p?.openNow ?? 0
  const crm = company.crmOrganizations[0]
  return {
    id: company.id,
    slug,
    name: company.name,
    website: company.website,
    industry: company.industry ?? p?.industry ?? null,
    sizeBand: company.sizeBand,
    hqMetro: company.hqMetro,
    hq: hq && (hq.confidence === 'high' || hq.confidence === 'medium') && (hq.city || hq.state) ? { city: hq.city, state: hq.state } : null,
    profile: p
      ? {
          openNow, opened90d: p.opened90d, opened12mo: p.opened12mo, totalSeen: p.totalSeen, states: p.states, remoteShare: p.remoteShare, siteType: p.siteType,
          topFunctions: asArray(p.topFunctions), levelMix: asArray(p.levelMix), topLocations: asArray(p.topLocations),
          directorPlusShare: p.directorPlusShare, payLevel: p.payLevel, payLevelSample: p.payLevelSample, payLevelRatio: p.payLevelRatio, postedPayShare: p.postedPayShare,
          firstSeenAt: p.firstSeenAt,
        }
      : null,
    jobs,
    pay,
    claimSlug: crm ? orgSlug(crm.canonicalNameNormalized) : null,
    indexable: isEmployerIndexable(p, company.industry ?? p?.industry ?? null, { layoffNotice: hasLayoffNotice, secEvent: secEvents > 0, hqConfirmed: hq?.confidence === 'high', higherEd: isHigherEdName(company.name) }),
  }
})

export const EMPLOYER_SITEMAP_SHARD_SIZE = 10_000

/** A layoff notice (filing or announcement) tied to the company in the last two years. */
const HAS_SEC_EVENT = `EXISTS (SELECT 1 FROM "CompanyEvent" e WHERE e."companyId" = c.id AND e."eventDate" >= now() - interval '2 years')`
const HQ_CONFIRMED_WITH_ROLE = `(p."openNow" >= 1 AND COALESCE(c.industry, p.industry) IS NOT NULL AND EXISTS (SELECT 1 FROM "CompanyHq" h WHERE h."companyId" = c.id AND h.confidence = 'high'))`
const HAS_LAYOFF_NOTICE = `EXISTS (SELECT 1 FROM "WarnNotice" w WHERE w."companyId" = c.id AND w."dismissedAt" IS NULL AND COALESCE(w."noticeDate", w."fetchedAt") >= now() - interval '2 years')`

/** The condition behind the employer sitemap: the same rule as `indexable`, in SQL. */
const ELIGIBLE = `FROM "Company" c LEFT JOIN "CompanyHiringProfile" p ON p."companyId" = c.id
  WHERE (p."openNow" >= ${EMPLOYER_MIN_OPEN_ROLES}
     OR (p."openNow" >= 1 AND p."opened12mo" >= 3 AND COALESCE(c.industry, p.industry) IS NOT NULL)
     OR ${HAS_LAYOFF_NOTICE}
     OR ${HAS_SEC_EVENT}
     OR ${HQ_CONFIRMED_WITH_ROLE})
     AND NOT ${higherEdSql('c.name')}`

export async function countEmployerPages(): Promise<number> {
  const [row] = await prisma.$queryRawUnsafe<{ n: number }[]>(`SELECT count(*)::int AS n ${ELIGIBLE}`)
  return row?.n ?? 0
}

export async function employersInShard(shard: number): Promise<{ id: string; canonical: string; updatedAt: Date }[]> {
  const rows = await prisma.$queryRawUnsafe<{ id: string; canonical: string; updatedAt: Date }[]>(
    `SELECT c.id, c."canonicalNameNormalized" AS canonical, COALESCE(p."computedAt", c."updatedAt") AS "updatedAt" ${ELIGIBLE} ORDER BY c.id OFFSET ${shard * EMPLOYER_SITEMAP_SHARD_SIZE} LIMIT ${EMPLOYER_SITEMAP_SHARD_SIZE}`,
  )
  return rows
}

/** Whether one company's page is offered to search engines (the same rule as the sitemap, for a single id). */
export async function isCompanyOfferedToSearch(companyId: string): Promise<boolean> {
  const rows = await prisma.$queryRawUnsafe<{ ok: number }[]>(
    `SELECT 1 AS ok FROM "Company" c LEFT JOIN "CompanyHiringProfile" p ON p."companyId" = c.id
     WHERE c.id = $1 AND (p."openNow" >= ${EMPLOYER_MIN_OPEN_ROLES}
       OR (p."openNow" >= 1 AND p."opened12mo" >= 3 AND COALESCE(c.industry, p.industry) IS NOT NULL)
       OR ${HAS_LAYOFF_NOTICE} OR ${HAS_SEC_EVENT} OR ${HQ_CONFIRMED_WITH_ROLE}) AND NOT ${higherEdSql('c.name')} LIMIT 1`,
    companyId,
  )
  return rows.length > 0
}

/** Which of these companies have a page offered to search engines (the sitemap rule), one query for the lot. */
export async function offeredCompanyIds(ids: string[]): Promise<Set<string>> {
  if (!ids.length) return new Set()
  const rows = await prisma.$queryRawUnsafe<{ id: string }[]>(`SELECT c.id ${ELIGIBLE} AND c.id = ANY($1::text[])`, ids)
  return new Set(rows.map((r) => r.id))
}

/** Ids of every company that has a public employer page (the sitemap rule), for lists that link to them. */
export async function employerPageCompanyIds(): Promise<Set<string>> {
  const rows = await prisma.$queryRawUnsafe<{ id: string }[]>(`SELECT c.id ${ELIGIBLE}`)
  return new Set(rows.map((r) => r.id))
}

/** Canonical name and id of every company whose page is offered to search engines. */
export async function employerPageCanonicalRows(): Promise<{ id: string; canonical: string }[]> {
  return prisma.$queryRawUnsafe<{ id: string; canonical: string }[]>(`SELECT c.id, c."canonicalNameNormalized" AS canonical ${ELIGIBLE}`)
}

/**
 * The page a slug that matches no employer should go to: the one employer whose name starts with these words
 * ("tawa-inc-dba" for "Tawa, Inc. dba 99 Ranch Market"), or null when none or several do, so a guess never lands on the wrong one.
 */
export async function resolveEmployerSlug(slug: string): Promise<string | null> {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) || slug.length < 3) return null
  const rows = await prisma.company.findMany({
    where: { canonicalNameNormalized: { startsWith: `${canonicalFromEmployerSlug(slug)} ` } },
    select: { id: true, canonicalNameNormalized: true },
    take: 2,
  })
  return rows.length === 1 ? employerSlug(rows[0].canonicalNameNormalized, rows[0].id) : null
}
