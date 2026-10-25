import 'server-only'
import { cache } from 'react'
import { prisma } from '@/lib/prisma'
import { orgSlug } from '@/lib/crm/org-slug'
import { buildLayoffTimeline, type LayoffTimeline } from '@/lib/companies/layoff-timeline'
import { summarizePay, type PayGroup } from '@/lib/companies/pay-ranges'
import { PUBLIC_JOB_SELECT, getConfirmedGhostIdsForPage } from '@/lib/seo/employer-jobs'
import { isPublicJob } from '@/lib/jobs/public-job-page'
import { canonicalFromEmployerSlug, employerSlug, idSuffixFromSlug } from '@/lib/seo/employer-slug'

// Public employer pages (/employers/<slug>): what an employer is hiring for, what it pays, and its layoff
// record, from our own tables (the nightly company hiring index, the live board, the WARN record). Public
// business facts only: nothing from the CRM except the slug of the organization's claim page.

/** Open roles an employer needs before its page is offered to search engines. */
export const EMPLOYER_MIN_OPEN_ROLES = 3
const TWO_YEARS_MS = 2 * 365 * 86_400_000

export interface EmployerJob { id: string; title: string; location: string | null; pay: string | null }
export interface EmployerNotice { state: string | null; county: string | null; noticeDate: Date; employees: number | null; layoffType: string | null; sourceUrl: string | null }

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
  notices: EmployerNotice[]
  timeline: LayoffTimeline | null
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

  const [rows, ghosts, warn, firstPosting] = await Promise.all([
    prisma.exclusiveJobPosting.findMany({
      where: { companyId: company.id, status: 'approved', archivedAt: null },
      select: PUBLIC_JOB_SELECT,
      orderBy: { lastVerifiedAt: 'desc' },
      take: 60,
    }),
    getConfirmedGhostIdsForPage(),
    prisma.warnNotice.findMany({
      where: { companyId: company.id, dismissedAt: null, source: 'WARN_FILING', noticeDate: { not: null } },
      select: { state: true, county: true, noticeDate: true, employees: true, layoffType: true, sourceUrl: true },
      orderBy: { noticeDate: 'desc' },
      take: 40,
    }),
    prisma.companyJobOpening.findFirst({ where: { companyId: company.id }, orderBy: { firstSeenAt: 'asc' }, select: { firstSeenAt: true } }),
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

  const notices: EmployerNotice[] = warn.map((w) => ({ state: w.state, county: w.county, noticeDate: w.noticeDate!, employees: w.employees, layoffType: w.layoffType, sourceUrl: w.sourceUrl }))
  const timeline = notices.length
    ? buildLayoffTimeline({
        notices: notices.map((n) => ({ noticeDate: n.noticeDate, employees: n.employees, layoffType: n.layoffType, sourceUrl: n.sourceUrl })),
        postings: [],
        trackingStart: firstPosting?.firstSeenAt ?? null,
      })
    : null

  const p = company.hiringProfile
  const openNow = p?.openNow ?? 0
  const recentNotice = notices.some((n) => now - n.noticeDate.getTime() <= TWO_YEARS_MS)
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
    notices,
    timeline,
    claimSlug: crm ? orgSlug(crm.canonicalNameNormalized) : null,
    indexable: openNow >= EMPLOYER_MIN_OPEN_ROLES || recentNotice,
  }
})

export const EMPLOYER_SITEMAP_SHARD_SIZE = 10_000

/** The condition behind the employer sitemap: the same rule as `indexable`, in SQL. */
const ELIGIBLE = `FROM "Company" c LEFT JOIN "CompanyHiringProfile" p ON p."companyId" = c.id
  WHERE p."openNow" >= ${EMPLOYER_MIN_OPEN_ROLES}
     OR EXISTS (SELECT 1 FROM "WarnNotice" w WHERE w."companyId" = c.id AND w."dismissedAt" IS NULL AND w.source = 'WARN_FILING' AND w."noticeDate" > now() - interval '2 years')`

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
