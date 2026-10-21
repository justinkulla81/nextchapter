import 'server-only'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import type { Prospect } from './config'

export interface Opening { title: string; company: string; location: string | null; level: string | null; pay: number | null; url: string; fn: string | null }
export interface Market {
  openRoles: number; employersHiring: number; medianPay: number | null; payRoles: number; aiRoles: number
  topEmployers: { name: string; roles: number }[]
  topFunctions: { fn: string; roles: number }[]
  sample: Opening[]
}
export interface NoticeSummary { scope: 'region' | 'state'; notices: number; jobs: number; employers: number; days: number; top: { employer: string; employees: number; noticeDate: Date; county: string | null }[] }
export interface Area { name: string; state: string; unemploymentRate: number | null; unemploymentAsOf: string | null; population: number | null; wcUnemployment: number | null }

const PRO_LEVELS = ['MANAGER', 'SENIOR_MANAGER', 'DIRECTOR', 'VP', 'SENIOR_IC', 'MID_LEVEL']
const AI_TITLE = '(\\mai\\M|a\\.i\\.|machine learning|generative|\\mllm\\M|prompt engineer|\\mml\\M)'
const FUNCTION_LABEL: Record<string, string> = {
  marketing: 'Marketing', finance: 'Finance', supply_chain: 'Supply chain', sales: 'Sales', operations: 'Operations', hr: 'People and HR', legal: 'Legal',
  engineering: 'Engineering', it: 'Technology', product: 'Product', data: 'Data', design: 'Design', customer_success: 'Customer success', healthcare: 'Healthcare',
}
export const functionLabel = (fn: string) => FUNCTION_LABEL[fn] ?? fn.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())

/** The open white-collar roles our crawler sees in a place, with who is hiring, in what, and a few real examples. Cached by the page. */
export async function getMarket(p: Prospect): Promise<Market> {
  const places = Prisma.join(p.places)
  const fnClause = p.functions?.length ? Prisma.sql`AND "function" = ANY(${p.functions})` : Prisma.empty
  const base = Prisma.sql`FROM "CompanyJobOpening" WHERE "closedAt" IS NULL AND "lastSeenAt" >= now() - interval '14 days' AND location ILIKE ANY (ARRAY[${places}]) AND ${p.state} = ANY(states) ${fnClause}`
  const [agg] = await prisma.$queryRaw<{ roles: bigint; employers: bigint; median: number | null; pay_roles: bigint; ai: bigint }[]>(Prisma.sql`
    SELECT count(*) roles, count(DISTINCT "companyName") employers,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY "payAnnualMid") FILTER (WHERE "payAnnualMid" BETWEEN 30000 AND 900000) median,
      count(*) FILTER (WHERE "payAnnualMid" BETWEEN 30000 AND 900000) pay_roles,
      count(*) FILTER (WHERE title ~* ${AI_TITLE}) ai
    ${base}`)
  const employers = await prisma.$queryRaw<{ name: string; roles: bigint }[]>(Prisma.sql`SELECT "companyName" name, count(*) roles ${base} GROUP BY 1 ORDER BY 2 DESC LIMIT 8`)
  const fns = await prisma.$queryRaw<{ fn: string; roles: bigint }[]>(Prisma.sql`SELECT "function" fn, count(*) roles ${base} AND "function" IS NOT NULL GROUP BY 1 ORDER BY 2 DESC LIMIT 8`)
  // One real, recent, pay-posted opening per function, at a professional level, so the examples span the market.
  const sample = await prisma.$queryRaw<{ title: string; company: string; location: string | null; level: string | null; pay: number | null; url: string; fn: string | null }[]>(Prisma.sql`
    SELECT * FROM (
      SELECT DISTINCT ON (coalesce("function", 'other')) title, "companyName" company, location, "seniorityGroup" level, "payAnnualMid" pay, url, "function" fn, "postedAt"
      ${base} AND "seniorityGroup" = ANY(${PRO_LEVELS}) AND "payAnnualMid" BETWEEN 40000 AND 600000
      ORDER BY coalesce("function", 'other'), "postedAt" DESC NULLS LAST
    ) s ORDER BY pay DESC NULLS LAST LIMIT 8`)
  return {
    openRoles: Number(agg?.roles ?? 0), employersHiring: Number(agg?.employers ?? 0), medianPay: agg?.median ? Math.round(agg.median / 1000) * 1000 : null,
    payRoles: Number(agg?.pay_roles ?? 0), aiRoles: Number(agg?.ai ?? 0),
    topEmployers: employers.map((e) => ({ name: e.name, roles: Number(e.roles) })),
    topFunctions: fns.map((f) => ({ fn: f.fn, roles: Number(f.roles) })),
    sample,
  }
}

/** Layoff notices (state WARN filings) in the place over the last six months, the biggest first. */
export async function getNotices(p: Prospect, days = 180): Promise<NoticeSummary> {
  const rows = await prisma.warnNotice.findMany({
    where: { state: p.state, source: 'WARN_FILING', dismissedAt: null, noticeDate: { gte: new Date(Date.now() - days * 86_400_000) }, employees: { not: null } },
    select: { employer: true, employees: true, noticeDate: true, county: true, address: true, normalizedEmployer: true },
    orderBy: { employees: 'desc' },
  })
  const base = (c: string | null) => (c ?? '').replace(/\s+(county|parish)$/i, '').trim().toLowerCase()
  const words = p.cityWords ?? []
  let mine = p.counties.length ? rows.filter((r) => p.counties.includes(base(r.county)) || (!r.county && words.some((w) => (r.address ?? '').toLowerCase().includes(w)))) : rows
  // A region with no notices of its own shows the state, and says so.
  let scope: 'region' | 'state' = p.counties.length ? 'region' : 'state'
  if (!mine.length) { mine = rows; scope = 'state' }
  const seen = new Set<string>()
  const top = mine.filter((r) => { if (seen.has(r.normalizedEmployer)) return false; seen.add(r.normalizedEmployer); return true }).slice(0, 6)
    .map((r) => ({ employer: r.employer.replace(/\*[^*]*\*/g, '').replace(/&amp;/g, '&').replace(/(?<!&)\s+(inc|llc|corp|corporation|co|company|ltd)\.?\s*$/i, '').replace(/,\s*$/, '').trim(), employees: r.employees!, noticeDate: r.noticeDate ?? new Date(), county: r.county }))
  return { scope, notices: mine.length, jobs: mine.reduce((n, r) => n + (r.employees ?? 0), 0), employers: new Set(mine.map((r) => r.normalizedEmployer)).size, days, top }
}

export async function getArea(areaId: string): Promise<Area | null> {
  const a = await prisma.geoArea.findUnique({ where: { id: areaId }, select: { name: true, state: true, unemploymentRate: true, unemploymentAsOf: true, population: true, wcUnemploymentEst: true } })
  return a ? { name: a.name, state: a.state, unemploymentRate: a.unemploymentRate, unemploymentAsOf: a.unemploymentAsOf, population: a.population, wcUnemployment: a.wcUnemploymentEst } : null
}

export async function getCollege(match: string) {
  return prisma.collegeProfile.findFirst({ where: { name: { contains: match, mode: 'insensitive' } }, select: { name: true, city: true, state: true, enrollment: true, alumniEstimate: true, topMajors: true, hasRetraining: true, hasExecEd: true, website: true } })
}
