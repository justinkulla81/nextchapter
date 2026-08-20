// Resume issue analytics — Phase 2 Master Script, Part B, Prompt 4 (Phase C
// of this build). Powers /support/admin/issues: six views over real
// ResumeIssue rows (Phase A's src/lib/analytics/capture-resume-issues.ts is
// what writes them), all driven by one shared filter/aggregation module so
// the page and the CSV export route handler compute identically instead of
// drifting.
//
// Filter-dimension data-source notes (spec Prompt 4 lists 10 combinable
// filters; not all of them have a real backing column):
//   - seniority / function: ResumeAnalysis.seniorityBand / .functionFamily —
//     real, per-analysis columns.
//   - industry / metro: CandidateProfile.industryBucket / .metroArea — real,
//     already-normalized columns (src/lib/constants/industry-buckets.ts,
//     metro-areas.ts).
//   - employment status: CandidateProfile.currentJobStatus — real, but a
//     7-value enum, not the spec's binary employed/unemployed. Exposed as
//     the real enum rather than inventing a lossy employed/unemployed
//     collapse.
//   - duration bucket: CandidateProfile.gapDuration — real, but only 4
//     buckets (0-3/3-6/6-12/12+ months); the spec's 5-bucket ask
//     (…/12-24/24+) doesn't exist in the schema, so this filter exposes
//     the real 4.
//   - persona: NOT a stored field anywhere — SITUATION_TO_JOB_STATUS
//     (src/lib/constants/onboarding.ts) is a session-only, write-once-at-
//     signup mapping from a homepage entry-card click to CurrentJobStatus;
//     nothing persists which persona card a candidate clicked. Derived here
//     by reversing that map (derivePersona below) — lossy for the 2 job
//     statuses with no persona card (RELOCATED_FOR_FAMILY,
//     NEW_GRADUATE_FIRST_JOB), which fall into 'other'. Invented for this
//     page; not a real historical signal.
//   - usage tier: NOT a stored field anywhere — PopulationSnapshot's
//     segmentType comment lists "usage_tier" as an allowed value but no code
//     computes what it means (confirmed: zero hits for usageTier/
//     UsageTier/activityTier repo-wide). Defined here as a bucket of how
//     many times a candidate has ever run a resume analysis (1 = light,
//     2-3 = moderate, 4+ = engaged) — the most directly on-topic usage
//     signal for a *resume-issue* analytics page specifically. Invented for
//     this page.
//   - date range: applied to ResumeIssue.detectedAt / ResumeAnalysis.createdAt,
//     via the same preset-days <select> action-counts/page.tsx already uses
//     (AdminFilterBar has no raw date-input support — see that component).
//   - issue category / severity: ResumeIssue.category / .severity directly.

import 'server-only'
import { prisma } from '@/lib/prisma'
import type { CurrentJobStatus, GapDurationBucket } from '@prisma/client'
import {
  ISSUE_TAXONOMY,
  type IssueCategory,
  type IssueCode,
  type IssueSeverity,
} from '@/lib/analytics/issue-taxonomy'
import type { SeniorityBand, FunctionFamily } from '@/lib/scoring/resume-analysis/types'
import { SENIORITY_BAND_DEFINITIONS, FUNCTION_FAMILY_DEFINITIONS } from '@/lib/scoring/resume-analysis/weights'
import { INDUSTRY_BUCKET_NAMES } from '@/lib/constants/industry-buckets'
import { METRO_AREA_NAMES } from '@/lib/constants/metro-areas'
import { CURRENT_JOB_STATUS_LABELS, GAP_DURATION_LABELS, SITUATION_TO_JOB_STATUS } from '@/lib/constants/onboarding'
import { suppressSmallCells, isSuppressedCell, MIN_CELL_SIZE } from '@/lib/admin/cell-suppression'
import { findSegmentDeviations } from '@/lib/admin/stats'
import {
  generateObservations,
  type Observation,
  type SegmentMetricInput,
} from '@/lib/admin/observations'

// ── Label maps (derived from real definition arrays, not hand-duplicated) ──

export const SENIORITY_BAND_LABELS: Record<SeniorityBand, string> = Object.fromEntries(
  SENIORITY_BAND_DEFINITIONS.map((d) => [d.band, d.label])
) as Record<SeniorityBand, string>

export const FUNCTION_FAMILY_LABELS: Record<FunctionFamily, string> = Object.fromEntries(
  FUNCTION_FAMILY_DEFINITIONS.map((d) => [d.family, d.label])
) as Record<FunctionFamily, string>

// ── Persona (derived, invented — see file header) ─────────────────────────

export type PersonaValue =
  | 'worried_let_go'
  | 'just_resigned'
  | 'just_laid_off'
  | 'reentering_workforce'
  | 'career_pivot'
  | 'looking_for_promotion'
  | 'other'

const JOB_STATUS_TO_PERSONA: Partial<Record<CurrentJobStatus, PersonaValue>> = Object.fromEntries(
  Object.entries(SITUATION_TO_JOB_STATUS).map(([situation, status]) => [status, situation])
) as Partial<Record<CurrentJobStatus, PersonaValue>>

export const PERSONA_LABELS: Record<PersonaValue, string> = {
  worried_let_go: 'Worried about being let go',
  just_resigned: 'Just resigned',
  just_laid_off: 'Just laid off',
  reentering_workforce: 'Re-entering the workforce',
  career_pivot: 'Career pivot',
  looking_for_promotion: 'Looking for a promotion',
  other: 'Other / unclassified',
}

function derivePersona(status: CurrentJobStatus | null): PersonaValue {
  if (!status) return 'other'
  return JOB_STATUS_TO_PERSONA[status] ?? 'other'
}

// ── Usage tier (derived, invented — see file header) ───────────────────────

export type UsageTierValue = 'light' | 'moderate' | 'engaged'

export const USAGE_TIER_LABELS: Record<UsageTierValue, string> = {
  light: 'Light (1 resume analysis)',
  moderate: 'Moderate (2-3 resume analyses)',
  engaged: 'Engaged (4+ resume analyses)',
}

function deriveUsageTier(analysisCount: number): UsageTierValue {
  if (analysisCount >= 4) return 'engaged'
  if (analysisCount >= 2) return 'moderate'
  return 'light'
}

// ── Filters ──────────────────────────────────────────────────────────────

export type PivotDimension = 'seniority' | 'function' | 'industry' | 'metro' | 'persona' | 'employment' | 'usageTier'

export const PIVOT_LABELS: Record<PivotDimension, string> = {
  seniority: 'Seniority band',
  function: 'Function family',
  industry: 'Industry',
  metro: 'Metro',
  persona: 'Persona',
  employment: 'Employment status',
  usageTier: 'Usage tier',
}

export interface IssueAnalyticsFilters {
  q: string
  range: '' | '7' | '30' | '90'
  seniority: SeniorityBand | ''
  functionFamily: FunctionFamily | ''
  industry: string
  metro: string
  persona: PersonaValue | ''
  employment: CurrentJobStatus | ''
  duration: GapDurationBucket | ''
  usageTier: UsageTierValue | ''
  category: IssueCategory | ''
  severity: IssueSeverity | ''
  pivot: PivotDimension
}

export const RANGE_LABEL: Record<string, string> = {
  '7': 'Last 7 days',
  '30': 'Last 30 days',
  '90': 'Last 90 days',
}

// Same preset-days pattern as action-counts/page.tsx's rangeToDate —
// AdminFilterBar renders this as a plain <select>, not a raw date input
// (see that component; no admin page in this repo rolls its own date
// picker today).
function rangeCutoffDate(range: string): Date | undefined {
  const days = range ? parseInt(range, 10) : NaN
  if (!Number.isFinite(days) || days <= 0) return undefined
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000)
}

const SENIORITY_VALUES: SeniorityBand[] = SENIORITY_BAND_DEFINITIONS.map((d) => d.band)
const FUNCTION_VALUES: FunctionFamily[] = FUNCTION_FAMILY_DEFINITIONS.map((d) => d.family)
const CATEGORY_VALUES: IssueCategory[] = [
  'ats_parsing', 'evidence_quality', 'positioning', 'mechanics',
  'contactability', 'reconciliation', 'reviewer_question', 'structure',
]
const SEVERITY_VALUES: IssueSeverity[] = ['low', 'medium', 'high', 'critical']
const EMPLOYMENT_VALUES = Object.keys(CURRENT_JOB_STATUS_LABELS) as CurrentJobStatus[]
const DURATION_VALUES = Object.keys(GAP_DURATION_LABELS) as GapDurationBucket[]
const PERSONA_VALUES: PersonaValue[] = ['worried_let_go', 'just_resigned', 'just_laid_off', 'reentering_workforce', 'career_pivot', 'other']
const USAGE_TIER_VALUES: UsageTierValue[] = ['light', 'moderate', 'engaged']
const PIVOT_VALUES: PivotDimension[] = ['seniority', 'function', 'industry', 'metro', 'persona', 'employment', 'usageTier']

function pick<T extends string>(params: Record<string, string | undefined>, key: string, allowed: readonly T[]): T | '' {
  const v = params[key]
  return v && (allowed as readonly string[]).includes(v) ? (v as T) : ''
}

export function parseIssueFilters(params: Record<string, string | undefined>): IssueAnalyticsFilters {
  return {
    q: (params.q ?? '').trim(),
    range: pick(params, 'range', ['7', '30', '90']),
    seniority: pick(params, 'seniority', SENIORITY_VALUES),
    functionFamily: pick(params, 'function', FUNCTION_VALUES),
    industry: pick(params, 'industry', INDUSTRY_BUCKET_NAMES),
    metro: pick(params, 'metro', METRO_AREA_NAMES),
    persona: pick(params, 'persona', PERSONA_VALUES),
    employment: pick(params, 'employment', EMPLOYMENT_VALUES),
    duration: pick(params, 'duration', DURATION_VALUES),
    usageTier: pick(params, 'usageTier', USAGE_TIER_VALUES),
    category: pick(params, 'category', CATEGORY_VALUES),
    severity: pick(params, 'severity', SEVERITY_VALUES),
    pivot: pick(params, 'pivot', PIVOT_VALUES) || 'seniority',
  }
}

// Flat query-param record for building CSV/observation links and for
// AdminDataTable's sorting/pagination baseParams convention — omits every
// filter at its default/empty value so URLs stay minimal.
export function filtersToParams(filters: IssueAnalyticsFilters): Record<string, string> {
  const p: Record<string, string> = {}
  if (filters.q) p.q = filters.q
  if (filters.range) p.range = filters.range
  if (filters.seniority) p.seniority = filters.seniority
  if (filters.functionFamily) p.function = filters.functionFamily
  if (filters.industry) p.industry = filters.industry
  if (filters.metro) p.metro = filters.metro
  if (filters.persona) p.persona = filters.persona
  if (filters.employment) p.employment = filters.employment
  if (filters.duration) p.duration = filters.duration
  if (filters.usageTier) p.usageTier = filters.usageTier
  if (filters.category) p.category = filters.category
  if (filters.severity) p.severity = filters.severity
  if (filters.pivot && filters.pivot !== 'seniority') p.pivot = filters.pivot
  return p
}

// ── Shared row shapes ───────────────────────────────────────────────────

interface AnalysisRow {
  id: string
  candidateId: string
  seniorityBand: string
  functionFamily: string
  createdAt: Date
}

interface CandidateMeta {
  industryBucket: string | null
  metroArea: string | null
  currentJobStatus: CurrentJobStatus | null
  gapDuration: GapDurationBucket | null
  persona: PersonaValue
  usageTier: UsageTierValue
}

interface IssueRow {
  issueCode: string
  category: string
  severity: string
  pointImpact: number | null
  detectedAt: Date
  resolvedAt: Date | null
  resolutionType: string | null
  resumeAnalysisId: string
  candidateId: string
}

// ── View 1: Prevalence ──────────────────────────────────────────────────

export interface PrevalenceRow {
  issueCode: IssueCode
  label: string
  category: IssueCategory
  severity: IssueSeverity
  analysesWithIssue: number
  totalAnalyses: number
  prevalencePercent: number
}

function computePrevalence(issues: IssueRow[], totalAnalyses: number): PrevalenceRow[] {
  const byCode = new Map<string, { analysisIds: Set<string>; category: string }>()
  for (const issue of issues) {
    const entry = byCode.get(issue.issueCode) ?? { analysisIds: new Set<string>(), category: issue.category }
    entry.analysisIds.add(issue.resumeAnalysisId)
    byCode.set(issue.issueCode, entry)
  }

  const rows: PrevalenceRow[] = Array.from(byCode.entries()).map(([issueCode, entry]) => {
    const taxonomy = ISSUE_TAXONOMY[issueCode as IssueCode]
    return {
      issueCode: issueCode as IssueCode,
      label: taxonomy?.candidateFacingLabel ?? issueCode,
      category: entry.category as IssueCategory,
      severity: taxonomy?.severity ?? 'low',
      analysesWithIssue: entry.analysisIds.size,
      totalAnalyses,
      prevalencePercent: totalAnalyses > 0 ? Math.round((entry.analysisIds.size / totalAnalyses) * 1000) / 10 : 0,
    }
  })

  return rows.sort((a, b) => b.prevalencePercent - a.prevalencePercent)
}

// ── View 2: Prevalence by segment ───────────────────────────────────────

function segmentValueFor(pivot: PivotDimension, analysis: AnalysisRow, meta: CandidateMeta | undefined): string {
  switch (pivot) {
    case 'seniority':
      return analysis.seniorityBand
    case 'function':
      return analysis.functionFamily
    case 'industry':
      return meta?.industryBucket ?? 'Unclassified'
    case 'metro':
      return meta?.metroArea ?? 'Unclassified'
    case 'persona':
      return meta?.persona ?? 'other'
    case 'employment':
      return meta?.currentJobStatus ?? 'UNKNOWN'
    case 'usageTier':
      return meta?.usageTier ?? 'light'
  }
}

function segmentLabelFor(pivot: PivotDimension, value: string): string {
  switch (pivot) {
    case 'seniority':
      return SENIORITY_BAND_LABELS[value as SeniorityBand] ?? value
    case 'function':
      return FUNCTION_FAMILY_LABELS[value as FunctionFamily] ?? value
    case 'industry':
    case 'metro':
      return value
    case 'persona':
      return PERSONA_LABELS[value as PersonaValue] ?? value
    case 'employment':
      return CURRENT_JOB_STATUS_LABELS[value as CurrentJobStatus] ?? value
    case 'usageTier':
      return USAGE_TIER_LABELS[value as UsageTierValue] ?? value
  }
}

export interface SegmentCell {
  segmentValue: string
  segmentLabel: string
  memberCount: number
  rate: number | null // prevalence %, null when suppressed
  suppressed: boolean
  deviates: boolean
  zScore: number | null
}

export interface SegmentMatrixRow {
  issueCode: IssueCode
  label: string
  overallRate: number
  cells: SegmentCell[]
}

export interface SegmentColumn {
  value: string
  label: string
  memberCount: number
  suppressed: boolean
}

export interface SegmentMatrixResult {
  pivot: PivotDimension
  segments: SegmentColumn[]
  rows: SegmentMatrixRow[]
  observationInputs: SegmentMetricInput[]
}

function computeSegmentMatrix(
  issues: IssueRow[],
  analyses: AnalysisRow[],
  candidateMeta: Map<string, CandidateMeta>,
  pivot: PivotDimension,
  prevalence: PrevalenceRow[]
): SegmentMatrixResult {
  const analysisById = new Map(analyses.map((a) => [a.id, a]))

  const segmentAnalyses = new Map<string, Set<string>>()
  for (const a of analyses) {
    const value = segmentValueFor(pivot, a, candidateMeta.get(a.candidateId))
    const set = segmentAnalyses.get(value) ?? new Set<string>()
    set.add(a.id)
    segmentAnalyses.set(value, set)
  }

  const segmentList = Array.from(segmentAnalyses.entries()).map(([value, set]) => ({
    value,
    label: segmentLabelFor(pivot, value),
    memberCount: set.size,
  }))

  // Cell-suppression Part B Prompt 8: "any segment with fewer than 5
  // members shows 'insufficient data,' never a count." Applied at the
  // segment-column level (not per issue-code cell) since a small segment's
  // member count is what identifies people, regardless of which issue
  // column is being read.
  const segmentDisplay = suppressSmallCells(segmentList, (s) => s.memberCount, (s) => s.label)

  const segmentIssueAnalyses = new Map<string, Set<string>>() // key: `${segmentValue}\0${issueCode}`
  for (const issue of issues) {
    const analysis = analysisById.get(issue.resumeAnalysisId)
    if (!analysis) continue
    const segValue = segmentValueFor(pivot, analysis, candidateMeta.get(analysis.candidateId))
    const key = `${segValue}\0${issue.issueCode}`
    const set = segmentIssueAnalyses.get(key) ?? new Set<string>()
    set.add(issue.resumeAnalysisId)
    segmentIssueAnalyses.set(key, set)
  }

  const rows: SegmentMatrixRow[] = prevalence.map((p) => {
    const rawRates = segmentList.map((seg) => {
      const set = segmentIssueAnalyses.get(`${seg.value}\0${p.issueCode}`)
      const count = set?.size ?? 0
      return { segmentValue: seg.value, memberCount: seg.memberCount, rate: seg.memberCount > 0 ? Math.round((count / seg.memberCount) * 1000) / 10 : 0 }
    })

    // Deviation (>1.5σ, Part B Prompt 4/8) computed only across
    // non-suppressed segments — a small segment's noisy rate shouldn't be
    // flagged as deviant, nor widen/narrow the spread other segments are
    // measured against.
    const eligible = rawRates.filter((r) => r.memberCount >= MIN_CELL_SIZE)
    const deviations = findSegmentDeviations(eligible, (r) => r.rate, p.prevalencePercent)
    const deviationByValue = new Map(deviations.map((d) => [d.segment.segmentValue, d]))

    const cells: SegmentCell[] = segmentList.map((seg, i) => {
      const display = segmentDisplay[i]
      const raw = rawRates[i]
      if (isSuppressedCell(display)) {
        return { segmentValue: seg.value, segmentLabel: seg.label, memberCount: raw.memberCount, rate: null, suppressed: true, deviates: false, zScore: null }
      }
      const dev = deviationByValue.get(seg.value)
      return {
        segmentValue: seg.value,
        segmentLabel: seg.label,
        memberCount: raw.memberCount,
        rate: raw.rate,
        suppressed: false,
        deviates: dev?.deviates ?? false,
        zScore: dev ? Math.round(dev.zScore * 100) / 100 : null,
      }
    })

    return { issueCode: p.issueCode, label: p.label, overallRate: p.prevalencePercent, cells }
  })

  const observationInputs: SegmentMetricInput[] = []
  for (const row of rows) {
    for (const cell of row.cells) {
      if (cell.suppressed || cell.rate === null) continue
      observationInputs.push({
        segmentType: pivot,
        segmentValue: cell.segmentLabel,
        metricLabel: `\`${row.issueCode}\` prevalence`,
        unit: 'percent',
        segmentRate: cell.rate,
        overallRate: row.overallRate,
        memberCount: cell.memberCount,
      })
    }
  }

  return {
    pivot,
    segments: segmentList.map((s, i) => ({ ...s, suppressed: isSuppressedCell(segmentDisplay[i]) })),
    rows,
    observationInputs,
  }
}

export function flattenSegmentMatrixForCsv(result: SegmentMatrixResult): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = []
  for (const row of result.rows) {
    for (const cell of row.cells) {
      out.push({
        issueCode: row.issueCode,
        label: row.label,
        overallRatePercent: row.overallRate,
        segment: cell.segmentLabel,
        memberCount: cell.suppressed ? null : cell.memberCount,
        ratePercent: cell.suppressed ? 'insufficient data' : cell.rate,
        deviates: cell.deviates,
        zScore: cell.zScore,
      })
    }
  }
  return out
}

// ── View 3: Fix rates ───────────────────────────────────────────────────

export interface FixRateRow {
  issueCode: IssueCode
  label: string
  timesSurfaced: number
  timesFixed: number
  timesDismissed: number
  timesDeclined: number
  fixRatePercent: number | null // null = never surfaced in this filtered set
  medianTimeToFixHours: number | null
}

function median(sorted: number[]): number {
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

function computeFixRates(issues: IssueRow[]): FixRateRow[] {
  const byCode = new Map<string, IssueRow[]>()
  for (const issue of issues) {
    const list = byCode.get(issue.issueCode) ?? []
    list.push(issue)
    byCode.set(issue.issueCode, list)
  }

  const rows: FixRateRow[] = Array.from(byCode.entries()).map(([issueCode, list]) => {
    const timesSurfaced = list.length
    // 'corrected_source_data' folded into "fixed" — a reviewer-question
    // detection the candidate corrected at the source is functionally
    // resolved, same outcome bucket as a mechanical fix.
    const fixedRows = list.filter((i) => i.resolutionType === 'fixed' || i.resolutionType === 'corrected_source_data')
    const timesDismissed = list.filter((i) => i.resolutionType === 'dismissed_not_applicable').length
    const timesDeclined = list.filter((i) => i.resolutionType === 'declined_leave_as_is').length

    const fixDurationsHours = fixedRows
      .filter((i) => i.resolvedAt)
      .map((i) => (i.resolvedAt!.getTime() - i.detectedAt.getTime()) / 3_600_000)
      .sort((a, b) => a - b)

    return {
      issueCode: issueCode as IssueCode,
      label: ISSUE_TAXONOMY[issueCode as IssueCode]?.candidateFacingLabel ?? issueCode,
      timesSurfaced,
      timesFixed: fixedRows.length,
      timesDismissed,
      timesDeclined,
      fixRatePercent: timesSurfaced > 0 ? Math.round((fixedRows.length / timesSurfaced) * 1000) / 10 : null,
      medianTimeToFixHours: fixDurationsHours.length > 0 ? Math.round(median(fixDurationsHours) * 10) / 10 : null,
    }
  })

  // Spec: "sort ascending by fix rate — the bottom of this list is the
  // product backlog." Never-surfaced rows (null rate) have nothing to fix,
  // so they sort last rather than tying with a real 0%.
  return rows.sort((a, b) => {
    if (a.fixRatePercent === null && b.fixRatePercent === null) return 0
    if (a.fixRatePercent === null) return 1
    if (b.fixRatePercent === null) return -1
    return a.fixRatePercent - b.fixRatePercent
  })
}

// ── View 4: Point impact ────────────────────────────────────────────────

export interface PointImpactRow {
  issueCode: IssueCode
  label: string
  totalPointImpact: number
  affectedCandidateCount: number
  avgPointImpactPerAffected: number
}

function computePointImpact(issues: IssueRow[]): PointImpactRow[] {
  const byCode = new Map<string, { total: number; candidates: Set<string> }>()
  for (const issue of issues) {
    const entry = byCode.get(issue.issueCode) ?? { total: 0, candidates: new Set<string>() }
    // Null pointImpact (reviewer-question-sourced rows, which carry no
    // per-instance estimate — see capture-resume-issues.ts) contributes 0,
    // not "excluded" — the candidate still has the issue, it just has no
    // measured point cost, which correctly dilutes the per-candidate
    // average for issue codes that are often reviewer-question-sourced.
    entry.total += issue.pointImpact ?? 0
    entry.candidates.add(issue.candidateId)
    byCode.set(issue.issueCode, entry)
  }

  return Array.from(byCode.entries())
    .map(([issueCode, { total, candidates }]) => ({
      issueCode: issueCode as IssueCode,
      label: ISSUE_TAXONOMY[issueCode as IssueCode]?.candidateFacingLabel ?? issueCode,
      totalPointImpact: total,
      affectedCandidateCount: candidates.size,
      avgPointImpactPerAffected: candidates.size > 0 ? Math.round((total / candidates.size) * 10) / 10 : 0,
    }))
    .sort((a, b) => b.totalPointImpact - a.totalPointImpact)
}

// ── View 5: ATS failure matrix ──────────────────────────────────────────
//
// Real data only, per this build's instruction not to fabricate ATS engine
// data. AtsParseResult is written per-analysis by
// src/lib/scoring/resume-analysis/compute.ts from
// ats-matrix.ts's simulateAtsCompatibility() — a REAL, persisted,
// per-resume-analysis parse-simulation result. Two honest gaps vs. the
// spec, both real properties of the underlying data, not omissions:
//   1. The spec names 12 individual ATS platforms (Workday, Taleo,
//      Greenhouse, Lever, Ashby, iCIMS, SuccessFactors, BrassRing,
//      Textkernel, Daxtra, Affinda, RChilli). The engine simulates 7
//      PROFILES, several of which bundle multiple real platforms under one
//      simulated behavior (e.g. "Greenhouse, Lever, Ashby, Workable" share
//      one MODERN_ATS profile; "Textkernel, Daxtra, HireAbility, Affinda,
//      RChilli" share one PARSING_ENGINES profile) — there is no real
//      per-platform split within those groups to report.
//   2. `AtsParseResult.failures` is free-text strings (e.g. "Job titles —
//      letter-spaced headings broke tokenization"), never mapped to an
//      IssueCode anywhere in ats-matrix.ts. This view surfaces the most
//      common real failure-reason strings per profile instead of a
//      "which issue codes cause this" column, rather than inventing a
//      text-to-IssueCode mapping that doesn't exist in the engine.
export interface AtsMatrixRow {
  parserKey: string
  parserLabel: string
  totalAnalyses: number
  cleanCount: number
  partialCount: number
  failingCount: number
  degradedRatePercent: number // (PARTIAL + FAILING) / total
  hardFailureRatePercent: number // FAILING / total
  topFailureReasons: string[]
}

async function computeAtsMatrix(resumeAnalysisIds: string[]): Promise<AtsMatrixRow[]> {
  if (resumeAnalysisIds.length === 0) return []

  const rows = await prisma.atsParseResult.findMany({
    where: { resumeAnalysisId: { in: resumeAnalysisIds } },
    select: { parserKey: true, parserLabel: true, severity: true, failures: true },
  })

  const byParser = new Map<string, { label: string; clean: number; partial: number; failing: number; reasons: Map<string, number> }>()
  for (const r of rows) {
    const entry = byParser.get(r.parserKey) ?? { label: r.parserLabel, clean: 0, partial: 0, failing: 0, reasons: new Map<string, number>() }
    if (r.severity === 'CLEAN') entry.clean++
    else if (r.severity === 'PARTIAL') entry.partial++
    else if (r.severity === 'FAILING') entry.failing++
    for (const reason of (r.failures as unknown as string[]) ?? []) {
      entry.reasons.set(reason, (entry.reasons.get(reason) ?? 0) + 1)
    }
    byParser.set(r.parserKey, entry)
  }

  return Array.from(byParser.entries())
    .map(([parserKey, e]) => {
      const total = e.clean + e.partial + e.failing
      return {
        parserKey,
        parserLabel: e.label,
        totalAnalyses: total,
        cleanCount: e.clean,
        partialCount: e.partial,
        failingCount: e.failing,
        degradedRatePercent: total > 0 ? Math.round(((e.partial + e.failing) / total) * 1000) / 10 : 0,
        hardFailureRatePercent: total > 0 ? Math.round((e.failing / total) * 1000) / 10 : 0,
        topFailureReasons: Array.from(e.reasons.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([reason, count]) => `${reason} (${count})`),
      }
    })
    .sort((a, b) => b.degradedRatePercent - a.degradedRatePercent)
}

// ── View 6: Co-occurrence ───────────────────────────────────────────────

export interface CoOccurrenceRow {
  issueCodeA: IssueCode
  labelA: string
  issueCodeB: IssueCode
  labelB: string
  jointCount: number
  countA: number
  countB: number
  lift: number // jointCount / expected-under-independence — 1.0 = no relationship, 4.0 = 4x more likely together than chance
}

// Simple pairwise lift, not real statistical rigor (per this build's
// instruction) — expected co-occurrence under independence is
// (countA/N)*(countB/N)*N = countA*countB/N; lift is the real/expected
// ratio.
function computeCoOccurrence(issues: IssueRow[], totalAnalyses: number): CoOccurrenceRow[] {
  if (totalAnalyses === 0) return []

  const codesByAnalysis = new Map<string, Set<string>>()
  for (const issue of issues) {
    const set = codesByAnalysis.get(issue.resumeAnalysisId) ?? new Set<string>()
    set.add(issue.issueCode)
    codesByAnalysis.set(issue.resumeAnalysisId, set)
  }

  const singleCount = new Map<string, number>()
  const jointCount = new Map<string, number>() // key: `${a}::${b}`, a < b

  for (const codes of codesByAnalysis.values()) {
    const list = Array.from(codes).sort()
    for (const code of list) singleCount.set(code, (singleCount.get(code) ?? 0) + 1)
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const key = `${list[i]}::${list[j]}`
        jointCount.set(key, (jointCount.get(key) ?? 0) + 1)
      }
    }
  }

  const rows: CoOccurrenceRow[] = []
  for (const [key, joint] of jointCount) {
    const [a, b] = key.split('::')
    const countA = singleCount.get(a) ?? 0
    const countB = singleCount.get(b) ?? 0
    const expected = (countA * countB) / totalAnalyses
    const lift = expected > 0 ? joint / expected : 0
    rows.push({
      issueCodeA: a as IssueCode,
      labelA: ISSUE_TAXONOMY[a as IssueCode]?.candidateFacingLabel ?? a,
      issueCodeB: b as IssueCode,
      labelB: ISSUE_TAXONOMY[b as IssueCode]?.candidateFacingLabel ?? b,
      jointCount: joint,
      countA,
      countB,
      lift: Math.round(lift * 100) / 100,
    })
  }

  return rows.sort((a, b) => b.lift - a.lift)
}

// ── Entry point ─────────────────────────────────────────────────────────

export interface IssueAnalyticsData {
  totalAnalyses: number
  prevalence: PrevalenceRow[]
  segmentMatrix: SegmentMatrixResult
  fixRates: FixRateRow[]
  pointImpact: PointImpactRow[]
  atsMatrix: AtsMatrixRow[]
  coOccurrence: CoOccurrenceRow[]
  observations: Observation[]
}

function emptyAnalytics(pivot: PivotDimension): IssueAnalyticsData {
  return {
    totalAnalyses: 0,
    prevalence: [],
    segmentMatrix: { pivot, segments: [], rows: [], observationInputs: [] },
    fixRates: [],
    pointImpact: [],
    atsMatrix: [],
    coOccurrence: [],
    observations: [],
  }
}

export async function loadIssueAnalytics(filters: IssueAnalyticsFilters): Promise<IssueAnalyticsData> {
  const cutoff = rangeCutoffDate(filters.range)

  // Candidate-level eligibility (industry/metro/persona/employment/duration/
  // usageTier) — computed in-memory since persona and usageTier have no
  // backing Prisma column to filter on directly.
  const candidates = await prisma.candidateProfile.findMany({
    select: {
      id: true,
      currentJobStatus: true,
      gapDuration: true,
      industryBucket: true,
      metroArea: true,
      _count: { select: { resumeAnalyses: true } },
    },
  })

  const candidateMeta = new Map<string, CandidateMeta>()
  for (const c of candidates) {
    const persona = derivePersona(c.currentJobStatus)
    const usageTier = deriveUsageTier(c._count.resumeAnalyses)
    const eligible =
      (!filters.industry || c.industryBucket === filters.industry) &&
      (!filters.metro || c.metroArea === filters.metro) &&
      (!filters.persona || persona === filters.persona) &&
      (!filters.employment || c.currentJobStatus === filters.employment) &&
      (!filters.duration || c.gapDuration === filters.duration) &&
      (!filters.usageTier || usageTier === filters.usageTier)
    if (!eligible) continue
    candidateMeta.set(c.id, {
      industryBucket: c.industryBucket,
      metroArea: c.metroArea,
      currentJobStatus: c.currentJobStatus,
      gapDuration: c.gapDuration,
      persona,
      usageTier,
    })
  }

  const eligibleCandidateIds = Array.from(candidateMeta.keys())
  if (eligibleCandidateIds.length === 0) return emptyAnalytics(filters.pivot)

  const analyses: AnalysisRow[] = await prisma.resumeAnalysis.findMany({
    where: {
      candidateId: { in: eligibleCandidateIds },
      ...(filters.seniority && { seniorityBand: filters.seniority }),
      ...(filters.functionFamily && { functionFamily: filters.functionFamily }),
      ...(cutoff && { createdAt: { gte: cutoff } }),
    },
    select: { id: true, candidateId: true, seniorityBand: true, functionFamily: true, createdAt: true },
  })

  if (analyses.length === 0) return emptyAnalytics(filters.pivot)

  const analysisIds = analyses.map((a) => a.id)
  // rawIssues and the ATS matrix both only depend on `analyses` (fetched
  // above), not on each other — batched together instead of computeAtsMatrix
  // waiting in sequence after this, several sync compute* calls later.
  const [rawIssues, atsMatrix]: [IssueRow[], AtsMatrixRow[]] = await Promise.all([
    prisma.resumeIssue.findMany({
      where: {
        resumeAnalysisId: { in: analysisIds },
        ...(filters.category && { category: filters.category }),
        ...(filters.severity && { severity: filters.severity }),
        ...(cutoff && { detectedAt: { gte: cutoff } }),
      },
      select: {
        issueCode: true,
        category: true,
        severity: true,
        pointImpact: true,
        detectedAt: true,
        resolvedAt: true,
        resolutionType: true,
        resumeAnalysisId: true,
        candidateId: true,
      },
    }),
    computeAtsMatrix(analysisIds),
  ])

  const q = filters.q.toLowerCase()
  const issues = q
    ? rawIssues.filter((i) => {
        const label = ISSUE_TAXONOMY[i.issueCode as IssueCode]?.candidateFacingLabel ?? ''
        return i.issueCode.toLowerCase().includes(q) || label.toLowerCase().includes(q)
      })
    : rawIssues

  const totalAnalyses = analyses.length
  const prevalence = computePrevalence(issues, totalAnalyses)
  const segmentMatrix = computeSegmentMatrix(issues, analyses, candidateMeta, filters.pivot, prevalence)
  const fixRates = computeFixRates(issues)
  const pointImpact = computePointImpact(issues)
  const coOccurrence = computeCoOccurrence(issues, totalAnalyses)

  const pointImpactByCode = new Map(pointImpact.map((p) => [p.issueCode, p.totalPointImpact]))
  const observations = generateObservations({
    // prevalenceLastWeek is always null — there's no weekly PopulationSnapshot
    // data yet (Part B Prompt 6's snapshot job hasn't been built by any
    // phase), so the week-over-week prevalence-shift rule can never fire
    // today. Real current-week numbers are still passed through so the rule
    // is ready the moment that job exists.
    issuePrevalence: prevalence.map((r) => ({ issueCode: r.issueCode, prevalenceThisWeek: r.prevalencePercent, prevalenceLastWeek: null })),
    segmentRates: segmentMatrix.observationInputs,
    fixRates: fixRates
      .filter((r) => r.timesSurfaced > 0)
      .map((r) => ({
        issueCode: r.issueCode,
        timesSurfacedThisWeek: r.timesSurfaced,
        timesFixedThisWeek: r.timesFixed,
        totalPointImpact: pointImpactByCode.get(r.issueCode),
      })),
  })

  return { totalAnalyses, prevalence, segmentMatrix, fixRates, pointImpact, atsMatrix, coOccurrence, observations }
}
