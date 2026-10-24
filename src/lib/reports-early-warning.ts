import 'server-only'
import fs from 'node:fs'
import path from 'node:path'
import { parseCsv } from '@/lib/warn/csv'
import { leadLag, movingAverage3, verdictFor, yearOverYear, youthRatio, type LeadLag, type Series, type Verdict } from '@/lib/reports/early-warning-analysis'

// Reads the files written by scripts/employment-report/nc_early_warning_us.py
// and nc_peer_countries.py at build time, so the page and the downloads agree.

export const US_GROUPS = ['all', 'wc', 'grad', 'wc_early', 'wc_senior'] as const
export type UsGroup = (typeof US_GROUPS)[number]

export const GROUP_LABEL: Record<UsGroup, string> = {
  all: 'All workers',
  wc: 'White-collar',
  grad: 'Graduates 22–27 (bachelor’s+)',
  wc_early: 'White-collar under 35 (early career)',
  wc_senior: 'White-collar 50+ (senior)',
}

const REPORTS = path.join(process.cwd(), 'public', 'reports')
const SNAPSHOTS = path.join(REPORTS, 'early-warning')

/** Edition months that have a data snapshot, oldest first ("2026-09", "2026-10", ...). */
export function earlyWarningEditions(): string[] {
  if (!fs.existsSync(SNAPSHOTS)) return []
  return fs.readdirSync(SNAPSHOTS).filter((d) => /^\d{4}-\d{2}$/.test(d)).sort()
}

/** The newest snapshot month, or null before the first one exists. */
export const latestEarlyWarningEdition = () => earlyWarningEditions().at(-1) ?? null

/** Folder holding an edition's data files; the newest snapshot when no edition is given. */
function dirFor(edition?: string | null): string {
  const e = edition ?? latestEarlyWarningEdition()
  return e ? path.join(SNAPSHOTS, e) : REPORTS
}

export interface UsPoint { ur: number; epop: number; ltuShare: number; medianWeeks: number; nUnemployed: number }
export type UsMonthly = Record<UsGroup, Map<string, UsPoint>>

function num(v: string | undefined): number {
  const n = Number(v)
  return v !== undefined && v !== '' && Number.isFinite(n) ? n : NaN
}

export function readUsEarlyWarning(edition?: string | null): UsMonthly {
  const [header, ...body] = parseCsv(fs.readFileSync(path.join(dirFor(edition), 'us-early-warning.csv'), 'utf8'))
  const col = (n: string) => header.indexOf(n)
  const out = Object.fromEntries(US_GROUPS.map((g) => [g, new Map<string, UsPoint>()])) as UsMonthly
  for (const r of body) {
    const month = r[col('month')]
    if (!/^\d{4}-\d{2}$/.test(month ?? '')) continue
    for (const g of US_GROUPS) {
      const p = { ur: num(r[col(`${g}_ur`)]), epop: num(r[col(`${g}_epop`)]), ltuShare: num(r[col(`${g}_ltu_share`)]),
        medianWeeks: num(r[col(`${g}_median_wks`)]), nUnemployed: num(r[col(`${g}_n_unemployed`)]) }
      if (Number.isFinite(p.ur)) out[g].set(month, p)
    }
  }
  return out
}

export interface PeerRow { month: string; youth: number; total: number }
export interface PeersFile {
  generated: string
  names: Record<string, string>
  sources: Record<string, string>
  unemployment: Record<string, PeerRow[]>
  education: Record<string, { year: string; tertiary: number; upper_secondary: number }[]>
  long_term: Record<string, { year: string; share_12m_plus: number }[]>
  gdp: Record<string, Record<string, number>>
  ai_adoption: Record<string, Record<string, number>>
  us_ai_use: { period_end: string; pct: number }[]
}

export function readPeers(edition?: string | null): PeersFile {
  return JSON.parse(fs.readFileSync(path.join(dirFor(edition), 'early-warning-peers.json'), 'utf8')) as PeersFile
}

const urSeries = (m: Map<string, UsPoint>): Series => new Map([...m].map(([k, v]) => [k, v.ur]))

export interface CanaryResult { candidate: UsGroup; target: UsGroup; leadLag: LeadLag; verdict: Verdict }

/**
 * The 2020 shock and the rebound that followed (year-over-year changes run to
 * February 2022) swamp any lead-lag pattern, so the headline test excludes them.
 */
export const SHOCK_WINDOW: [string, string] = ['2020-03', '2022-02']

/** Year-over-year change of the 3-month-average unemployment rate for each US group. */
export function usYoY(us: UsMonthly): Record<UsGroup, Series> {
  return Object.fromEntries(US_GROUPS.map((g) => [g, yearOverYear(movingAverage3(urSeries(us[g])))])) as Record<UsGroup, Series>
}

export function canaryTests(us: UsMonthly, exclude?: [string, string]): CanaryResult[] {
  const yoy = usYoY(us)
  const out: CanaryResult[] = []
  for (const candidate of ['grad', 'wc_early'] as const)
    for (const target of ['all', 'wc', 'wc_senior'] as const) {
      const ll = leadLag(yoy[candidate], yoy[target], 12, exclude)
      out.push({ candidate, target, leadLag: ll, verdict: verdictFor(ll) })
    }
  return out
}

/** Latest value of a monthly series and the value twelve months earlier. */
export function latestAndYearAgo<T extends { month: string }>(rows: T[]): { latest: T; yearAgo: T | null } {
  const latest = rows[rows.length - 1]
  const [y, m] = latest.month.split('-')
  return { latest, yearAgo: rows.find((r) => r.month === `${Number(y) - 1}-${m}`) ?? null }
}

export interface PeerSummary {
  code: string
  name: string
  month: string
  youth: number
  total: number
  ratio: number
  ratioYearAgo: number | null
  totalChange: number | null
  gradGap: number | null // tertiary minus upper-secondary unemployment, ages 25-34, points
  longTermShare: number | null
  gdpLatest: { year: string; value: number } | null
  aiAdoption: { year: string; value: number } | null
}

export function summarizePeers(p: PeersFile): PeerSummary[] {
  return Object.keys(p.names).filter((c) => p.unemployment[c]?.length).map((code) => {
    const { latest, yearAgo } = latestAndYearAgo(p.unemployment[code])
    const edu = p.education[code]?.at(-1)
    const lt = p.long_term[code]?.at(-1)
    // Latest full calendar year of GDP growth (IMF values for the current year are estimates).
    const gy = Object.keys(p.gdp[code] ?? {}).filter((y) => Number(y) <= Number(latest.month.slice(0, 4)) - 1).sort().at(-1)
    const ai = p.ai_adoption[code]
    const ay = ai ? Object.keys(ai).sort().at(-1) : undefined
    return {
      code, name: p.names[code], month: latest.month, youth: latest.youth, total: latest.total,
      ratio: youthRatio(latest.youth, latest.total),
      ratioYearAgo: yearAgo ? youthRatio(yearAgo.youth, yearAgo.total) : null,
      totalChange: yearAgo ? latest.total - yearAgo.total : null,
      gradGap: edu ? edu.tertiary - edu.upper_secondary : null,
      longTermShare: lt?.share_12m_plus ?? null,
      gdpLatest: gy ? { year: gy, value: p.gdp[code][gy] } : null,
      aiAdoption: code === 'USA' ? usAi(p) : ay && ai ? { year: ay, value: ai[ay] } : null,
    }
  })
}

function usAi(p: PeersFile) {
  const last = p.us_ai_use.at(-1)
  return last ? { year: last.period_end.slice(0, 7), value: last.pct } : null
}

export interface AiLayoffRow { month: string; country: string; cited: number; denied: number; jobs: number }
export interface AiLayoffEvent { month: string; employer: string; country: string; jobs: number; claim: 'cited' | 'denied'; url: string }

function readCsvRows(file: string): { header: string[]; body: string[][] } | null {
  if (!fs.existsSync(file)) return null
  const [header, ...body] = parseCsv(fs.readFileSync(file, 'utf8'))
  return { header, body }
}

/**
 * Announced layoffs whose coverage ties them to AI, by month and by the
 * announcing company's home country. Starts October 2026, when collection
 * began. With no edition this is the running latest; with one, that edition's
 * snapshot (empty for editions before collection began).
 */
export function readAiLayoffs(edition?: string | null): AiLayoffRow[] {
  const t = readCsvRows(path.join(edition ? dirFor(edition) : REPORTS, 'ai-layoffs-monthly.csv'))
  if (!t) return []
  const c = (n: string) => t.header.indexOf(n)
  return t.body
    .filter((r) => /^\d{4}-\d{2}$/.test(r[0] ?? ''))
    .map((r) => ({ month: r[c('month')], country: r[c('country_iso3')], cited: num(r[c('companies_ai_cited')]), denied: num(r[c('companies_ai_denied')]), jobs: num(r[c('jobs_ai_cited')]) }))
}

export function readAiLayoffEvents(edition?: string | null): AiLayoffEvent[] {
  const t = readCsvRows(path.join(edition ? dirFor(edition) : REPORTS, 'ai-layoffs-events.csv'))
  if (!t) return []
  const c = (n: string) => t.header.indexOf(n)
  return t.body
    .filter((r) => /^\d{4}-\d{2}$/.test(r[0] ?? ''))
    .map((r) => ({ month: r[c('month')], employer: r[c('employer')], country: r[c('country_iso3')], jobs: num(r[c('jobs')]), claim: r[c('ai_claim')] as 'cited' | 'denied', url: r[c('source_url')] }))
}
