import 'server-only'
import { prisma } from '@/lib/prisma'
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
    const [openInState, openSenior, openInIndustry, byIndustry, area] = await Promise.all([
      prisma.companyJobOpening.count({ where: { closedAt: null, states: { has: state } } }),
      prisma.companyJobOpening.count({ where: { closedAt: null, states: { has: state }, seniorityGroup: { in: ['EXECUTIVE', 'VP', 'DIRECTOR', 'SENIOR_MANAGER', 'MANAGER'] } } }),
      o.industryKey ? prisma.companyJobOpening.count({ where: { closedAt: null, states: { has: state }, industry: o.industryKey } }) : Promise.resolve(null),
      prisma.$queryRaw<{ industry: string; n: number }[]>`
        SELECT industry, count(*)::int AS n FROM "CompanyJobOpening"
        WHERE "closedAt" IS NULL AND ${state} = ANY(states) AND industry IS NOT NULL
        GROUP BY industry ORDER BY n DESC LIMIT 8`,
      (async () => {
        const pick = { name: true, unemploymentRate: true, layoffs12mo: true, layoffEvents12mo: true } as const
        const c = county ? await prisma.geoArea.findFirst({ where: { level: 'COUNTY', state, name: { startsWith: county, mode: 'insensitive' } }, select: pick }) : null
        return c ?? (await prisma.geoArea.findFirst({ where: { level: 'STATE', state }, select: pick }))
      })(),
    ])
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
