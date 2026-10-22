import 'server-only'
import { unstable_cache } from 'next/cache'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { functionLabel } from '@/lib/prospects/market'

export const LAYOFF_DAYS = 180
const PRO_LEVELS = ['MANAGER', 'SENIOR_MANAGER', 'DIRECTOR', 'VP', 'SENIOR_IC', 'MID_LEVEL']

export interface LocalGroup { key: string; label: string; name: string; website: string | null; contact: string | null }
export interface LocalNetwork { counts: { boards: number; centers: number; edo: number; chambers: number; other: number }; top: LocalGroup[] }

/** Every workforce, job-center, economic-development and chamber group we hold for one county, counted by kind with the best-fit few listed. */
export async function loadLocalNetwork(fips: string, countyKey: string | null, state: string): Promise<LocalNetwork> {
  const key = (countyKey ?? '').replace(/\s+/g, '')
  const [boards, centers, leads, partners] = await Promise.all([
    prisma.$queryRaw<{ id: string; name: string; website: string | null; directorName: string | null; directorTitle: string | null; fitScore: number | null }[]>`
      select id, name, website, "directorName", "directorTitle", "fitScore" from "WorkforceBoard"
       where state = ${state} and statewide = false and (${key} = any(counties) or ${key} = any("placeCounties"))`,
    prisma.$queryRaw<{ id: string; name: string; detailsUrl: string | null; businessEmail: string | null; fitScore: number | null }[]>`
      select id, name, "detailsUrl", "businessEmail", "fitScore" from "AmericanJobCenter" where "countyFips" = ${fips}`,
    prisma.$queryRaw<{ id: string; name: string; kind: string; website: string | null; contactName: string | null; contactTitle: string | null; fitScore: number | null }[]>`
      select id, name, kind, website, "contactName", "contactTitle", "fitScore" from "GeoOrgLead" where "geoAreaId" = ${fips} and "dismissedAt" is null`,
    prisma.$queryRaw<{ id: string; name: string; kind: string; website: string | null; contactName: string | null; contactTitle: string | null; fitScore: number | null }[]>`
      select id, name, kind, website, "contactName", "contactTitle", "fitScore" from "LocalPartnerOrg" where state = ${state} and ${key} = any(counties)`,
  ])
  const byFit = <T extends { fitScore: number | null }>(a: T[]) => [...a].sort((x, y) => (y.fitScore ?? -1) - (x.fitScore ?? -1))
  const who = (n: string | null, t: string | null) => (n ? `${n}${t ? `, ${t}` : ''}` : null)
  const edoLeads = leads.filter((l) => l.kind === 'ECON_DEV')
  const chambers = leads.filter((l) => l.kind === 'CHAMBER')
  const otherLeads = leads.filter((l) => l.kind === 'WORKFORCE')
  const top: LocalGroup[] = [
    ...byFit(boards).slice(0, 2).map((b) => ({ key: `b${b.id}`, label: 'Workforce board', name: b.name, website: b.website, contact: who(b.directorName, b.directorTitle) })),
    ...byFit(centers).slice(0, 2).map((c) => ({ key: `c${c.id}`, label: 'Job center', name: c.name, website: c.detailsUrl, contact: c.businessEmail })),
    ...byFit(partners).slice(0, 3).map((x) => ({ key: `p${x.id}`, label: x.kind === 'EDD' ? 'EDA district' : x.kind === 'STATE_AGENCY' ? 'State agency' : 'Economic development', name: x.name, website: x.website, contact: who(x.contactName, x.contactTitle) })),
    ...byFit(edoLeads).slice(0, 3).map((x) => ({ key: `e${x.id}`, label: 'Economic development', name: x.name, website: x.website, contact: who(x.contactName, x.contactTitle) })),
    ...byFit(chambers).slice(0, 2).map((x) => ({ key: `h${x.id}`, label: 'Chamber', name: x.name, website: x.website, contact: who(x.contactName, x.contactTitle) })),
    ...byFit(otherLeads).slice(0, 2).map((x) => ({ key: `w${x.id}`, label: 'Workforce', name: x.name, website: x.website, contact: who(x.contactName, x.contactTitle) })),
  ]
  return { counts: { boards: boards.length, centers: centers.length, edo: edoLeads.length + partners.length, chambers: chambers.length, other: otherLeads.length }, top }
}

export interface LayoffRow { employer: string; employees: number; noticeDate: Date; filings: number }
export interface LayoffSummary { days: number; filings: number; employers: number; jobs: number; rows: LayoffRow[] }

const tidyEmployer = (n: string) => n.replace(/\*[^*]*\*/g, '').replace(/&amp;/g, '&').replace(/\s*[-–(].*$/, '').replace(/,?\s+(inc|llc|corp|corporation|co|company|ltd)\.?\s*$/i, '').replace(/\s+\d+\s.*$/, '').replace(/\s+and$/i, '').replace(/,\s*$/, '').trim() || n

/**
 * State WARN filings for the county in the last LAYOFF_DAYS days, rolled up by employer (a company with several sites is one row).
 * Computed live: the precomputed 90-day and 12-month figures on the area record are only as fresh as its last build.
 */
export async function loadCountyLayoffs(state: string, countyName: string | null): Promise<LayoffSummary> {
  const since = new Date(Date.now() - LAYOFF_DAYS * 86_400_000)
  const base = countyName ? countyName.replace(/\s+(county|parish|borough)$/i, '').trim() : ''
  const rows = await prisma.warnNotice.findMany({
    where: { state, source: 'WARN_FILING', dismissedAt: null, ...(base ? { county: { contains: base, mode: 'insensitive' as const } } : {}), OR: [{ noticeDate: { gte: since } }, { noticeDate: null, fetchedAt: { gte: since } }] },
    select: { employer: true, normalizedEmployer: true, employees: true, noticeDate: true, fetchedAt: true },
  })
  const by = new Map<string, LayoffRow>()
  for (const r of rows) {
    const at = r.noticeDate ?? r.fetchedAt
    const name = tidyEmployer(r.employer)
    const k = name.toLowerCase()
    const cur = by.get(k)
    if (cur) { cur.employees += r.employees ?? 0; cur.filings++; if (at > cur.noticeDate) cur.noticeDate = at }
    else by.set(k, { employer: name, employees: r.employees ?? 0, noticeDate: at, filings: 1 })
  }
  const list = [...by.values()].sort((a, b) => b.employees - a.employees)
  return { days: LAYOFF_DAYS, filings: rows.length, employers: list.length, jobs: list.reduce((n, r) => n + r.employees, 0), rows: list }
}

export interface OpenJobs { roles: number; employers: number; professional: number; medianPay: number | null; topFunctions: { fn: string; label: string; roles: number }[] }

/**
 * Open roles our crawler saw in the last 14 days whose location names a city in the county. Postings carry free-text locations, not a county,
 * so cities come from the job centers, colleges and organizations we hold for the county; remote roles and unlisted towns are not counted.
 */
async function countCountyJobs(fips: string | null, state: string, countyName: string | null): Promise<OpenJobs | null> {
  const cities = fips ? await prisma.$queryRaw<{ city: string }[]>`
    select distinct city from (
      select city from "AmericanJobCenter" where "countyFips" = ${fips}
      union select city from "LocalCollege" where "countyFips" = ${fips}
      union select city from "GeoOrgLead" where "geoAreaId" = ${fips}) x where city is not null` : []
  const abbrev: Record<string, string> = { 'Spgs': 'Springs', 'Spg': 'Spring', 'Hts': 'Heights', 'Mt': 'Mount', 'Pt': 'Point' }
  const names = new Set<string>()
  for (const c of cities) {
    names.add(c.city)
    const full = c.city.replace(/\b(Spgs|Spg|Hts|Mt|Pt)\b/g, (m) => abbrev[m] ?? m)
    if (full !== c.city) names.add(full)
  }
  if (!fips) return null // A whole state's postings is too big to count on a page view; the company section shows its own openings.
  const patterns = [...[...names].map((n) => `%${n}, ${state}%`), `%${countyName}%`]
  // One pass over the postings: the matching rows are pulled once and everything is counted from them.
  const [r] = await prisma.$queryRaw<{ roles: bigint; employers: bigint; pro: bigint; median: number | null; fns: { fn: string; roles: number }[] | null }[]>(Prisma.sql`
    WITH b AS MATERIALIZED (
      SELECT "companyName", "seniorityGroup", "payAnnualMid", "function" FROM "CompanyJobOpening"
       WHERE "closedAt" IS NULL AND "lastSeenAt" >= now() - interval '14 days' AND ${state} = ANY(states) AND location ILIKE ANY (${patterns}))
    SELECT (SELECT count(*) FROM b) roles, (SELECT count(DISTINCT "companyName") FROM b) employers,
           (SELECT count(*) FROM b WHERE "seniorityGroup" = ANY(${PRO_LEVELS})) pro,
           (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY "payAnnualMid") FROM b WHERE "payAnnualMid" BETWEEN 30000 AND 900000) median,
           (SELECT json_agg(x) FROM (SELECT "function" fn, count(*)::int roles FROM b WHERE "function" IS NOT NULL GROUP BY 1 ORDER BY 2 DESC LIMIT 4) x) fns`)
  const roles = Number(r?.roles ?? 0)
  if (!roles) return null
  return {
    roles, employers: Number(r.employers), professional: Number(r.pro), medianPay: r.median ? Math.round(r.median / 1000) * 1000 : null,
    topFunctions: (r.fns ?? []).map((f) => ({ fn: f.fn, label: functionLabel(f.fn), roles: f.roles })),
  }
}

/**
 * Counting a county's postings scans the whole open-postings table (no location index), so each county is counted once and kept for six hours.
 */
export const loadCountyJobs = unstable_cache(countCountyJobs, ['county-open-jobs-v1'], { revalidate: 6 * 3600 })

/** A section that takes too long is left out rather than holding up the page. */
export function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([p.catch(() => fallback), new Promise<T>((res) => setTimeout(() => res(fallback), ms))])
}

export interface CompanyContext {
  industry: string | null
  openNow: number; opened90d: number; opened12mo: number
  topFunctions: { fn: string; label: string; roles: number }[]
  topLocations: { location: string; count: number }[]
  payLevel: string
  layoffs: LayoffSummary
  layoffNews12mo: number
}

/** The hiring and layoff picture for the company behind an organization, from its rolled-up hiring profile and state WARN filings. */
export async function loadCompanyContext(companyId: string): Promise<CompanyContext | null> {
  const h = await prisma.companyHiringProfile.findUnique({ where: { companyId } })
  const since = new Date(Date.now() - LAYOFF_DAYS * 86_400_000)
  const rows = await prisma.warnNotice.findMany({
    where: { companyId, dismissedAt: null, OR: [{ noticeDate: { gte: since } }, { noticeDate: null, fetchedAt: { gte: since } }] },
    select: { employer: true, employees: true, noticeDate: true, fetchedAt: true, state: true, county: true }, orderBy: { noticeDate: 'desc' },
  })
  if (!h && rows.length === 0) return null
  const layoffs: LayoffSummary = {
    days: LAYOFF_DAYS, filings: rows.length, employers: rows.length ? 1 : 0, jobs: rows.reduce((n, r) => n + (r.employees ?? 0), 0),
    rows: rows.map((r) => ({ employer: [r.county, r.state].filter(Boolean).join(', ') || r.employer, employees: r.employees ?? 0, noticeDate: r.noticeDate ?? r.fetchedAt, filings: 1 })),
  }
  const fns = ((h?.topFunctions as { function: string; count: number }[] | null) ?? []).slice(0, 5)
  return {
    industry: h?.industry ?? null, openNow: h?.openNow ?? 0, opened90d: h?.opened90d ?? 0, opened12mo: h?.opened12mo ?? 0,
    topFunctions: fns.map((f) => ({ fn: f.function, label: functionLabel(f.function), roles: f.count })),
    // Multi-city postings ('Chicago, IL; New York, NY') are left out and the country suffix dropped, so the list reads as places.
    topLocations: ((h?.topLocations as { location: string; count: number }[] | null) ?? []).filter((l) => !l.location.includes(';')).map((l) => ({ ...l, location: l.location.replace(/,\s*(USA|US|United States)$/i, '') })).slice(0, 5),
    payLevel: h?.payLevel ?? 'insufficient', layoffs, layoffNews12mo: h?.layoffNews12mo ?? 0,
  }
}
