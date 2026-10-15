import { CULTURE_MIN_RESPONDENTS } from '@/lib/companies/culture-survey'
import { HIRED_VIA, REVIEW_TOPICS, WORKER_TYPES, WOULD_RECOMMEND, cleanReview, type ReviewInput } from '@/lib/job-reviews/constants'

// Combined past-job reviews for one company — pure, so the privacy rules are unit
// tested (src/test/job-reviews.test.ts). Same rules as the culture survey
// (culture-aggregate.ts), same floor:
// - Aggregate only: shares, an average and top topics. Never a member id, never one
//   person's answers.
// - Shown only when at least CULTURE_MIN_RESPONDENTS members OTHER THAN THE VIEWER
//   reviewed the company; the viewer's own row is dropped first.
// - Each section needs that many answers of its own, and a liked / didn't-like topic
//   needs at least two members behind it, so a single person's pick never shows.
// - Excluded members (Confidential Search Mode, STEALTH, system, sample — decided by
//   the loader) never count. One review per member per company: their latest.

export const REVIEW_MIN_RESPONDENTS = CULTURE_MIN_RESPONDENTS
const TOPIC_MIN_MEMBERS = 2
const TOP_TOPICS = 3

export interface ReviewRow {
  candidateId: string
  review: unknown
  updatedAt: Date
  /** Privacy-excluded respondent: never counted. */
  excluded: boolean
}

export interface Share {
  value: string
  label: string
  /** Whole-number percentage of the members who answered this question. */
  percent: number
}

export interface ReviewSummary {
  companyId: string
  /** Distinct eligible reviewers besides the viewer. */
  respondentCount: number
  shown: boolean
  /** Average employer rating (one decimal) and how many rated; null below the floor. */
  rating: { average: number; count: number } | null
  recommend: Share[] | null
  hiredVia: Share[] | null
  workerType: Share[] | null
  liked: Share[] | null
  disliked: Share[] | null
}

const EMPTY = (companyId: string, respondentCount: number): ReviewSummary => ({
  companyId,
  respondentCount,
  shown: false,
  rating: null,
  recommend: null,
  hiredVia: null,
  workerType: null,
  liked: null,
  disliked: null,
})

/** Largest-remainder rounding so the shares add to exactly 100. */
function percentages(counts: number[]): number[] {
  const total = counts.reduce((a, b) => a + b, 0)
  const raw = counts.map((c) => (c / total) * 100)
  const floor = raw.map(Math.floor)
  let left = 100 - floor.reduce((a, b) => a + b, 0)
  for (const { i } of raw.map((r, i) => ({ i, rem: r - Math.floor(r) })).sort((a, b) => b.rem - a.rem)) {
    if (left <= 0) break
    floor[i]++
    left--
  }
  return floor
}

function single(values: (string | null)[], options: readonly { value: string; label: string }[]): Share[] | null {
  const answered = values.filter((v): v is string => v !== null)
  if (answered.length < REVIEW_MIN_RESPONDENTS) return null
  const counts = options.map((o) => answered.filter((v) => v === o.value).length)
  const percent = percentages(counts)
  return options
    .map((o, i) => ({ value: o.value, label: o.label, percent: percent[i] }))
    .filter((s) => s.percent > 0)
    .sort((a, b) => b.percent - a.percent)
}

function topics(lists: string[][]): Share[] | null {
  const withAny = lists.filter((l) => l.length > 0)
  if (withAny.length < REVIEW_MIN_RESPONDENTS) return null
  const out = REVIEW_TOPICS.map((t) => ({ value: t.value, label: t.label, members: lists.filter((l) => l.includes(t.value)).length }))
    .filter((t) => t.members >= TOPIC_MIN_MEMBERS)
    .sort((a, b) => b.members - a.members)
    .slice(0, TOP_TOPICS)
    .map((t) => ({ value: t.value, label: t.label, percent: Math.round((t.members / withAny.length) * 100) }))
  return out.length > 0 ? out : null
}

export function summarizeReviews(companyId: string, rows: ReviewRow[], viewerCandidateId: string | null): ReviewSummary {
  const latest = new Map<string, { review: ReviewInput; updatedAt: Date }>()
  for (const r of rows) {
    if (r.excluded || r.candidateId === viewerCandidateId) continue
    const prev = latest.get(r.candidateId)
    if (!prev || r.updatedAt > prev.updatedAt) latest.set(r.candidateId, { review: cleanReview(r.review), updatedAt: r.updatedAt })
  }
  const reviews = [...latest.values()].map((v) => v.review)
  const respondentCount = reviews.length
  if (respondentCount < REVIEW_MIN_RESPONDENTS) return EMPTY(companyId, respondentCount)

  const ratings = reviews.map((r) => r.employerRating).filter((n): n is number => n !== null)
  const summary: ReviewSummary = {
    companyId,
    respondentCount,
    shown: true,
    rating: ratings.length >= REVIEW_MIN_RESPONDENTS ? { average: Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10, count: ratings.length } : null,
    recommend: single(reviews.map((r) => r.wouldRecommend), WOULD_RECOMMEND),
    hiredVia: single(reviews.map((r) => r.hiredVia), HIRED_VIA),
    workerType: single(reviews.map((r) => r.workerType), WORKER_TYPES),
    liked: topics(reviews.map((r) => r.liked)),
    disliked: topics(reviews.map((r) => r.disliked)),
  }
  const hasAnything = summary.rating || summary.recommend || summary.hiredVia || summary.workerType || summary.liked || summary.disliked
  return hasAnything ? summary : { ...EMPTY(companyId, respondentCount) }
}
