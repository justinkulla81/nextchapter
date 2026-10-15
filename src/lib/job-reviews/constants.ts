// Past-job reviews and parallel paths: the options, and the cleaners that keep only
// known values. Pure and client-safe — the form, the server action and the tests all
// read this one definition. Structured answers only (no free text), so nothing needs
// moderation and nothing can name a person.

export const HIRED_VIA = [
  { value: 'JOB_BOARD', label: 'A job board' },
  { value: 'DIRECT_APPLY', label: 'Applied on their site' },
  { value: 'REFERRAL', label: 'Employee referral' },
  { value: 'NETWORK_OUTREACH', label: 'Reached out to my network' },
  { value: 'RECRUITER', label: 'A recruiter found me' },
  { value: 'INTERNAL_MOVE', label: 'Moved up or over internally' },
  { value: 'OTHER', label: 'Something else' },
] as const

export const WORKER_TYPES = [
  { value: 'W2', label: 'W-2 employee' },
  { value: 'CONTRACT_1099', label: '1099 contractor' },
  { value: 'OTHER', label: 'Other or not sure' },
] as const

export const WOULD_RECOMMEND = [
  { value: 'YES', label: 'Yes' },
  { value: 'DEPENDS', label: 'Depends on the team' },
  { value: 'NO', label: 'No' },
] as const

export const RATING_VALUES = [1, 2, 3, 4, 5] as const

// Used for both "what I liked" and "what I didn't".
export const REVIEW_TOPICS = [
  { value: 'MANAGER', label: 'My manager' },
  { value: 'TEAM', label: 'The team' },
  { value: 'LEADERSHIP', label: 'Senior leadership' },
  { value: 'PAY', label: 'Pay' },
  { value: 'BENEFITS', label: 'Benefits' },
  { value: 'FLEXIBILITY', label: 'Flexibility' },
  { value: 'GROWTH', label: 'Room to grow' },
  { value: 'MISSION', label: 'The mission' },
  { value: 'WORK', label: 'The work itself' },
  { value: 'STABILITY', label: 'Stability' },
] as const

export const PARALLEL_PATHS = [
  { value: 'CONTRACT_1099', label: '1099 contract work' },
  { value: 'FRACTIONAL', label: 'Fractional or interim role' },
  { value: 'CONSULTING', label: 'Consulting or freelance' },
  { value: 'OWN_BUSINESS', label: 'Building my own business' },
  { value: 'PART_TIME', label: 'A part-time or W-2 job' },
  { value: 'TRAINING', label: 'School or training' },
] as const

export type ReviewInput = {
  hiredVia: string | null
  workerType: string | null
  employerRating: number | null
  wouldRecommend: string | null
  liked: string[]
  disliked: string[]
}

const one = (options: readonly { value: string }[], v: unknown): string | null =>
  typeof v === 'string' && options.some((o) => o.value === v) ? v : null

const many = (options: readonly { value: string }[], v: unknown): string[] =>
  Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === 'string' && options.some((o) => o.value === x)))] : []

/** Keep only known values. A topic can't be both liked and disliked: if it arrives in both, it stays under liked. */
export function cleanReview(input: unknown): ReviewInput {
  const r = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>
  const liked = many(REVIEW_TOPICS, r.liked)
  return {
    hiredVia: one(HIRED_VIA, r.hiredVia),
    workerType: one(WORKER_TYPES, r.workerType),
    employerRating: (RATING_VALUES as readonly unknown[]).includes(r.employerRating) ? (r.employerRating as number) : null,
    wouldRecommend: one(WOULD_RECOMMEND, r.wouldRecommend),
    liked,
    disliked: many(REVIEW_TOPICS, r.disliked).filter((t) => !liked.includes(t)),
  }
}

export const answeredCount = (r: ReviewInput): number =>
  [r.hiredVia, r.workerType, r.employerRating, r.wouldRecommend].filter((v) => v !== null).length + (r.liked.length > 0 ? 1 : 0) + (r.disliked.length > 0 ? 1 : 0)

export function cleanParallelPaths(input: unknown): string[] {
  return many(PARALLEL_PATHS, input)
}
