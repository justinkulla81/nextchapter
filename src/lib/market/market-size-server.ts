import 'server-only'
import { prisma } from '@/lib/prisma'
import { memberStageWindow, stagesInWindow, type CareerStage, type StageMember } from '@/lib/jobs/career-stage'
import { memberIndustryBuckets } from '@/lib/profile/industry-reading'
import { memberGeo } from '@/lib/jobs/relevance'
import { SUB_FUNCTIONS, subFunctionFor, subFunctionLabel } from '@/lib/jobs/sub-functions'
import {
  bestAreas,
  marketPrompt,
  relativeGrowth,
  sumCounts,
  type Counts,
  type MarketArea,
  type MarketPrompt,
  type StatRow,
} from '@/lib/market/market-size'

// Reads MarketTargetStat for one member's target (market-size.ts). The rows for a function
// are held in memory for 30 minutes per server instance; they change once a night.

const TTL_MS = 30 * 60_000
const cache = new Map<string, { at: number; rows: Promise<StatRow[]> }>()

function rowsFor(fn: string): Promise<StatRow[]> {
  const hit = cache.get(fn)
  if (hit && Date.now() - hit.at < TTL_MS) return hit.rows
  const rows = prisma.marketTargetStat
    .findMany({ where: { fn }, select: { fn: true, subFunction: true, band: true, industry: true, geo: true, openNow: true, newRecent: true, newPrior: true, closedRecent: true, closedPrior: true } })
    .catch((error) => {
      console.error('Market size stats unavailable:', error)
      cache.delete(fn)
      return [] as StatRow[]
    })
  cache.set(fn, { at: Date.now(), rows })
  return rows
}

export type MarketMember = StageMember & {
  primaryFunction?: string | null
  resumeLatestJobTitle?: string | null
  subFunction?: string | null
  industryContext?: string | null
  secondaryIndustryContext?: string | null
  targetIndustries?: string[] | null
  industryBuckets?: string[] | null
  currentState?: string | null
  remotePreference?: string | null
  openToRelocation?: boolean | null
  relocationNotes?: string | null
}

export interface MarketTarget {
  fn: string
  subFunction: string | null
  stages: CareerStage[]
  /** Their industries (industry-reading.ts); null = any. */
  industries: string[] | null
  /** null = anywhere. */
  geos: string[] | null
  label: string
}

export interface MarketSizeView {
  target: MarketTarget
  counts: Counts
  growth: number | null
  prompt: MarketPrompt
  /** Nearby targets with room: other industries, related sub-functions, a wider place. */
  areas: MarketArea[]
  /** For too many: the biggest industries inside the target. */
  slices: { label: string; openNow: number }[]
  /** Jobs relevant to them on every criterion (relevance.ts), the strong fits among them, and the market tier that applied. */
  relevant: { count: number; strong?: number; tier: string | null } | null
}

const STAGE_WORDS: Record<CareerStage, string> = {
  ENTRY: 'entry',
  EARLY: 'early-career',
  MID: 'mid-level',
  SENIOR_IC_MGR: 'manager',
  SENIOR_MANAGER: 'senior manager',
  DIRECTOR: 'director',
  VP: 'VP',
  EXECUTIVE: 'executive',
}

export function memberMarketTarget(m: MarketMember): MarketTarget | null {
  const fn = m.primaryFunction?.trim()
  if (!fn || /^(general|other)$/i.test(fn)) return null
  const subFunction = m.subFunction ?? subFunctionFor({ title: m.resumeLatestJobTitle, fn })
  const stages = stagesInWindow(memberStageWindow(m))
  const read = memberIndustryBuckets(m)
  const industries = read.length > 0 ? read : null
  const geo = memberGeo({ anchor: null, currentState: m.currentState, remotePreference: m.remotePreference, openToRelocation: m.openToRelocation, relocationNotes: m.relocationNotes })
  const geoList = [...(geo.homeState ? [geo.homeState] : []), ...geo.relocation, ...(geo.acceptsRemote ? ['remote'] : [])]
  const geos = geo.unknown || geoList.length === 0 ? null : [...new Set(geoList)]
  const what = subFunctionLabel(subFunction) ?? fn
  const level = stages.length > 0 ? `${STAGE_WORDS[stages[0]]}–${STAGE_WORDS[stages[stages.length - 1]]}` : null
  const where = geos ? geos.map((g) => (g === 'remote' ? 'remote' : g)).join(' or ') : null
  const label = [what, level && `${level} level`, industries && `in ${industries.join(' or ')}`, where && `· ${where}`].filter(Boolean).join(' ')
  return { fn, subFunction, stages, industries, geos, label }
}

type Filter = { subFunction?: string | null; industries?: string[] | null; geos?: string[] | null; stages: CareerStage[] }
function sum(rows: StatRow[], f: Filter): Counts {
  return sumCounts(
    rows.filter(
      (r) =>
        (f.subFunction == null || r.subFunction === f.subFunction) &&
        (f.industries == null || f.industries.includes(r.industry)) &&
        (f.geos == null || f.geos.includes(r.geo)) &&
        (f.stages.length === 0 || f.stages.includes(r.band as CareerStage))
    )
  )
}

const boardHref = (q?: string) => `/dashboard/find-my-job?breadth=wide${q ? `&q=${encodeURIComponent(q)}` : ''}#job-recommendations`

/** The market for the member's target, with the prompt to show and the nearby areas. Null without a function or stats. */
export async function loadMarketSize(m: MarketMember, relevant?: { count: number; strong?: number; tier: string | null }): Promise<MarketSizeView | null> {
  const target = memberMarketTarget(m)
  if (!target) return null
  const [rows, totals] = await Promise.all([rowsFor(target.fn), rowsFor('*')])
  if (rows.length === 0 || totals.length === 0) return null
  const board = sumCounts(totals)
  const base: Filter = { subFunction: target.subFunction, industries: target.industries, geos: target.geos, stages: target.stages }
  const counts = sum(rows, base)
  const growth = relativeGrowth(counts, board)
  const what = subFunctionLabel(target.subFunction) ?? target.fn

  const areas: MarketArea[] = []
  const add = (kind: MarketArea['kind'], label: string, f: Filter, q?: string) => {
    const c = sum(rows, f)
    areas.push({ kind, label, openNow: c.openNow, growth: relativeGrowth(c, board), href: boardHref(q) })
  }
  // Same work, other industries (orthogonal moves), in the same place.
  const industries = [...new Set(rows.map((r) => r.industry).filter((i) => i && !(target.industries ?? []).includes(i)))]
  for (const industry of industries) add('industry', `${what} in ${industry}`, { ...base, industries: [industry] }, industry)
  // The same work with one limit lifted at a time: any industry, or anywhere in the US or remote.
  if (target.industries) add('industry', `${what}, any industry`, { ...base, industries: null })
  if (target.geos) add('place', `${what}${target.industries ? ` in ${target.industries.join(' or ')}` : ''}, anywhere in the US or remote`, { ...base, geos: null })
  // Related work in the same function: the sub-function's hand-listed neighbours (all of them when it has none), any industry.
  const own = SUB_FUNCTIONS.find((s) => s.key === target.subFunction)
  const neighbours = own ? own.adjacent : SUB_FUNCTIONS.filter((s) => s.fn.toLowerCase() === target.fn.toLowerCase()).map((s) => s.key)
  for (const sub of neighbours) add('sub_function', subFunctionLabel(sub) ?? sub, { ...base, subFunction: sub })
  // For "too many": the biggest slices inside the target — by industry, or (industry set) by kind of work.
  const sliceBy = (values: (string | null)[], f: (v: string) => Filter, label: (v: string) => string) =>
    [...new Set(values.filter((v): v is string => !!v))]
      .map((v) => ({ label: label(v), openNow: sum(rows, f(v)).openNow }))
      .filter((x) => x.openNow > 0)
      .sort((x, y) => y.openNow - x.openNow)
      .slice(0, 3)
  const slices = !target.industries
    ? sliceBy(industries, (industry) => ({ ...base, industries: [industry] }), (v) => v)
    : !target.subFunction
      ? sliceBy(rows.map((r) => r.subFunction), (subFunction) => ({ ...base, subFunction }), (v) => subFunctionLabel(v) ?? v)
      : []
  // The member's own count is the strict relevant one (relevance.ts) when the caller has it.
  const prompt = marketPrompt(relevant?.count ?? counts.openNow, growth)
  return { target, counts, growth, prompt, areas: bestAreas(areas, 3), slices, relevant: relevant ?? null }
}
