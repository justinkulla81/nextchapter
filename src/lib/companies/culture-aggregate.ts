import {
  CULTURE_DIMENSIONS,
  CULTURE_MIN_RESPONDENTS,
  cleanCultureAnswers,
  type CultureDimensionKey,
} from '@/lib/companies/culture-survey'

// Aggregation for the insider culture survey — pure, so the privacy rules are unit
// tested (src/test/company-culture.test.ts). The loader in culture-profile.ts feeds it
// rows straight from the database; nothing else reads CompanyCultureResponse for display.
//
// Privacy rules enforced here:
// - Aggregate only. The output carries shares and a mean per question — never a
//   respondent id, never one person's answers, never current/former breakdowns.
// - k-anonymity: a profile is shown only when at least CULTURE_MIN_RESPONDENTS members
//   OTHER THAN THE VIEWER answered. The viewer's own row is dropped first, so a member
//   who answered can't subtract their answer from the totals to read the others'.
// - Each question also needs CULTURE_MIN_RESPONDENTS answers of its own; a question
//   most people skipped is left out rather than shown from one or two people.
// - Rows flagged `excluded` (Confidential Search Mode, STEALTH tier, system and sample
//   accounts — decided by the loader) never count, not even toward the "N of 3" count.

export interface CultureResponseRow {
  candidateId: string
  answers: unknown
  /** Privacy-excluded respondent: never counted. */
  excluded: boolean
}

export interface CultureDimensionAggregate {
  key: CultureDimensionKey
  /** Members who answered this question. */
  answered: number
  /** Whole-number percentage per option (1, 2, 3); sums to 100. */
  shares: [number, number, number]
  /** Mean on the 1..3 scale — used by the match, never rendered. */
  mean: number
  /** The option at least half chose, or null when views are split. */
  typical: 1 | 2 | 3 | null
}

export interface CultureProfile {
  companyId: string
  /** Distinct eligible respondents besides the viewer. */
  respondentCount: number
  /** True only at or above the privacy floor. */
  shown: boolean
  /** Empty unless shown. */
  dimensions: CultureDimensionAggregate[]
}

/** Largest-remainder rounding so the three shares add to exactly 100. */
function percentages(counts: [number, number, number]): [number, number, number] {
  const total = counts[0] + counts[1] + counts[2]
  const raw = counts.map((c) => (c / total) * 100)
  const floor = raw.map(Math.floor)
  let left = 100 - floor.reduce((a, b) => a + b, 0)
  const order = raw.map((r, i) => ({ i, rem: r - Math.floor(r) })).sort((a, b) => b.rem - a.rem)
  for (const { i } of order) {
    if (left <= 0) break
    floor[i]++
    left--
  }
  return floor as [number, number, number]
}

export function aggregateCulture(companyId: string, rows: CultureResponseRow[], viewerCandidateId: string | null): CultureProfile {
  const byCandidate = new Map<string, Partial<Record<CultureDimensionKey, number>>>()
  for (const r of rows) {
    if (r.excluded || r.candidateId === viewerCandidateId) continue
    const clean = cleanCultureAnswers(r.answers)
    if (Object.keys(clean).length === 0) continue
    byCandidate.set(r.candidateId, clean) // one response per member — the table's unique key, re-enforced here
  }
  const respondentCount = byCandidate.size
  if (respondentCount < CULTURE_MIN_RESPONDENTS) return { companyId, respondentCount, shown: false, dimensions: [] }

  const answers = [...byCandidate.values()]
  const dimensions: CultureDimensionAggregate[] = []
  for (const d of CULTURE_DIMENSIONS) {
    const counts: [number, number, number] = [0, 0, 0]
    for (const a of answers) {
      const v = a[d.key]
      if (v) counts[v - 1]++
    }
    const answered = counts[0] + counts[1] + counts[2]
    if (answered < CULTURE_MIN_RESPONDENTS) continue
    const mean = (counts[0] * 1 + counts[1] * 2 + counts[2] * 3) / answered
    const top = counts.indexOf(Math.max(...counts))
    const typical = counts[top] * 2 >= answered && counts.filter((c) => c === counts[top]).length === 1 ? ((top + 1) as 1 | 2 | 3) : null
    dimensions.push({ key: d.key, answered, shares: percentages(counts), mean: Math.round(mean * 100) / 100, typical })
  }
  return { companyId, respondentCount, shown: dimensions.length > 0, dimensions }
}
