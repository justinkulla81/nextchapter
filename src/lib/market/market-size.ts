// Market size for a member's target: how many jobs are open for their kind of work (sub-
// function) at their level, in their industry and place, whether that market is growing or
// shrinking against the rest of the board, and which nearby targets have more room. Pure
// (no I/O), unit-tested in src/test/market-size.test.ts. The nightly counts come from
// market-size-stats.ts (MarketTargetStat); market-size-server.ts reads them per member.
//
// Trend. The crawler keeps adding sources, so raw "new jobs" rise everywhere; a target's
// trend is read against the whole board's: its share of new postings in the last 14 days
// versus its share in the 28 days before. Closures (removed / expired listings) count the
// same way.

import { classifyLocation } from '@/lib/jobs/us-location'
import { statesFromLocation } from '@/lib/pay/market-pay'
import { stageOfRung } from '@/lib/jobs/career-stage'

export const RECENT_DAYS = 14
export const PRIOR_DAYS = 28

/** Too many open jobs to work through: suggest narrowing (industry, company size). Tune here. */
export const MARKET_TOO_MANY = 400
/** Too few to rely on: suggest the nearby targets. Tune here. */
export const MARKET_TOO_FEW = 30
/** Growth against the board below this (−25%) with enough volume reads as shrinking. */
export const SHRINKING_BELOW = -0.25
/** Fewer new postings than this in both windows says nothing about a trend. */
export const TREND_MIN_SAMPLE = 12

export interface StatRow {
  fn: string
  subFunction: string
  band: string
  industry: string
  geo: string
  openNow: number
  newRecent: number
  newPrior: number
  closedRecent: number
  closedPrior: number
}

export interface StatInput {
  title: string
  fn: string | null
  subFunction: string | null
  level: string | null
  industryBucket: string | null
  location: string | null
  locationState: string | null
  workArrangement: string | null
  postedAt: Date | null
  createdAt: Date
  archivedAt: Date | null
  closeReason: string | null
}

/** Close reasons that mean the job really went away (not a collapsed duplicate or our own filter). */
const REAL_CLOSE = new Set(['removed', 'aged_out', 'expired'])

export function geoOf(r: Pick<StatInput, 'location' | 'locationState' | 'workArrangement'>): string {
  if (r.workArrangement === 'remote') return 'remote'
  if (r.locationState) return r.locationState
  const { states, isRemote } = statesFromLocation(r.location)
  if (isRemote) return 'remote'
  if (states.length > 0) return states[0]
  return classifyLocation(r.location) === 'us' ? 'US' : ''
}

/** Aggregates board rows (live, plus archived in the last RECENT_DAYS + PRIOR_DAYS) into stat rows, with a '*' total. */
export function aggregateStats(rows: StatInput[], now: Date): StatRow[] {
  const day = 86_400_000
  const recentFrom = now.getTime() - RECENT_DAYS * day
  const priorFrom = recentFrom - PRIOR_DAYS * day
  const out = new Map<string, StatRow>()
  const total: StatRow = { fn: '*', subFunction: '', band: '', industry: '', geo: '', openNow: 0, newRecent: 0, newPrior: 0, closedRecent: 0, closedPrior: 0 }
  for (const r of rows) {
    const fn = r.fn ?? ''
    const key = [fn, r.subFunction ?? '', stageOfRung(r.level) ?? '', r.industryBucket ?? '', geoOf(r)]
    const k = key.join('|')
    let s = out.get(k)
    if (!s) out.set(k, (s = { fn: key[0], subFunction: key[1], band: key[2], industry: key[3], geo: key[4], openNow: 0, newRecent: 0, newPrior: 0, closedRecent: 0, closedPrior: 0 }))
    const opened = (r.postedAt ?? r.createdAt).getTime()
    for (const t of [s, total]) {
      if (!r.archivedAt) t.openNow++
      if (opened >= recentFrom) t.newRecent++
      else if (opened >= priorFrom) t.newPrior++
      if (r.archivedAt && REAL_CLOSE.has(r.closeReason ?? '')) {
        const c = r.archivedAt.getTime()
        if (c >= recentFrom) t.closedRecent++
        else if (c >= priorFrom) t.closedPrior++
      }
    }
  }
  return [...out.values(), total]
}

export type Counts = Pick<StatRow, 'openNow' | 'newRecent' | 'newPrior' | 'closedRecent' | 'closedPrior'>
export const ZERO: Counts = { openNow: 0, newRecent: 0, newPrior: 0, closedRecent: 0, closedPrior: 0 }

export function sumCounts(rows: Iterable<Counts>): Counts {
  const t = { ...ZERO }
  for (const r of rows) {
    t.openNow += r.openNow
    t.newRecent += r.newRecent
    t.newPrior += r.newPrior
    t.closedRecent += r.closedRecent
    t.closedPrior += r.closedPrior
  }
  return t
}

/**
 * Growth against the board, −1..+∞: the target's share of new postings in the recent window
 * over its share in the prior one, minus 1, with closures netted out the same way. Null when
 * the sample is too small to say.
 */
export function relativeGrowth(target: Counts, board: Counts): number | null {
  if (target.newRecent + target.newPrior < TREND_MIN_SAMPLE || board.newRecent === 0 || board.newPrior === 0) return null
  // Net new per day in each window, as a share of the board's net new per day.
  const net = (n: number, c: number) => Math.max(n - c, 0) + 0.5
  const recent = net(target.newRecent, target.closedRecent) / RECENT_DAYS / (net(board.newRecent, board.closedRecent) / RECENT_DAYS)
  const prior = net(target.newPrior, target.closedPrior) / PRIOR_DAYS / (net(board.newPrior, board.closedPrior) / PRIOR_DAYS)
  return prior > 0 ? recent / prior - 1 : null
}

export type MarketPrompt = 'too_many' | 'too_few' | 'shrinking' | 'healthy'

/**
 * Fewer than this reads as too few for the member's level. There are few roles at the top of any
 * function, so a VP or executive market is not "narrow" at 30 the way a mid-level one is.
 */
export function tooFewFor(stages: readonly string[]): number {
  if (stages.includes('EXECUTIVE') || stages.includes('VP')) return 8
  if (stages.includes('DIRECTOR')) return 15
  return MARKET_TOO_FEW
}

export function marketPrompt(openNow: number, growth: number | null, tooFew: number = MARKET_TOO_FEW): MarketPrompt {
  if (openNow < tooFew) return 'too_few'
  if (growth !== null && growth <= SHRINKING_BELOW) return 'shrinking'
  if (openNow > MARKET_TOO_MANY) return 'too_many'
  return 'healthy'
}

export interface MarketArea {
  /** What changes from the target: 'industry' (same work, other industry), 'sub_function' (related work), 'place', 'level'. */
  kind: 'industry' | 'sub_function' | 'place' | 'level'
  label: string
  openNow: number
  growth: number | null
  /** Board link for the area, when there is one. */
  href?: string
}

/** The nearby areas worth naming: the most open jobs, growing ones first among close counts. At most n. */
export function bestAreas(areas: MarketArea[], n = 3, minOpen = 10): MarketArea[] {
  const score = (a: MarketArea) => a.openNow * (1 + Math.max(-0.5, Math.min(1, a.growth ?? 0)))
  return areas.filter((a) => a.openNow >= minOpen).sort((a, b) => score(b) - score(a)).slice(0, n)
}

export function growthPhrase(growth: number | null): string | null {
  if (growth === null) return null
  const pct = Math.round(Math.abs(growth) * 100)
  if (pct < 10) return 'steady against the rest of the market'
  return growth > 0 ? `growing ${pct}% faster than the rest of the market` : `shrinking — ${pct}% slower than the rest of the market`
}
