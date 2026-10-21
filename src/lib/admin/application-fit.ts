// Application fit (admin) — is a member applying to jobs at the wrong years of
// experience or seniority? Pure: classification, rollups and the coaching line
// live here (tested in src/test/application-fit.test.ts); the Prisma reads are
// in application-fit-data.ts.
//
// Two independent reads per application, then one verdict:
//
//   Years      member's years vs the posting's stated requirement
//              (parseYearsRequired), on the shared lenient rule in
//              src/lib/jobs/years-fit.ts — the same one fit scoring and job
//              match use. In line (short by at most max(2, 25% of the
//              minimum)) = within; short but at least half the minimum =
//              stretch ("under", still on target); under half the minimum =
//              far short ("big_under", the only years reach); min + 8 and
//              more than twice the max (twice the min when no max) =
//              overqualified. No stated years = unknown.
//   Seniority  the job's rung vs the member's level, on fit scoring v2's
//              scale (levelStep in job-fit-bucket.ts — same member window and
//              rung points the board uses). Up 2+ = reach, up 1 = stretch
//              (healthy, on target), same, down 1, down 2+ = underselling.
//              A pivoting member's step down is expected and doesn't count.
//
//   Verdict    Reaching      a reach on either read and no undersell
//              Underselling  down 2+, down 1 with years overqualified, or years
//                            overqualified when the job's level is unknown
//                            (more years than asked at the member's own level
//                            is normal for experienced people, so it alone
//                            doesn't count; fewer years than asked is a real
//                            screening risk, so it does)
//              On target     everything else that has at least one read
//              Unknown       neither read is possible
//   When the two reads disagree (a big seniority step up but more years than
//   asked), seniority decides — titles move further than tenure does.

import { levelStep, type LevelStep } from '@/lib/jobs/job-fit-bucket'
import type { YearsRequirement } from '@/lib/jobs/years-required'
import { assessYearsFit, yearsRangeOf, type YearsFitBand } from '@/lib/jobs/years-fit'

/** Members need at least this many classified applications to appear in the member list. */
export const MIN_MEMBER_SAMPLE = 3

export type YearsFit = 'big_under' | 'under' | 'within' | 'over' | 'unknown'
export type SeniorityFit = LevelStep
export type ApplyFitVerdict = 'reaching' | 'on_target' | 'underselling' | 'unknown'

export const VERDICT_LABEL: Record<ApplyFitVerdict, string> = {
  reaching: 'Reaching',
  on_target: 'On target',
  underselling: 'Underselling',
  unknown: 'Unknown',
}

export const SENIORITY_LABEL: Record<SeniorityFit, string> = {
  big_up: 'Up 2+ levels',
  up: 'Up 1 (stretch)',
  same: 'Same level',
  down: 'Down 1',
  big_down: 'Down 2+',
  unknown: 'Unknown',
}

export const YEARS_FIT_LABEL: Record<YearsFit, string> = {
  big_under: 'Far short',
  under: 'Stretch',
  within: 'In line',
  over: 'Overqualified',
  unknown: 'Not stated',
}

export interface ApplyFitMember {
  highestLevelReached: string | null
  levelRankScore: number | null
  /** Stated years, or computed from work history by the loader. */
  yearsExperience: number | null
  isPivoting: boolean
}

export interface ApplyFitJob {
  title: string | null
  /** ncrawl's rung (ExclusiveJobPosting.level), when the job was matched to the board. */
  level?: string | null
  targetLevel?: string | null
  yearsRequired: YearsRequirement | null
}

export interface YearsRead {
  fit: YearsFit
  /** Negative = under the minimum by N; positive = over the top (or the minimum when no top) by N; 0 inside the range. Null when unknown. */
  gap: number | null
}

export interface ApplyFitResult {
  years: YearsRead
  seniority: SeniorityFit
  verdict: ApplyFitVerdict
  /** The step down is explained by the member pivoting. */
  pivotExplained: boolean
  /** Short human reason, e.g. "Up 2+ levels; under by 3 yrs". */
  reason: string
}

const FIT_OF_BAND: Record<YearsFitBand, YearsFit> = {
  far: 'big_under',
  stretch: 'under',
  in_line: 'within',
  overqualified: 'over',
  unknown: 'unknown',
}

export function classifyYears(memberYears: number | null, req: YearsRequirement | null): YearsRead {
  const read = assessYearsFit(memberYears, yearsRangeOf(req))
  if (read.band === 'unknown' || read.short === null || read.over === null) return { fit: 'unknown', gap: null }
  return { fit: FIT_OF_BAND[read.band], gap: read.short > 0 ? -read.short : read.over }
}

export function classifySeniority(member: ApplyFitMember, job: ApplyFitJob): SeniorityFit {
  if (!job.title && !job.level && !job.targetLevel) return 'unknown'
  return levelStep(
    { highestLevelReached: member.highestLevelReached, levelRankScore: member.levelRankScore },
    { title: job.title ?? '', level: job.level ?? null, targetLevel: job.targetLevel ?? null },
  )
}

export function classifyApplication(member: ApplyFitMember, job: ApplyFitJob): ApplyFitResult {
  const years = classifyYears(member.yearsExperience, job.yearsRequired)
  const seniority = classifySeniority(member, job)
  const pivotExplained = member.isPivoting && (seniority === 'down' || seniority === 'big_down')

  const senReach = seniority === 'big_up'
  const senUndersell = seniority === 'big_down' && !pivotExplained
  const senMildDown = seniority === 'down' && !pivotExplained
  // Only far short is a real years mismatch; a stretch is fine.
  const yrsReach = years.fit === 'big_under'
  // A pivot resets the ladder — more years than a new-field role asks is expected.
  const yrsOver = years.fit === 'over' && !member.isPivoting

  let verdict: ApplyFitVerdict
  if (seniority === 'unknown' && years.fit === 'unknown') verdict = 'unknown'
  else if (senReach) verdict = 'reaching'
  else if (senUndersell || (senMildDown && yrsOver)) verdict = 'underselling'
  else if (yrsReach && seniority !== 'down' && seniority !== 'big_down') verdict = 'reaching'
  else if (yrsOver && seniority === 'unknown') verdict = 'underselling'
  else verdict = 'on_target'

  const parts: string[] = []
  if (seniority !== 'unknown') parts.push(pivotExplained ? `${SENIORITY_LABEL[seniority]} (pivoting)` : SENIORITY_LABEL[seniority])
  if (years.gap !== null) {
    parts.push(years.gap < 0 ? `under by ${-years.gap} yrs` : years.gap > 0 ? `over by ${years.gap} yrs` : 'years within range')
  }
  return { years, seniority, verdict, pivotExplained, reason: parts.join('; ') || 'No level or years to compare' }
}

// ── Rollups ──────────────────────────────────────────────────────────────────

export interface VerdictCounts {
  total: number
  reaching: number
  on_target: number
  underselling: number
  unknown: number
}

export function emptyCounts(): VerdictCounts {
  return { total: 0, reaching: 0, on_target: 0, underselling: 0, unknown: 0 }
}

export function countVerdicts(verdicts: ApplyFitVerdict[]): VerdictCounts {
  const c = emptyCounts()
  for (const v of verdicts) {
    c.total++
    c[v]++
  }
  return c
}

/** Share of the classified (non-unknown) applications; 0 when none are classified. */
export function shareOf(c: VerdictCounts, v: Exclude<ApplyFitVerdict, 'unknown'>): number {
  const known = c.total - c.unknown
  return known === 0 ? 0 : c[v] / known
}

// The years histogram groups applications by the shared rule's bands, so it
// reads the same way the verdicts do.
export const YEARS_GAP_BINS = ['Far short', 'Stretch', 'In line', 'Overqualified'] as const
export type YearsGapBin = (typeof YEARS_GAP_BINS)[number]

export function yearsGapBin(fit: YearsFit): YearsGapBin | null {
  if (fit === 'big_under') return 'Far short'
  if (fit === 'under') return 'Stretch'
  if (fit === 'within') return 'In line'
  if (fit === 'over') return 'Overqualified'
  return null
}

export const SENIORITY_ORDER: SeniorityFit[] = ['big_down', 'down', 'same', 'up', 'big_up', 'unknown']

export interface ClassifiedApplication {
  candidateId: string
  memberLevel: string | null
  memberFunction: string | null
  result: ApplyFitResult
}

export interface ApplyFitAggregate {
  overall: VerdictCounts
  byLevel: { key: string; counts: VerdictCounts }[]
  byFunction: { key: string; counts: VerdictCounts }[]
  yearsGap: { bin: YearsGapBin; count: number }[]
  /** Applications whose job states a parseable years requirement (and the member's years are known). */
  yearsKnown: number
  seniority: { step: SeniorityFit; count: number }[]
  members: MemberFitRow[]
}

export interface MemberFitRow {
  candidateId: string
  counts: VerdictCounts
  reachingShare: number
  undersellingShare: number
}

function groupCounts(rows: ClassifiedApplication[], keyOf: (r: ClassifiedApplication) => string) {
  const map = new Map<string, VerdictCounts>()
  for (const r of rows) {
    const key = keyOf(r)
    const c = map.get(key) ?? emptyCounts()
    c.total++
    c[r.result.verdict]++
    map.set(key, c)
  }
  return [...map.entries()].map(([key, counts]) => ({ key, counts })).sort((a, b) => b.counts.total - a.counts.total)
}

export function aggregateApplicationFit(
  rows: ClassifiedApplication[],
  opts: { sortMembersBy?: 'reaching' | 'underselling'; minSample?: number } = {},
): ApplyFitAggregate {
  const minSample = opts.minSample ?? MIN_MEMBER_SAMPLE
  const overall = countVerdicts(rows.map((r) => r.result.verdict))

  const binCounts = new Map<YearsGapBin, number>(YEARS_GAP_BINS.map((b) => [b, 0]))
  let yearsKnown = 0
  for (const r of rows) {
    const bin = yearsGapBin(r.result.years.fit)
    if (bin === null) continue
    yearsKnown++
    binCounts.set(bin, binCounts.get(bin)! + 1)
  }
  const senCounts = new Map<SeniorityFit, number>(SENIORITY_ORDER.map((s) => [s, 0]))
  for (const r of rows) senCounts.set(r.result.seniority, senCounts.get(r.result.seniority)! + 1)

  const members = groupCounts(rows, (r) => r.candidateId)
    .filter((m) => m.counts.total - m.counts.unknown >= minSample)
    .map((m) => ({
      candidateId: m.key,
      counts: m.counts,
      reachingShare: shareOf(m.counts, 'reaching'),
      undersellingShare: shareOf(m.counts, 'underselling'),
    }))
  const sortKey = opts.sortMembersBy === 'underselling' ? 'undersellingShare' : 'reachingShare'
  members.sort((a, b) => b[sortKey] - a[sortKey] || b.counts.total - a.counts.total)

  return {
    overall,
    byLevel: groupCounts(rows, (r) => r.memberLevel ?? 'Not set'),
    byFunction: groupCounts(rows, (r) => r.memberFunction ?? 'Not set'),
    yearsGap: YEARS_GAP_BINS.map((bin) => ({ bin, count: binCounts.get(bin)! })),
    yearsKnown,
    seniority: SENIORITY_ORDER.map((step) => ({ step, count: senCounts.get(step)! })),
    members,
  }
}

// ── Coaching line ────────────────────────────────────────────────────────────

/**
 * One line for an admin/coach about a member's pattern. Never shown to the
 * member. `results` are that member's classified applications.
 */
export function coachingSuggestion(results: ApplyFitResult[], isPivoting: boolean): string {
  const n = results.length
  const known = results.filter((r) => r.verdict !== 'unknown')
  if (n === 0) return 'No applications to read yet.'
  if (known.length < MIN_MEMBER_SAMPLE) {
    return known.length === 0
      ? `None of their ${n} applications name a level or years we can compare — nothing to read yet.`
      : `Only ${known.length} of ${n} applications can be compared so far — too few to call a pattern.`
  }
  const k = known.length
  const bigUp = known.filter((r) => r.seniority === 'big_up').length
  const reaching = known.filter((r) => r.verdict === 'reaching').length
  const yearsReach = known.filter((r) => r.years.fit === 'big_under').length
  const underselling = known.filter((r) => r.verdict === 'underselling').length
  const below = known.filter((r) => r.seniority === 'down' || r.seniority === 'big_down').length

  if (reaching / k >= 0.5) {
    if (bigUp >= yearsReach) {
      return `${bigUp} of ${k} applications are 2+ levels up — suggest adding stretch-appropriate roles (one level up).`
    }
    return `${yearsReach} of ${k} applications ask for more than twice their years — lead with scope and results, and add roles nearer their tenure.`
  }
  if (underselling / k >= 0.5) {
    return `Applying mostly below level (${underselling} of ${k}) — confidence/positioning conversation.`
  }
  if (below / k >= 0.6) {
    return isPivoting
      ? `${below} of ${k} applications are a step down, consistent with their pivot — confirm the step down is deliberate.`
      : `${below} of ${k} applications are a step below their level — worth asking whether that's deliberate.`
  }
  return `Applications mostly match their level and experience (${k - reaching - underselling} of ${k} on target) — no change needed.`
}
