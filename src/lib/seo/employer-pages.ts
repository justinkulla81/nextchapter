import 'server-only'
import { cache } from 'react'
import { prisma } from '@/lib/prisma'
import { orgSlug } from '@/lib/crm/org-slug'
import { summarizePay, type PayGroup } from '@/lib/companies/pay-ranges'
import { PUBLIC_JOB_SELECT, getConfirmedGhostIdsForPage } from '@/lib/seo/employer-jobs'
import { isPublicJob } from '@/lib/jobs/public-job-page'
import { canonicalFromEmployerSlug, employerSlug, idSuffixFromSlug } from '@/lib/seo/employer-slug'

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
export function isEmployerIndexable(p: { openNow: number; opened12mo: number } | null, industry: string | null): boolean {
  if (!p) return false
  return p.openNow >= EMPLOYER_MIN_OPEN_ROLES || (p.openNow >= 1 && p.opened12mo >= 3 && !!industry)
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

  const [rows, ghosts] = await Promise.all([
    prisma.exclusiveJobPosting.findMany({
      where: { companyId: company.id, status: 'approved', archivedAt: null },
      select: PUBLIC_JOB_SELECT,
      orderBy: { lastVerifiedAt: 'desc' },
      take: 60,
    }),
    getConfirmedGhostIdsForPage(),
  ])

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
    indexable: isEmployerIndexable(p, company.industry ?? p?.industry ?? null),
  }
})

export const EMPLOYER_SITEMAP_SHARD_SIZE = 10_000

/** The condition behind the employer sitemap: the same rule as `indexable`, in SQL. */
const ELIGIBLE = `FROM "Company" c JOIN "CompanyHiringProfile" p ON p."companyId" = c.id
  WHERE p."openNow" >= ${EMPLOYER_MIN_OPEN_ROLES}
     OR (p."openNow" >= 1 AND p."opened12mo" >= 3 AND COALESCE(c.industry, p.industry) IS NOT NULL)`

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

/** Ids of every company that has a public employer page (the sitemap rule), for lists that link to them. */
export async function employerPageCompanyIds(): Promise<Set<string>> {
  const rows = await prisma.$queryRawUnsafe<{ id: string }[]>(`SELECT c.id ${ELIGIBLE}`)
  return new Set(rows.map((r) => r.id))
}

/** Canonical name and id of every company whose page is offered to search engines. */
export async function employerPageCanonicalRows(): Promise<{ id: string; canonical: string }[]> {
  return prisma.$queryRawUnsafe<{ id: string; canonical: string }[]>(`SELECT c.id, c."canonicalNameNormalized" AS canonical ${ELIGIBLE}`)
}
