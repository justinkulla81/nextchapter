import 'server-only'
import { prisma } from '@/lib/prisma'
import { memoTtl, sharedLoad } from '@/lib/db/heavy'
import { normalizeIndustryBucket } from '@/lib/constants/industry-buckets'
import { resolveCompanyIndustry } from '@/lib/market/company-industry'
import { industryFromSicDescription, jobBoardIndustryFor, type LocalPicture } from './layoff-picture'

export interface LayoffIndustry {
  /** The CRM's industry label ("Retail & E-commerce"). */
  label: string
  /** The job board's key for it, or null when the board has no matching category. */
  key: string | null
  source: 'company' | 'filing' | 'sec' | 'model'
}

/**
 * What industry a layoff is in. In order: the company's own industry on file,
 * the NAICS text on a WARN filing, the SEC's industry description, then one
 * cached model call per company name (resolveCompanyIndustry: the answer is kept
 * for good, so a company costs one call ever, about a cent or two). Null when
 * none of them can say.
 */
export async function classifyLayoffIndustry(o: { employer: string; companyIndustry: string | null; naics: string | null; sicDescription: string | null; allowModel?: boolean }): Promise<LayoffIndustry | null> {
  const pick = (label: string | null, source: LayoffIndustry['source']): LayoffIndustry | null =>
    label ? { label, key: jobBoardIndustryFor(label), source } : null
  const direct = pick(o.companyIndustry && normalizeIndustryBucket(o.companyIndustry) === o.companyIndustry ? o.companyIndustry : normalizeIndustryBucket(o.companyIndustry), 'company')
    ?? pick(normalizeIndustryBucket(o.naics), 'filing')
    ?? pick(normalizeIndustryBucket(o.sicDescription) ?? industryFromSicDescription(o.sicDescription), 'sec')
  if (direct || o.allowModel === false) return direct
  try {
    return pick((await resolveCompanyIndustry(o.employer)).bucket, 'model')
  } catch {
    return null
  }
}

const SENIOR_GROUPS = ['EXECUTIVE', 'VP', 'DIRECTOR', 'SENIOR_MANAGER', 'MANAGER']
type StateOpenings = { industry: string | null; n: number; senior: number }[]

/**
 * A state's open roles by industry, with the senior ones counted alongside: one pass over the state's open openings that every figure in
 * the local picture is read from. They were four scans of the same openings per layoff (all open, senior, the layoff's industry, the top
 * industries): ~2.4 s and ~104,000 buffers each, #34 #37 #38 #39 by database time in the 2026-11-17 statement stats. Kept 30 minutes on
 * the instance and six hours in the shared data cache, so the alerts, outreach and views for one state's layoffs share one read.
 */
const stateOpenings = memoTtl(30 * 60_000, (state: string) => state, (state: string) =>
  sharedLoad(`layoff-state-openings:${state}`, 6 * 60 * 60, () =>
    prisma.$queryRaw<StateOpenings>`
      SELECT industry, count(*)::int AS n, count(*) FILTER (WHERE "seniorityGroup" = ANY(${SENIOR_GROUPS}::text[]))::int AS senior
      FROM "CompanyJobOpening"
      WHERE "closedAt" IS NULL AND ${state} = ANY(states)
      GROUP BY industry`))

/** The four local-picture figures from a state's openings by industry (the same numbers the four counts gave). */
export function pictureFigures(rows: StateOpenings, industryKey: string | null) {
  const openInState = rows.reduce((sum, r) => sum + r.n, 0)
  const openSeniorInState = rows.reduce((sum, r) => sum + r.senior, 0)
  const openInIndustry = industryKey ? rows.find((r) => r.industry === industryKey)?.n ?? 0 : null
  const byIndustry = rows.filter((r): r is { industry: string; n: number; senior: number } => r.industry !== null).sort((a, b) => b.n - a.n).slice(0, 8)
  return { openInState, openSeniorInState, openInIndustry, byIndustry }
}

/**
 * The local picture for one layoff: the open white-collar roles on our board in
 * its state and in its own industry, the industries hiring most there, and the
 * geography table's unemployment and recent WARN layoffs for the county (or the
 * state when the county is unknown). Reads only our own tables.
 */
export async function buildLocalPicture(o: { employer: string; employees: number | null; state: string | null; county: string | null; industryKey: string | null }): Promise<LocalPicture> {
  const empty: LocalPicture = {
    employer: o.employer, employees: o.employees, state: o.state, county: o.county, industryKey: o.industryKey,
    openInState: null, openInIndustry: null, openSeniorInState: null, topIndustries: [], unemploymentRate: null, areaLabel: null, layoffs12mo: null, layoffEvents12mo: null,
  }
  if (!o.state) return empty
  const state = o.state
  const county = o.county?.replace(/\s+county$/i, '').trim() || null
  try {
    const [openings, area] = await Promise.all([
      stateOpenings(state),
      (async () => {
        const pick = { name: true, unemploymentRate: true, layoffs12mo: true, layoffEvents12mo: true } as const
        const c = county ? await prisma.geoArea.findFirst({ where: { level: 'COUNTY', state, name: { startsWith: county, mode: 'insensitive' } }, select: pick }) : null
        return c ?? (await prisma.geoArea.findFirst({ where: { level: 'STATE', state }, select: pick }))
      })(),
    ])
    const { openInState, openSeniorInState: openSenior, openInIndustry, byIndustry } = pictureFigures(openings, o.industryKey)
    return {
      ...empty,
      openInState, openSeniorInState: openSenior, openInIndustry,
      topIndustries: byIndustry.filter((r) => r.industry !== o.industryKey).slice(0, 4).map((r) => ({ key: r.industry, openings: r.n })),
      unemploymentRate: area?.unemploymentRate ?? null, areaLabel: area?.name ?? null,
      layoffs12mo: area?.layoffs12mo ?? null, layoffEvents12mo: area?.layoffEvents12mo ?? null,
    }
  } catch (e) {
    console.error('Local picture failed for', o.employer, e)
    return empty
  }
}
