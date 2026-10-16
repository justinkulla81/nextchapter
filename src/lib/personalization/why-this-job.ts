// "Why this job" on a board card: up to three short reasons it fits and one honest gap, in one
// line — merged from what the card used to stack (the breadth reason label, the ring notes,
// the bridge's "what transfers"). Pure: src/test/personalization.test.ts.

import type { JobCriteria } from '@/lib/jobs/relevance'
import type { MatchReason } from '@/lib/jobs/search-breadth'

export interface WhyThisJob {
  fits: string[]
  gap: string | null
}

export const MAX_FITS = 3

export function whyThisJob(input: {
  reason?: MatchReason
  crit?: JobCriteria | null
  jobRemote: boolean
  /** Their city, when matching placed it on the map. */
  city: string | null
  /** They have industries on file (else every industry reads as theirs, which says nothing). */
  hasIndustries: boolean
  /** Posting skills they show (job-skill-gap.ts have), and those it asks that they don't (missing). */
  have: string[]
  missing: string[]
  /** A hard requirement they don't meet (requirements.ts blocker label). */
  blocker?: string | null
  /** A bridge job's first gap (relevance.ts buildBridge), when it is one. */
  bridgeGap?: string | null
}): WhyThisJob {
  const fits: string[] = []
  const add = (s: string | null | undefined) => {
    if (s && !fits.includes(s)) fits.push(s)
  }
  // The breadth label first ("Your field", "Pivot: …", "Skills match: …"); ring notes it carries ("45 mi away") come along.
  const [lead, ...notes] = (input.reason?.label ?? '').split(' · ').filter(Boolean)
  add(lead)
  const skills = input.have.slice(0, 2)
  if (skills.length > 0 && input.reason?.kind !== 'skills') add(`Uses ${skills.join(', ')}`)
  for (const n of notes) add(n)
  if (input.crit?.geo === 0) add(input.jobRemote ? 'Remote' : input.city ? `Near ${input.city}` : null)
  if (input.hasIndustries && input.crit?.industry === 'own' && input.crit.industryName) add(`In ${input.crit.industryName}`)
  const gap = input.blocker ?? input.bridgeGap ?? (input.missing[0] ? `asks for ${input.missing[0]}` : null)
  return { fits: fits.slice(0, MAX_FITS), gap }
}
