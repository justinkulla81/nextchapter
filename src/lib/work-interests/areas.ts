// Work Interests (spec module 5) — the six Holland RIASEC areas and the
// pure scoring for the O*NET Interest Profiler short form (60 items, each
// answered 1 = strongly dislike … 5 = strongly like; 10 items per area).

export type InterestArea =
  | 'REALISTIC'
  | 'INVESTIGATIVE'
  | 'ARTISTIC'
  | 'SOCIAL'
  | 'ENTERPRISING'
  | 'CONVENTIONAL'

export const INTEREST_AREA_ORDER: InterestArea[] = [
  'REALISTIC',
  'INVESTIGATIVE',
  'ARTISTIC',
  'SOCIAL',
  'ENTERPRISING',
  'CONVENTIONAL',
]

export const INTEREST_AREA_LABELS: Record<InterestArea, string> = {
  REALISTIC: 'Realistic',
  INVESTIGATIVE: 'Investigative',
  ARTISTIC: 'Artistic',
  SOCIAL: 'Social',
  ENTERPRISING: 'Enterprising',
  CONVENTIONAL: 'Conventional',
}

export const INTEREST_AREA_BLURBS: Record<InterestArea, string> = {
  REALISTIC: 'Hands-on, practical work with tools, machines, or the physical world.',
  INVESTIGATIVE: 'Analyzing, researching, and working through complex problems.',
  ARTISTIC: 'Creative, open-ended work where you make something original.',
  SOCIAL: 'Helping, teaching, and working directly with people.',
  ENTERPRISING: 'Leading, persuading, and driving business outcomes.',
  CONVENTIONAL: 'Organized, detail-driven work with clear structure and rules.',
}

export const INTEREST_ANSWER_LABELS: Record<number, string> = {
  1: 'Strongly dislike',
  2: 'Dislike',
  3: 'Unsure',
  4: 'Like',
  5: 'Strongly like',
}

export type InterestQuestion = { index: number; area: InterestArea; text: string }
export type InterestAnswer = { index: number; answer: number }
export type InterestScores = Record<InterestArea, number>

export const INTEREST_QUESTION_COUNT = 60

/**
 * Sums answers per area and returns the top three areas (highest first).
 * Ties break in RIASEC order so the result is deterministic. Returns null
 * unless every question has exactly one valid 1-5 answer.
 */
export function scoreInterests(
  questions: readonly InterestQuestion[],
  answers: readonly InterestAnswer[]
): { scores: InterestScores; topAreas: InterestArea[] } | null {
  const byIndex = new Map<number, number>()
  for (const a of answers) {
    if (!Number.isInteger(a.answer) || a.answer < 1 || a.answer > 5) return null
    byIndex.set(a.index, a.answer)
  }
  const scores: InterestScores = {
    REALISTIC: 0,
    INVESTIGATIVE: 0,
    ARTISTIC: 0,
    SOCIAL: 0,
    ENTERPRISING: 0,
    CONVENTIONAL: 0,
  }
  for (const q of questions) {
    const answer = byIndex.get(q.index)
    if (answer === undefined) return null
    scores[q.area] += answer
  }
  const topAreas = [...INTEREST_AREA_ORDER]
    .sort((a, b) => scores[b] - scores[a])
    .slice(0, 3)
  return { scores, topAreas }
}
