// Rules-based observation generator — Phase 2 Master Script, Part B,
// Prompt 7: auto-generated narrative observations at the top of each admin
// view. "Rules-based first; add an LLM pass over the computed stats only
// after the rules are in place — the model summarizes numbers, never
// invents them." This module is that rules pass; no LLM call anywhere in
// it.
//
// Structural pattern reused from src/lib/scoring/named-reasons.ts's
// computeNamedReasons: small, stable-id'd, templated-text-per-condition
// entries built from plain data, not prose composed ad hoc at each call
// site. Same shape idea, different domain (admin stats instead of
// candidate-facing scoring reasons).
//
// Implements 4 of this build's 4 named trigger rules (Part B Prompt 7 lists
// a 5th — "any segment where median time-to-first-interview exceeds 1.5x
// the population median" — which is Part D/search-outcomes shaped data no
// phase has computed yet; out of scope for this pass, left for whichever
// phase builds the search-outcomes aggregate):
//   1. Issue prevalence shifting more than 10 points week over week
//   2. A segment deviating more than 1.5σ from the overall rate on a major
//      metric (via stats.ts's findSegmentDeviations)
//   3. A funnel step whose conversion dropped more than 5 points
//   4. An issue whose fix rate is below 25% after 100+ surfacings
//
// No real caller exists yet (phases C/D build the pages that will compute
// these aggregates) — see src/test/admin-observations.test.ts for a
// synthetic-fixture proof this produces sane output.

import { findSegmentDeviations, SIGNIFICANT_DEVIATION_THRESHOLD } from '@/lib/admin/stats'
import { MIN_CELL_SIZE } from '@/lib/admin/cell-suppression'

// ── Filter linking ──────────────────────────────────────────────────────
// "Each observation links to the filtered view that produced it" (Prompt
// 7). Shape modeled on this repo's existing URL-driven admin filter
// convention (src/app/support/admin/(portal)/pacing/page.tsx +
// AdminFilterBar: a `basePath` plus a flat Record<string,string> of query
// params the page's own `searchParams` reads back out) rather than
// inventing a new filter-state format — phases C/D's /admin/issues and
// /admin/population pages don't exist yet, but whatever query-param scheme
// they use will follow that same existing pattern, so this is a reasonable,
// low-risk bet rather than a guess pulled from nothing.
export interface LinkedFilter {
  /** e.g. "/support/admin/issues" — matches this repo's actual admin route prefix, not the spec doc's shorthand "/admin/issues". */
  basePath: string
  /** Query params to apply at `basePath`, e.g. { issueCode: 'no_target_line' } or { segmentType: 'function', segmentValue: 'Engineering' }. */
  params: Record<string, string>
}

export interface Observation {
  /** Stable per-condition-instance id (e.g. `prevalence_shift:no_target_line`) — same "referenceable, not just displayed" intent as NamedReason.id. */
  id: string
  text: string
  linkedFilter: LinkedFilter
}

const ISSUES_BASE_PATH = '/support/admin/issues'
const POPULATION_BASE_PATH = '/support/admin/population'

function pct(n: number): string {
  return `${Math.round(n)}%`
}

const ORDINAL_WORDS = [
  'zeroth', 'first', 'second', 'third', 'fourth', 'fifth',
  'sixth', 'seventh', 'eighth', 'ninth', 'tenth',
]
function ordinalWord(n: number): string {
  return ORDINAL_WORDS[n] ?? `${n}th`
}

// ── Rule 1: issue prevalence shift ─────────────────────────────────────

export interface IssuePrevalenceInput {
  issueCode: string
  /** Share of analyses containing this issue, 0-100, for the current week. */
  prevalenceThisWeek: number
  /** Same, for the prior week. `null` when there's no prior-week snapshot yet (first week seen) — never trips this rule. */
  prevalenceLastWeek: number | null
}

export const PREVALENCE_SHIFT_THRESHOLD_POINTS = 10

function prevalenceShiftObservations(rows: IssuePrevalenceInput[]): Observation[] {
  const out: Observation[] = []
  for (const row of rows) {
    if (row.prevalenceLastWeek === null) continue
    const delta = row.prevalenceThisWeek - row.prevalenceLastWeek
    if (Math.abs(delta) <= PREVALENCE_SHIFT_THRESHOLD_POINTS) continue

    const direction = delta > 0 ? 'up' : 'down'
    out.push({
      id: `prevalence_shift:${row.issueCode}`,
      text: `\`${row.issueCode}\` prevalence moved ${direction} ${Math.round(Math.abs(delta))} points week over week — from ${pct(row.prevalenceLastWeek)} to ${pct(row.prevalenceThisWeek)} of analyses.`,
      linkedFilter: { basePath: ISSUES_BASE_PATH, params: { issueCode: row.issueCode } },
    })
  }
  return out
}

// ── Rule 2: segment deviation ──────────────────────────────────────────

export interface SegmentMetricInput {
  /** e.g. "function", "seniority" — a PopulationSnapshot.segmentType value. */
  segmentType: string
  /** e.g. "Engineering" — a PopulationSnapshot.segmentValue value. */
  segmentValue: string
  /** Human label for what's being measured, e.g. "Your Evidence score" or "reference-request conversion rate". */
  metricLabel: string
  /** How to phrase the delta: a raw score/points metric, or a percentage rate. */
  unit: 'points' | 'percent'
  segmentRate: number
  overallRate: number
  /** Segment size — callers should already have run rows through cell-suppression.ts before this; this is a belt-and-suspenders re-check, not the primary gate. */
  memberCount: number
}

function segmentDeviationObservations(rows: SegmentMetricInput[]): Observation[] {
  const out: Observation[] = []
  // Grouped by metricLabel, since the σ (spread of segment rates) is only
  // meaningful when comparing segments measured on the same metric —
  // pooling "Your Evidence score" segments with "conversion rate" segments
  // into one distribution would produce a meaningless standard deviation.
  const byMetric = new Map<string, SegmentMetricInput[]>()
  for (const row of rows) {
    if (row.memberCount < MIN_CELL_SIZE) continue
    const list = byMetric.get(row.metricLabel) ?? []
    list.push(row)
    byMetric.set(row.metricLabel, list)
  }

  for (const [metricLabel, metricRows] of byMetric) {
    if (metricRows.length === 0) continue
    // overallRate is the same population figure on every row for a given
    // metric — take the first rather than requiring a separate param.
    const overallRate = metricRows[0].overallRate
    const deviations = findSegmentDeviations(metricRows, (r) => r.segmentRate, overallRate)

    for (const d of deviations) {
      if (!d.deviates) continue
      const row = d.segment
      const belowOrAbove = row.segmentRate < overallRate ? 'below' : 'above'
      const text =
        row.unit === 'points'
          ? `${row.segmentValue} candidates score ${Math.round(Math.abs(row.segmentRate - overallRate))} points ${belowOrAbove} average on ${metricLabel}.`
          : `${metricLabel} for ${row.segmentValue} runs at ${pct(row.segmentRate)} versus ${pct(overallRate)} overall.`

      out.push({
        id: `segment_deviation:${row.segmentType}:${row.segmentValue}:${metricLabel}`,
        text: `${text} That's a ${d.zScore.toFixed(1)}σ deviation from the overall rate — worth checking whether ${row.segmentValue.toLowerCase()} candidates are being under-served here.`,
        linkedFilter: { basePath: ISSUES_BASE_PATH, params: { segmentType: row.segmentType, segmentValue: row.segmentValue } },
      })
    }
  }

  return out
}

// ── Rule 3: funnel step conversion drop ────────────────────────────────

export interface FunnelStepInput {
  stepName: string
  /** 0-100 conversion into this step, current week. */
  conversionThisWeek: number
  /** Same, prior week. `null` skips the check (no prior data yet). */
  conversionLastWeek: number | null
}

export const FUNNEL_DROP_THRESHOLD_POINTS = 5

function funnelDropObservations(rows: FunnelStepInput[]): Observation[] {
  const out: Observation[] = []
  for (const row of rows) {
    if (row.conversionLastWeek === null) continue
    const drop = row.conversionLastWeek - row.conversionThisWeek
    if (drop <= FUNNEL_DROP_THRESHOLD_POINTS) continue

    out.push({
      id: `funnel_drop:${row.stepName}`,
      text: `Conversion at "${row.stepName}" dropped ${Math.round(drop)} points week over week — from ${pct(row.conversionLastWeek)} to ${pct(row.conversionThisWeek)}. This is the step to look at first.`,
      linkedFilter: { basePath: POPULATION_BASE_PATH, params: { funnelStep: row.stepName } },
    })
  }
  return out
}

// ── Rule 4: low fix rate at scale ──────────────────────────────────────

export interface IssueFixRateInput {
  issueCode: string
  timesSurfacedThisWeek: number
  timesFixedThisWeek: number
  /** Total points lost to this issue across the population — used to rank "highest-point-impact fix in the product." Omit if not computed; ranking is skipped when absent on enough rows to compare. */
  totalPointImpact?: number
}

export const FIX_RATE_MIN_SURFACINGS = 100
export const FIX_RATE_THRESHOLD = 0.25

function fixRateObservations(rows: IssueFixRateInput[]): Observation[] {
  const out: Observation[] = []

  // Point-impact rank (1 = highest) across every issue that has a value —
  // computed once over the full input list, not just the ones that trip
  // the low-fix-rate rule, since "highest-point-impact fix in the product"
  // is a product-wide claim.
  const byPointImpact = [...rows]
    .filter((r) => r.totalPointImpact !== undefined)
    .sort((a, b) => (b.totalPointImpact ?? 0) - (a.totalPointImpact ?? 0))
  const pointImpactRank = new Map<string, number>()
  byPointImpact.forEach((r, i) => pointImpactRank.set(r.issueCode, i + 1))

  // Application rank (1 = least-applied, i.e. lowest fix rate) among issues
  // with at least one surfacing this week — same "product-wide" scope.
  const withRate = rows
    .filter((r) => r.timesSurfacedThisWeek > 0)
    .map((r) => ({ issueCode: r.issueCode, fixRate: r.timesFixedThisWeek / r.timesSurfacedThisWeek }))
    .sort((a, b) => a.fixRate - b.fixRate)
  const applicationRank = new Map<string, number>()
  withRate.forEach((r, i) => applicationRank.set(r.issueCode, i + 1))

  for (const row of rows) {
    if (row.timesSurfacedThisWeek < FIX_RATE_MIN_SURFACINGS) continue
    const fixRate = row.timesFixedThisWeek / row.timesSurfacedThisWeek
    if (fixRate >= FIX_RATE_THRESHOLD) continue

    const clauses: string[] = []
    const pRank = pointImpactRank.get(row.issueCode)
    if (pRank === 1) clauses.push('the highest-point-impact fix in the product')
    else if (pRank !== undefined && pRank <= 5) clauses.push(`the ${ordinalWord(pRank)}-highest-point-impact fix in the product`)

    const aRank = applicationRank.get(row.issueCode)
    if (aRank === 1) clauses.push('the least-applied')
    else if (aRank !== undefined && aRank <= 5) clauses.push(`the ${ordinalWord(aRank)}-least-applied`)

    const trailer = clauses.length > 0 ? ` It is ${clauses.join(' and ')}.` : ''

    out.push({
      id: `low_fix_rate:${row.issueCode}`,
      text: `\`${row.issueCode}\` was surfaced ${row.timesSurfacedThisWeek} times this week and fixed ${row.timesFixedThisWeek} times (${pct(fixRate * 100)}).${trailer} The copy or the placement is probably wrong.`,
      linkedFilter: { basePath: ISSUES_BASE_PATH, params: { issueCode: row.issueCode, view: 'fix-rates' } },
    })
  }

  return out
}

// ── Entry point ─────────────────────────────────────────────────────────

// Every field optional — a given admin view only has some of these
// aggregates computed (the issues page has prevalence/segment/fixRate data;
// the population page has funnel/segment data), so this doesn't force a
// caller to supply data it doesn't have. Documented input shape rather than
// a real caller today — see this file's header comment.
export interface GenerateObservationsInput {
  issuePrevalence?: IssuePrevalenceInput[]
  segmentRates?: SegmentMetricInput[]
  funnelSteps?: FunnelStepInput[]
  fixRates?: IssueFixRateInput[]
}

export function generateObservations(input: GenerateObservationsInput): Observation[] {
  return [
    ...prevalenceShiftObservations(input.issuePrevalence ?? []),
    ...segmentDeviationObservations(input.segmentRates ?? []),
    ...funnelDropObservations(input.funnelSteps ?? []),
    ...fixRateObservations(input.fixRates ?? []),
  ]
}

export { SIGNIFICANT_DEVIATION_THRESHOLD }
