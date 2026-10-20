// "Where do your searches usually stall?" One question, asked in onboarding once
// the member has applied (src/components/onboarding/LocationForm.tsx), answered in
// one pick. It tells the Market Reality Report which of the three readers is
// actually losing the member (evaluators.ts), so the advice goes to the right place.

export const SEARCH_STALL_POINTS = ['NO_REPLIES', 'RECRUITER_SCREEN', 'HIRING_MANAGER', 'FINAL_ROUND', 'OFFER'] as const
export type SearchStallPoint = (typeof SEARCH_STALL_POINTS)[number]

export const SEARCH_STALL_OPTIONS: { value: SearchStallPoint; label: string }[] = [
  { value: 'NO_REPLIES', label: 'Applications get no reply' },
  { value: 'RECRUITER_SCREEN', label: 'I get a recruiter screen, then it stops' },
  { value: 'HIRING_MANAGER', label: 'I reach the hiring manager, then it stops' },
  { value: 'FINAL_ROUND', label: 'I reach the final round, then it stops' },
  { value: 'OFFER', label: 'I get to the offer stage' },
]

export function parseSearchStallPoint(v: unknown): SearchStallPoint | null {
  return typeof v === 'string' && (SEARCH_STALL_POINTS as readonly string[]).includes(v) ? (v as SearchStallPoint) : null
}

/** Which reader the stall points at, in the report's terms. */
export const STALL_READER: Record<SearchStallPoint, 'recruiter' | 'hiring_manager' | 'executive_recruiter' | 'offer'> = {
  NO_REPLIES: 'recruiter',
  RECRUITER_SCREEN: 'recruiter',
  HIRING_MANAGER: 'hiring_manager',
  FINAL_ROUND: 'executive_recruiter',
  OFFER: 'offer',
}

/** How the report says it: what the member told us, and what that points at. */
export const STALL_TEXT: Record<SearchStallPoint, { told: string; points: string }> = {
  NO_REPLIES: { told: 'applications mostly go unanswered', points: 'the first screen: the resume, the target line and how software reads the file' },
  RECRUITER_SCREEN: { told: 'you reach a recruiter screen and it stops', points: 'the recruiter conversation: your story, your reasons for moving and your answers on stability and pay' },
  HIRING_MANAGER: { told: 'you reach the hiring manager and it stops', points: 'the hiring manager: proof of scope and results' },
  FINAL_ROUND: { told: 'you reach the final round and it stops', points: 'the final decision: references, leadership presence and fit' },
  OFFER: { told: 'you get as far as an offer', points: 'negotiation, not the search itself' },
}
