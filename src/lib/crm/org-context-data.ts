import 'server-only'
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

const tidyEmployer = (n: string) => n.replace(/\*[^*]*\*/g, '').replace(/&amp;/g, '&').replace(/\s*[-–(].*$/, '').replace(/,?\s+(inc|llc|corp|corporation|co|company|ltd)\.?\s*$/i, '').replace(/\s+and$/i, '').replace(/,\s*$/, '').trim() || n

/**
 * State WARN filings for the county in the last LAYOFF_DAYS days, rolled up by employer (a company with several sites is one row).
 * Computed live: the precomputed 90-day and 12-month figures on the area record are only as fresh as its last build.
 */
export async function loadCountyLayoffs(state: string, countyName: string): Promise<LayoffSummary> {
  const since = new Date(Date.now() - LAYOFF_DAYS * 86_400_000)
  const base = countyName.replace(/\s+(county|parish|borough)$/i, '').trim()
  const rows = await prisma.warnNotice.findMany({
    where: { state, source: 'WARN_FILING', dismissedAt: null, county: { contains: base, mode: 'insensitive' }, OR: [{ noticeDate: { gte: since } }, { noticeDate: null, fetchedAt: { gte: since } }] },
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
export async function loadCountyJobs(fips: string, state: string, countyName: string): Promise<OpenJobs | null> {
  const cities = await prisma.$queryRaw<{ city: string }[]>`
    select distinct city from (
      select city from "AmericanJobCenter" where "countyFips" = ${fips}
      union select city from "LocalCollege" where "countyFips" = ${fips}
      union select city from "GeoOrgLead" where "geoAreaId" = ${fips}) x where city is not null`
  const abbrev: Record<string, string> = { 'Spgs': 'Springs', 'Spg': 'Spring', 'Hts': 'Heights', 'Mt': 'Mount', 'Pt': 'Point' }
  const names = new Set<string>()
  for (const c of cities) {
    names.add(c.city)
    const full = c.city.replace(/\b(Spgs|Spg|Hts|Mt|Pt)\b/g, (m) => abbrev[m] ?? m)
    if (full !== c.city) names.add(full)
  }
  const patterns = [...[...names].map((n) => `%${n}, ${state}%`), `%${countyName}%`]
  const base = Prisma.sql`FROM "CompanyJobOpening" WHERE "closedAt" IS NULL AND "lastSeenAt" >= now() - interval '14 days' AND location ILIKE ANY (${patterns}) AND ${state} = ANY(states)`
  const [agg] = await prisma.$queryRaw<{ roles: bigint; employers: bigint; pro: bigint; median: number | null }[]>(Prisma.sql`
    SELECT count(*) roles, count(DISTINCT "companyName") employers, count(*) FILTER (WHERE "seniorityGroup" = ANY(${PRO_LEVELS})) pro,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY "payAnnualMid") FILTER (WHERE "payAnnualMid" BETWEEN 30000 AND 900000) median ${base}`)
  const roles = Number(agg?.roles ?? 0)
  if (!roles) return null
  const fns = await prisma.$queryRaw<{ fn: string; roles: bigint }[]>(Prisma.sql`SELECT "function" fn, count(*) roles ${base} AND "function" IS NOT NULL GROUP BY 1 ORDER BY 2 DESC LIMIT 4`)
  return {
    roles, employers: Number(agg.employers), professional: Number(agg.pro), medianPay: agg.median ? Math.round(agg.median / 1000) * 1000 : null,
    topFunctions: fns.map((f) => ({ fn: f.fn, label: functionLabel(f.fn), roles: Number(f.roles) })),
  }
}
