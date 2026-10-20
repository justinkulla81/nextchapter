// Skills match and gap across every member's applications, by segment, for the admin report
// (support/admin/jobs/skills-match) and the B2B retraining pitch. Aggregates only: no names, no
// member ids leave this module. Match is as it was at application time (the frozen snapshot), so
// history does not move when members add skills. Pure; tested in src/test/application-skill-snapshot.test.ts.

import { BASIS_WEIGHT, type SnapshotBasis } from './skill-snapshot'
import { industryLabel, levelName, weekStart } from './skill-gap-summary'
import { neutralizeFormula } from '@/lib/admin/csv-export'

export interface AggregateRow {
  candidateId: string
  appliedAt: Date
  basis: SnapshotBasis | string
  matchPct: number | null
  missing: string[]
  industry: string | null
  jobFunction: string | null
  level: string | null
  locationState: string | null
  region: string | null
}

export type Dimension = 'overall' | 'industry' | 'function' | 'level' | 'region' | 'state'
export const DIMENSIONS: { key: Dimension; label: string }[] = [
  { key: 'overall', label: 'Overall' },
  { key: 'industry', label: 'Industry' },
  { key: 'function', label: 'Function' },
  { key: 'level', label: 'Level' },
  { key: 'region', label: 'Region' },
  { key: 'state', label: 'State' },
]

export const TOP_GAPS_PER_SEGMENT = 5
const DAY = 86_400_000

export function segmentFor(r: AggregateRow, dim: Dimension): string {
  const v =
    dim === 'overall'
      ? 'All applications'
      : dim === 'industry'
        ? industryLabel(r.industry)
        : dim === 'function'
          ? r.jobFunction?.trim() || null
          : dim === 'level'
            ? levelName(r.level)
            : dim === 'region'
              ? r.region
              : r.locationState
  return v || 'Unknown'
}

export interface GapCount {
  term: string
  applications: number
  /** Share of this segment's applications with skill data that miss it, 0-100. */
  sharePct: number
}

export interface SegmentAggregate {
  dimension: Dimension
  segment: string
  applications: number
  members: number
  /** Applications whose job asked for something we could read. */
  withSkillData: number
  fromPostings: number
  inferred: number
  /** Basis-weighted mean match at application time. */
  matchPct: number | null
  topGaps: GapCount[]
}

function aggregateGroup(dim: Dimension, segment: string, rows: AggregateRow[]): SegmentAggregate {
  let num = 0
  let den = 0
  const gaps = new Map<string, { term: string; n: number }>()
  const readable = rows.filter((r) => r.matchPct != null)
  for (const r of readable) {
    const w = BASIS_WEIGHT[r.basis as SnapshotBasis] ?? 0.5
    num += w * r.matchPct!
    den += w
    for (const t of new Set(r.missing)) {
      const k = t.toLowerCase()
      const g = gaps.get(k) ?? { term: t, n: 0 }
      g.n += 1
      gaps.set(k, g)
    }
  }
  return {
    dimension: dim,
    segment,
    applications: rows.length,
    members: new Set(rows.map((r) => r.candidateId)).size,
    withSkillData: readable.length,
    fromPostings: rows.filter((r) => r.basis === 'posting').length,
    inferred: rows.filter((r) => r.basis !== 'posting').length,
    matchPct: den > 0 ? Math.round(num / den) : null,
    topGaps: [...gaps.values()]
      .sort((a, b) => b.n - a.n || a.term.localeCompare(b.term))
      .slice(0, TOP_GAPS_PER_SEGMENT)
      .map((g) => ({ term: g.term, applications: g.n, sharePct: Math.round((100 * g.n) / Math.max(1, readable.length)) })),
  }
}

/** Every segment of one dimension, most applications first ("Unknown" last). */
export function aggregateBy(rows: AggregateRow[], dim: Dimension): SegmentAggregate[] {
  const groups = new Map<string, AggregateRow[]>()
  for (const r of rows) {
    const s = segmentFor(r, dim)
    groups.set(s, [...(groups.get(s) ?? []), r])
  }
  return [...groups.entries()]
    .map(([s, rs]) => aggregateGroup(dim, s, rs))
    .sort((a, b) => Number(a.segment === 'Unknown') - Number(b.segment === 'Unknown') || b.applications - a.applications || a.segment.localeCompare(b.segment))
}

export interface WeeklyPoint {
  weekStart: string
  applications: number
  members: number
  matchPct: number | null
}

export function weeklyAggregate(rows: AggregateRow[], now: Date, weeks = 12): WeeklyPoint[] {
  const end = weekStart(now).getTime()
  const out: WeeklyPoint[] = []
  for (let i = weeks - 1; i >= 0; i--) {
    const from = end - i * 7 * DAY
    const inWeek = rows.filter((r) => r.appliedAt.getTime() >= from && r.appliedAt.getTime() < from + 7 * DAY)
    const g = aggregateGroup('overall', 'week', inWeek)
    out.push({ weekStart: new Date(from).toISOString().slice(0, 10), applications: g.applications, members: g.members, matchPct: g.matchPct })
  }
  return out
}

export interface SkillMatchReport {
  overall: SegmentAggregate
  byDimension: Record<Exclude<Dimension, 'overall'>, SegmentAggregate[]>
  trend: WeeklyPoint[]
}

export function buildSkillMatchReport(rows: AggregateRow[], now: Date): SkillMatchReport {
  return {
    overall: aggregateGroup('overall', 'All applications', rows),
    byDimension: {
      industry: aggregateBy(rows, 'industry'),
      function: aggregateBy(rows, 'function'),
      level: aggregateBy(rows, 'level'),
      region: aggregateBy(rows, 'region'),
      state: aggregateBy(rows, 'state'),
    },
    trend: weeklyAggregate(rows, now),
  }
}

// ── CSV ──

const csvCell = (v: string | number | null) => {
  const s = v == null ? '' : neutralizeFormula(String(v))
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** One row per segment, every dimension, aggregates only. */
export function skillMatchCsv(report: SkillMatchReport): string {
  const head = ['dimension', 'segment', 'applications', 'members', 'with_skill_data', 'from_postings', 'inferred', 'match_pct', 'top_gaps']
  const segs = [report.overall, ...Object.values(report.byDimension).flat()]
  const lines = segs.map((s) =>
    [s.dimension, s.segment, s.applications, s.members, s.withSkillData, s.fromPostings, s.inferred, s.matchPct, s.topGaps.map((g) => `${g.term} (${g.applications})`).join('; ')]
      .map(csvCell)
      .join(','),
  )
  return [head.join(','), ...lines].join('\n') + '\n'
}

// ── The retraining pitch ──

/** A segment is citable in a pitch only with this many applications and members behind it. */
export const PITCH_MIN_APPLICATIONS = 20
export const PITCH_MIN_MEMBERS = 3

export interface PitchGapLine {
  citable: boolean
  /** Why it can't be cited yet, when it can't. */
  why: string | null
  text: string
}

const listAnd = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`)

/** "Across 240 applications in finance, the top missing skills were SQL, Power BI and FP&A." */
export function pitchGapLine(seg: SegmentAggregate, top = 3): PitchGapLine {
  const where = seg.dimension === 'overall' ? '' : seg.dimension === 'level' ? ` at ${seg.segment} level` : seg.dimension === 'function' ? ` in ${seg.segment} roles` : ` in ${seg.dimension === 'industry' ? seg.segment.toLowerCase() : seg.segment}`
  const gaps = seg.topGaps.slice(0, top).map((g) => g.term)
  const text = gaps.length
    ? `Across ${seg.withSkillData.toLocaleString('en-US')} applications${where}, the top missing skills were ${listAnd(gaps)}.`
    : `Across ${seg.withSkillData.toLocaleString('en-US')} applications${where}, no skill was missing often enough to name.`
  const thin = seg.withSkillData < PITCH_MIN_APPLICATIONS ? `needs ${PITCH_MIN_APPLICATIONS}+ applications with skill data (has ${seg.withSkillData})` : seg.members < PITCH_MIN_MEMBERS ? `needs ${PITCH_MIN_MEMBERS}+ members (has ${seg.members})` : null
  return { citable: !thin && gaps.length > 0, why: thin, text }
}
