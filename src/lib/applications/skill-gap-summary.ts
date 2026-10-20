// A member's applications rolled up: overall match, the 8-week trend, the skills they keep being
// asked for and don't list, and where they match best. Pure; tested in
// src/test/application-skill-snapshot.test.ts. Read by Search Strategy ("Your applications: match
// and gaps"), Learning, Market Reality and explain-my-gaps, so they all show one set of gaps.

import { BASIS_WEIGHT, type SnapshotBasis } from './skill-snapshot'
import { JOB_INDUSTRY_KEY_BUCKET } from '@/lib/profile/industry-reading'
import { seniorityGroupLabel, seniorityGroupOf } from '@/lib/jobs/job-seniority'

export interface SnapshotRow {
  appliedAt: Date
  basis: SnapshotBasis | string
  /** At application time — history, never rewritten. */
  matchPct: number | null
  missing: string[]
  /** Against the member's skills now. */
  currentMatchPct: number | null
  currentMissing: string[]
  aiSkills?: string[]
  industry: string | null
  jobFunction: string | null
  level: string | null
}

const DAY = 86_400_000
/** A month-old application counts half as much as one sent today in "keep being asked for". */
export const RECENCY_HALF_LIFE_DAYS = 30
export const TREND_WEEKS = 8
export const TOP_GAPS = 5
/** A segment needs this many applications with skill data before "where you match best" compares it. */
export const MIN_SEGMENT_APPS = 3

const weightOf = (basis: string) => BASIS_WEIGHT[basis as SnapshotBasis] ?? 0.5

/** Basis-weighted mean of match percentages; null when none have one. */
export function weightedMatch<T>(rows: T[], pctOf: (r: T) => number | null, basisOf: (r: T) => string): number | null {
  let num = 0
  let den = 0
  for (const r of rows) {
    const p = pctOf(r)
    if (p == null) continue
    const w = weightOf(basisOf(r))
    num += w * p
    den += w
  }
  return den > 0 ? Math.round(num / den) : null
}

/** Monday 00:00 UTC of the week containing d. */
export function weekStart(d: Date): Date {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const dow = (x.getUTCDay() + 6) % 7
  return new Date(x.getTime() - dow * DAY)
}

export interface TrendPoint {
  weekStart: string
  applications: number
  /** Match at application time, basis-weighted; null for a week with no applications we could read. */
  matchPct: number | null
}

/** The last `weeks` weeks, oldest first, ending with the current week. Match is as it was when each application went in. */
export function weeklyTrend(rows: SnapshotRow[], now: Date, weeks = TREND_WEEKS): TrendPoint[] {
  const end = weekStart(now).getTime()
  const out: TrendPoint[] = []
  for (let i = weeks - 1; i >= 0; i--) {
    const from = end - i * 7 * DAY
    const to = from + 7 * DAY
    const inWeek = rows.filter((r) => r.appliedAt.getTime() >= from && r.appliedAt.getTime() < to)
    out.push({
      weekStart: new Date(from).toISOString().slice(0, 10),
      applications: inWeek.length,
      matchPct: weightedMatch(inWeek, (r) => r.matchPct, (r) => r.basis),
    })
  }
  return out
}

export interface AskedGap {
  term: string
  /** Applications whose job asked for it and the member doesn't show it now. */
  applications: number
  /** Of those, sent in the last 30 days. */
  recent: number
  /** Asked only by inferred (O*NET) snapshots, never by a real posting. */
  inferredOnly: boolean
  /** One of the 24 AI skill items. */
  ai: boolean
  score: number
}

/**
 * "Skills you keep being asked for and don't list yet": each term scored by the applications that
 * ask for it, weighted toward recent ones (half-life RECENCY_HALF_LIFE_DAYS) and toward real postings
 * (BASIS_WEIGHT). Read against the member's skills now, so adding one makes it leave the list.
 * Terms asked by one application only are dropped when enough others repeat.
 */
export function topAskedGaps(rows: SnapshotRow[], now: Date, limit = TOP_GAPS): AskedGap[] {
  const by = new Map<string, AskedGap & { key: string }>()
  for (const r of rows) {
    const age = Math.max(0, (now.getTime() - r.appliedAt.getTime()) / DAY)
    const w = weightOf(r.basis) * Math.pow(0.5, age / RECENCY_HALF_LIFE_DAYS)
    const ai = new Set((r.aiSkills ?? []).map((s) => s.toLowerCase()))
    for (const term of new Set(r.currentMissing)) {
      const key = term.toLowerCase()
      const g = by.get(key) ?? { key, term, applications: 0, recent: 0, inferredOnly: true, ai: false, score: 0 }
      g.applications += 1
      if (age <= 30) g.recent += 1
      if (r.basis === 'posting') g.inferredOnly = false
      if (ai.has(key)) g.ai = true
      g.score += w
      by.set(key, g)
    }
  }
  const all = [...by.values()].sort((a, b) => b.score - a.score || b.applications - a.applications || a.term.localeCompare(b.term))
  const repeated = all.filter((g) => g.applications >= 2)
  return (repeated.length >= limit ? repeated : all).slice(0, limit).map(({ key: _key, ...g }) => ({ ...g, score: Math.round(g.score * 100) / 100 }))
}

// ── Where you match best ──

export type SegmentDimension = 'function' | 'industry' | 'level'

/** Full industry label: a board key ("healthcare") or a directory label ("Insurance") -> "Healthcare & Hospital Systems". */
export function industryLabel(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null
  return JOB_INDUSTRY_KEY_BUCKET[raw.trim().toLowerCase()] ?? raw.trim()
}

/** Short form for a sentence: "Healthcare & Hospital Systems" -> "Healthcare". */
export function industryName(raw: string | null | undefined): string | null {
  const label = industryLabel(raw)
  return label ? label.split(/ & |, /)[0] : null
}

export function levelName(raw: string | null | undefined): string | null {
  return seniorityGroupLabel(seniorityGroupOf(raw))
}

export function segmentOf(r: Pick<SnapshotRow, 'industry' | 'jobFunction' | 'level'>, dim: SegmentDimension): string | null {
  if (dim === 'function') return r.jobFunction?.trim() || null
  if (dim === 'industry') return industryName(r.industry)
  return levelName(r.level)
}

export interface SegmentMatch {
  segment: string
  applications: number
  matchPct: number
}

/** Current match per segment of one dimension, segments with MIN_SEGMENT_APPS+ readable applications, best first. */
export function segmentMatches(rows: SnapshotRow[], dim: SegmentDimension): SegmentMatch[] {
  const groups = new Map<string, SnapshotRow[]>()
  for (const r of rows) {
    if (r.currentMatchPct == null) continue
    const s = segmentOf(r, dim)
    if (!s) continue
    groups.set(s, [...(groups.get(s) ?? []), r])
  }
  return [...groups.entries()]
    .filter(([, rs]) => rs.length >= MIN_SEGMENT_APPS)
    .map(([segment, rs]) => ({ segment, applications: rs.length, matchPct: weightedMatch(rs, (r) => r.currentMatchPct, (r) => r.basis)! }))
    .sort((a, b) => b.matchPct - a.matchPct || b.applications - a.applications || a.segment.localeCompare(b.segment))
}

export interface BestMatchLine {
  dimension: SegmentDimension
  best: SegmentMatch
  worst: SegmentMatch | null
  text: string
}

const lowerIndustry = (s: string) => s.toLowerCase()

/**
 * One short line: the dimension where the member's match differs most between two segments.
 * "You match 82% on Finance roles in healthcare vs 61% in technology." Null when no segment has
 * enough applications to say anything.
 */
export function bestMatchLine(rows: SnapshotRow[]): BestMatchLine | null {
  const dims: SegmentDimension[] = ['industry', 'function', 'level']
  let pick: { dim: SegmentDimension; list: SegmentMatch[]; spread: number } | null = null
  for (const dim of dims) {
    const list = segmentMatches(rows, dim)
    if (list.length === 0) continue
    const spread = list.length >= 2 ? list[0].matchPct - list[list.length - 1].matchPct : -1
    if (!pick || spread > pick.spread) pick = { dim, list, spread }
  }
  if (!pick) return null
  const best = pick.list[0]
  const worst = pick.list.length >= 2 ? pick.list[pick.list.length - 1] : null
  // The member's main function, when most readable applications share one: "on Finance roles in healthcare".
  const fns = segmentMatches(rows.map((r) => ({ ...r, level: null, industry: null })), 'function')
  const readable = rows.filter((r) => r.currentMatchPct != null).length
  const mainFn = pick.dim === 'industry' && fns[0] && fns[0].applications / Math.max(1, readable) >= 0.6 ? fns[0].segment : null
  let text: string
  if (pick.dim === 'industry') {
    const on = mainFn ? `on ${mainFn} roles ` : 'on roles '
    text = worst
      ? `You match ${best.matchPct}% ${on}in ${lowerIndustry(best.segment)} vs ${worst.matchPct}% in ${lowerIndustry(worst.segment)}.`
      : `You match ${best.matchPct}% ${on}in ${lowerIndustry(best.segment)}.`
  } else {
    text = worst
      ? `You match ${best.matchPct}% on ${best.segment} roles vs ${worst.matchPct}% on ${worst.segment} roles.`
      : `You match ${best.matchPct}% on ${best.segment} roles.`
  }
  return { dimension: pick.dim, best, worst, text }
}

// ── The whole member view ──

export interface ApplicationGapSummary {
  applications: number
  /** Of them, read from a linked posting (the rest inferred from the title). */
  fromPostings: number
  inferred: number
  /** Match against the member's skills now. */
  matchPct: number | null
  /** Match as it was when each application went in. */
  matchPctAtApply: number | null
  trend: TrendPoint[]
  gaps: AskedGap[]
  best: BestMatchLine | null
}

export function summarizeApplications(rows: SnapshotRow[], now: Date): ApplicationGapSummary {
  return {
    applications: rows.length,
    fromPostings: rows.filter((r) => r.basis === 'posting').length,
    inferred: rows.filter((r) => r.basis !== 'posting').length,
    matchPct: weightedMatch(rows, (r) => r.currentMatchPct, (r) => r.basis),
    matchPctAtApply: weightedMatch(rows, (r) => r.matchPct, (r) => r.basis),
    trend: weeklyTrend(rows, now),
    gaps: topAskedGaps(rows, now),
    best: bestMatchLine(rows),
  }
}
