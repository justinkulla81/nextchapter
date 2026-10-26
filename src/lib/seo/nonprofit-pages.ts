import 'server-only'
import { cache } from 'react'
import { memoTtl, retryOnPoolTimeout } from '@/lib/db/heavy'
import { prisma } from '@/lib/prisma'
import { orgSlug } from '@/lib/crm/org-slug'
import { opportunitiesForKinds, type StoredOpportunity } from '@/lib/funding-opportunities/store'
import { readable } from '@/lib/seo/employer-slug'

// Public nonprofit pages (/nonprofits/<state>/<org>): the IRS public record for the organization (name, city,
// type, revenue, filing year), the labor market and layoff picture where it works, grants open to nonprofits in
// its state, and its local workforce boards. Only IRS-published figures: no contact names, emails or phones.

/** Annual revenue a nonprofit needs before its page is offered to search engines. */
export const NONPROFIT_MIN_REVENUE = 1_000_000

export const NONPROFIT_KINDS: Record<string, { label: string; plural: string }> = {
  CHAMBER: { label: 'chamber of commerce or business association', plural: 'Chambers of commerce and business associations' },
  ECON_DEV: { label: 'economic development organization', plural: 'Economic development organizations' },
  WORKFORCE: { label: 'workforce development organization', plural: 'Workforce development organizations' },
}

export const NTEE_GROUPS: Record<string, string> = {
  A: 'Arts, culture and humanities', B: 'Education', C: 'Environment', D: 'Animal-related', E: 'Health care', F: 'Mental health and crisis intervention',
  G: 'Diseases and disorders', H: 'Medical research', I: 'Crime and legal-related', J: 'Employment and job-related', K: 'Food, agriculture and nutrition',
  L: 'Housing and shelter', M: 'Public safety and disaster preparedness', N: 'Recreation and sports', O: 'Youth development', P: 'Human services',
  Q: 'International affairs', R: 'Civil rights and advocacy', S: 'Community improvement and capacity building', T: 'Philanthropy and voluntarism',
  U: 'Science and technology', V: 'Social science', W: 'Public and societal benefit', X: 'Religion-related', Y: 'Mutual and membership benefit',
}

export const nonprofitSlug = (name: string, ein: string) => `${readable(name) || 'organization'}-${ein}`

export interface NonprofitPage {
  ein: string
  slug: string
  name: string
  kind: string
  city: string | null
  state: string
  ntee: string | null
  nteeGroup: string | null
  revenue: number | null
  assets: number | null
  taxYear: string | null
  website: string | null
  claimSlug: string | null
  indexable: boolean
}

function toPage(r: {
  ein: string; name: string; kind: string; city: string | null; state: string; ntee: string | null; revenue: number | null; assets: number | null
  taxPeriod: string | null; website: string | null; crmOrg: { canonicalNameNormalized: string } | null
}): NonprofitPage {
  return {
    ein: r.ein, slug: nonprofitSlug(r.name, r.ein), name: r.name, kind: r.kind, city: r.city, state: r.state, ntee: r.ntee,
    nteeGroup: r.ntee ? (NTEE_GROUPS[r.ntee[0].toUpperCase()] ?? null) : null,
    revenue: r.revenue, assets: r.assets, taxYear: r.taxPeriod ? r.taxPeriod.slice(0, 4) : null, website: r.website,
    claimSlug: r.crmOrg ? orgSlug(r.crmOrg.canonicalNameNormalized) : null,
    indexable: (r.revenue ?? 0) >= NONPROFIT_MIN_REVENUE,
  }
}

const SELECT = { ein: true, name: true, kind: true, city: true, state: true, ntee: true, revenue: true, assets: true, taxPeriod: true, website: true, crmOrganizationId: true } as const

async function withCrm<T extends { crmOrganizationId: string | null }>(rows: T[]) {
  const ids = rows.map((r) => r.crmOrganizationId).filter((x): x is string => !!x)
  const orgs = ids.length ? await prisma.crmOrganization.findMany({ where: { id: { in: ids } }, select: { id: true, canonicalNameNormalized: true } }) : []
  const byId = new Map(orgs.map((o) => [o.id, o]))
  return rows.map((r) => ({ ...r, crmOrg: r.crmOrganizationId ? (byId.get(r.crmOrganizationId) ?? null) : null }))
}

export const getNonprofit = cache(async (state: string, slug: string): Promise<NonprofitPage | null> => {
  const m = /-(\d{9})$/.exec(slug)
  if (!m) return null
  const row = await prisma.geoOrgLead.findUnique({ where: { ein: m[1] }, select: { ...SELECT, dismissedAt: true } })
  if (!row || row.dismissedAt || row.state !== state) return null
  const page = toPage((await withCrm([row]))[0])
  return page.slug === slug ? page : null
})

export const getStateNonprofits = memoTtl(5 * 60_000, (state: string) => state, (state: string) => retryOnPoolTimeout(async (): Promise<NonprofitPage[]> => {
  const rows = await prisma.geoOrgLead.findMany({
    where: { state, dismissedAt: null, revenue: { gte: NONPROFIT_MIN_REVENUE } },
    select: SELECT,
    orderBy: { revenue: 'desc' },
  })
  return (await withCrm(rows)).map(toPage)
}))

export async function getStateNonprofitCounts(): Promise<{ state: string; n: number }[]> {
  const rows = await prisma.geoOrgLead.groupBy({ by: ['state'], where: { dismissedAt: null, revenue: { gte: NONPROFIT_MIN_REVENUE } }, _count: { _all: true } })
  return rows.map((r) => ({ state: r.state, n: r._count._all }))
}

export async function nonprofitsForSitemap(): Promise<{ state: string; slug: string }[]> {
  const rows = await prisma.geoOrgLead.findMany({ where: { dismissedAt: null, revenue: { gte: NONPROFIT_MIN_REVENUE } }, select: { ein: true, name: true, state: true }, orderBy: { ein: 'asc' } })
  return rows.map((r) => ({ state: r.state, slug: nonprofitSlug(r.name, r.ein) }))
}

/** Grants open to nonprofits in a state, soonest closing first. A failed read is "none", never an error page. */
export const getNonprofitFunding = memoTtl(5 * 60_000, (state: string) => state, async (state: string): Promise<StoredOpportunity[]> => {
  try {
    const all = await opportunitiesForKinds(['NONPROFIT'], { state, limit: 40 })
    return all.sort((a, b) => (a.closesAt?.getTime() ?? Infinity) - (b.closesAt?.getTime() ?? Infinity)).slice(0, 8)
  } catch {
    return []
  }
})

export const money = (n: number) =>
  n >= 1_000_000_000 ? `$${(n / 1_000_000_000).toFixed(1)}B` : n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : `$${Math.round(n / 1000)}k`
