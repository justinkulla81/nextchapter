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
export interface NoticeSummary { scope: 'region' | 'state'; notices: number; jobs: number; employers: number; days: number; top: { employer: string; employees: number; noticeDate: Date; dateKind: 'filed' | 'effective' | 'seen'; county: string | null }[] }
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
  return getNoticesFor({ state: p.state, counties: p.counties, cityWords: p.cityWords }, days)
}

/**
 * The same summary for any place: a state, optionally narrowed to counties (lower case, no "County") and city words.
 * No counties means the whole state. A place with no notices of its own shows the state, and says so (scope 'state').
 */
export async function getNoticesFor(p: { state: string; counties: string[]; cityWords?: string[] }, days = 180): Promise<NoticeSummary> {
  const since = new Date(Date.now() - days * 86_400_000)
  const rows = await prisma.warnNotice.findMany({
    // Some states (Pennsylvania) give no filing date, so the day we fetched the notice stands in for it.
    where: { state: p.state, source: 'WARN_FILING', dismissedAt: null, employees: { not: null }, OR: [{ noticeDate: { gte: since } }, { noticeDate: null, fetchedAt: { gte: since } }] },
    select: { employer: true, employees: true, noticeDate: true, fetchedAt: true, effectiveDate: true, county: true, address: true, normalizedEmployer: true },
    orderBy: { employees: 'desc' },
  })
  const base = (c: string | null) => (c ?? '').replace(/\s+(county|parish)$/i, '').trim().toLowerCase()
  const words = p.cityWords ?? []
  // Some states give the county in the address column (Pennsylvania), so both fields are read.
  const inRegion = (r: (typeof rows)[number]) => p.counties.includes(base(r.county)) || p.counties.includes(base(r.address)) || (!r.county && words.some((w) => (r.address ?? '').toLowerCase().includes(w)))
  let mine = p.counties.length ? rows.filter(inRegion) : rows
  // A region with no notices of its own shows the state, and says so.
  let scope: 'region' | 'state' = p.counties.length ? 'region' : 'state'
  if (!mine.length) { mine = rows; scope = 'state' }
  const seen = new Set<string>()
  const top = mine.filter((r) => { if (seen.has(r.normalizedEmployer)) return false; seen.add(r.normalizedEmployer); return true }).slice(0, 6)
    .map((r) => ({
      employer: r.employer.replace(/\*[^*]*\*/g, '').replace(/&amp;/g, '&').replace(/(?<!&)\s+(inc|llc|corp|corporation|co|company|ltd)\.?\s*$/i, '').replace(/,\s*$/, '').trim(),
      employees: r.employees!, noticeDate: r.noticeDate ?? r.effectiveDate ?? r.fetchedAt, dateKind: (r.noticeDate ? 'filed' : r.effectiveDate ? 'effective' : 'seen') as 'filed' | 'effective' | 'seen', county: r.county ?? r.address,
    }))
  return { scope, notices: mine.length, jobs: mine.reduce((n, r) => n + (r.employees ?? 0), 0), employers: new Set(mine.map((r) => r.normalizedEmployer)).size, days, top }
}

export async function getArea(areaId: string): Promise<Area | null> {
  const a = await prisma.geoArea.findUnique({ where: { id: areaId }, select: { name: true, state: true, unemploymentRate: true, unemploymentAsOf: true, population: true, wcUnemploymentEst: true } })
  return a ? { name: a.name, state: a.state, unemploymentRate: a.unemploymentRate, unemploymentAsOf: a.unemploymentAsOf, population: a.population, wcUnemployment: a.wcUnemploymentEst } : null
}

export async function getCollege(match: string) {
  return prisma.collegeProfile.findFirst({ where: { name: { contains: match, mode: 'insensitive' } }, select: { name: true, city: true, state: true, enrollment: true, alumniEstimate: true, topMajors: true, hasRetraining: true, hasExecEd: true, website: true } })
}

// ── Skills and readiness ─────────────────────────────────────────────────────

/** Skill signals read from job titles. A signal is a family of skills employers name in the title of the role. */
export const SIGNALS = [
  { key: 'ai', label: 'AI and machine learning', rx: '(\\mai\\M|a\\.i\\.|machine learning|generative|\\mllm\\M|prompt engineer|\\mml\\M)' },
  { key: 'data', label: 'Data and analytics', rx: '(\\mdata\\M|analytics|analyst|insights|business intelligence|\\mbi\\M)' },
  { key: 'digital', label: 'Digital and growth', rx: '(digital|growth|e-?commerce|performance marketing|\\mseo\\M|\\mcrm\\M|automation|martech)' },
  { key: 'tech', label: 'Cloud, security and platforms', rx: '(cloud|cyber|security|software|platform|devops|systems)' },
  { key: 'strategy', label: 'Strategy and transformation', rx: '(strategy|transformation|continuous improvement|\\mlean\\M|process improvement|program management)' },
] as const
export type SignalKey = (typeof SIGNALS)[number]['key']

export interface SignalStat { key: SignalKey; label: string; roles: number; medianPay: number | null; premiumPct: number | null }
export interface FieldReadiness { fn: string; roles: number; medianPay: number | null; signals: SignalStat[]; aiShare: number; examples: Record<string, Opening[]> }

/** For each of the place's biggest fields: how many roles, what they pay, and which skill signals appear in the roles that pay more. */
export async function getReadiness(p: Prospect): Promise<FieldReadiness[]> {
  const places = Prisma.join(p.places)
  const fnClause = p.functions?.length ? Prisma.sql`AND "function" = ANY(${p.functions})` : Prisma.empty
  const base = Prisma.sql`FROM "CompanyJobOpening" WHERE "closedAt" IS NULL AND "lastSeenAt" >= now() - interval '14 days' AND location ILIKE ANY (ARRAY[${places}]) AND ${p.state} = ANY(states) AND "function" IS NOT NULL AND "function" NOT IN ('Executive Leadership', 'Administration') ${fnClause}`
  const payOk = Prisma.sql`"payAnnualMid" BETWEEN 30000 AND 900000`
  const sigCols = SIGNALS.map((s) => Prisma.sql`count(*) FILTER (WHERE title ~* ${s.rx}) AS "${Prisma.raw(s.key)}_n", percentile_cont(0.5) WITHIN GROUP (ORDER BY "payAnnualMid") FILTER (WHERE title ~* ${s.rx} AND ${payOk}) AS "${Prisma.raw(s.key)}_med"`)
  const rows = await prisma.$queryRaw<Record<string, unknown>[]>(Prisma.sql`
    SELECT "function" fn, count(*) roles, percentile_cont(0.5) WITHIN GROUP (ORDER BY "payAnnualMid") FILTER (WHERE ${payOk}) med, ${Prisma.join(sigCols)}
    ${base} GROUP BY 1 HAVING count(*) >= 20 ORDER BY 2 DESC LIMIT 6`)
  if (!rows.length) return []
  const fns = rows.map((r) => String(r.fn))
  const ex = await prisma.$queryRaw<(Opening & { sigs: string[] })[]>(Prisma.sql`
    SELECT title, "companyName" company, location, "seniorityGroup" level, "payAnnualMid" pay, url, "function" fn,
      array_remove(ARRAY[${Prisma.join(SIGNALS.map((s) => Prisma.sql`CASE WHEN title ~* ${s.rx} THEN ${s.key} END`))}], NULL) sigs
    ${base} AND "function" = ANY(${fns}) AND ${payOk} AND "seniorityGroup" = ANY(${PRO_LEVELS})
    ORDER BY "postedAt" DESC NULLS LAST LIMIT 1500`)
  return rows.map((r) => {
    const fn = String(r.fn), roles = Number(r.roles), med = r.med != null ? Number(r.med) : null
    const signals: SignalStat[] = SIGNALS.map((s) => {
      const n = Number(r[`${s.key}_n`] ?? 0), m = r[`${s.key}_med`] != null ? Number(r[`${s.key}_med`]) : null
      return { key: s.key, label: s.label, roles: n, medianPay: m, premiumPct: med && m && n >= 5 ? Math.round((100 * (m - med)) / med) : null }
    }).filter((s) => s.roles >= 5).sort((a, b) => (b.premiumPct ?? -99) - (a.premiumPct ?? -99))
    const examples: Record<string, Opening[]> = {}
    for (const s of signals.slice(0, 3)) examples[s.key] = ex.filter((e) => e.fn === fn && e.sigs.includes(s.key)).slice(0, 3).map((e) => ({ title: e.title, company: e.company, location: e.location, level: e.level, pay: e.pay, url: e.url, fn: e.fn }))
    return { fn, roles, medianPay: med ? Math.round(med / 1000) * 1000 : null, signals: signals.slice(0, 3), aiShare: roles ? Number(r.ai_n ?? 0) / roles : 0, examples }
  })
}

// ── The local picture for the hub: workforce board, job centers, colleges, state contact ──────────

export interface HubData {
  boards: { id: string; name: string; website: string | null; director: string | null; directorTitle: string | null; phone: string | null }[]
  centers: { name: string; city: string | null; phone: string | null; email: string | null; url: string | null; type: string | null }[]
  colleges: { name: string; level: string | null; enrollment: number | null; website: string | null; retraining: boolean; execEd: boolean }[]
}

export async function getHub(p: Prospect): Promise<HubData> {
  const boardRows = await prisma.workforceBoard.findMany({ where: { state: p.state, counties: { hasSome: p.boardCounties } }, select: { id: true, name: true, website: true, directorName: true, directorTitle: true, directorPhone: true }, take: 2 })
  const centerRows = boardRows.length
    ? await prisma.americanJobCenter.findMany({ where: { workforceBoardId: { in: boardRows.map((b) => b.id) } }, select: { name: true, city: true, phone: true, businessEmail: true, generalEmail: true, detailsUrl: true, centerType: true }, orderBy: [{ centerType: 'asc' }, { name: 'asc' }], take: 6 })
    : []
  const collegeRows = await prisma.collegeProfile.findMany({ where: { countyFips: { in: p.collegeAreaIds } }, select: { name: true, level: true, enrollment: true, website: true, hasRetraining: true, hasExecEd: true }, orderBy: { enrollment: 'desc' }, take: 14 })
  return {
    boards: boardRows.map((b) => ({ id: b.id, name: b.name, website: b.website, director: b.directorName, directorTitle: b.directorTitle, phone: b.directorPhone })),
    centers: centerRows.map((c) => ({ name: c.name, city: c.city, phone: c.phone, email: c.businessEmail || c.generalEmail || null, url: c.detailsUrl, type: c.centerType })),
    colleges: collegeRows.filter((c) => !/theolog|seminar|nursing|beauty|cosmet|barber|divinity/i.test(c.name)).slice(0, 8).map((c) => ({ name: c.name, level: c.level, enrollment: c.enrollment, website: c.website, retraining: !!c.hasRetraining, execEd: !!c.hasExecEd })),
  }
}
