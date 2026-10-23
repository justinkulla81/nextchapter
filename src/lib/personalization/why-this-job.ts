// "Why this job" on a board card: up to three short reasons it fits and one honest gap, in one
// line — merged from what the card used to stack (the breadth reason label, the ring notes,
// the bridge's "what transfers"). Pure: src/test/personalization.test.ts.

import type { JobCriteria } from '@/lib/jobs/relevance'
import type { MatchReason } from '@/lib/jobs/search-breadth'

export interface WhyThisJob {
  /** Why the fit is lower in an area the member widened to (search-scope.ts widenedFitNote); shown on its own line. */
  lowerFit?: string | null
  fits: string[]
  gap: string | null
}

export const MAX_FITS = 3

/** Lower-case a label's first letter for the middle of a line, unless it is an acronym ("IT", "HR"). */
function inLine(s: string): string {
  return /^[A-Z][A-Z&]/.test(s) ? s : s.charAt(0).toLowerCase() + s.slice(1)
}

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
  /** The job's level against theirs (job-card.ts levelPhrase): "your level", "one level up". */
  level?: string | null
  /**
   * Their field by name ("Finance", "FP&A"), said instead of the generic "Your field" label;
   * without it a job in their field says nothing about the field rather than "Your field".
   */
  field?: string | null
}): WhyThisJob {
  const fits: string[] = []
  const add = (s: string | null | undefined) => {
    const v = s ? inLine(s) : null
    if (v && !fits.includes(v)) fits.push(v)
  }
  // Seniority first, then the field by name, then whatever brought a ring job in, then place,
  // skills and industry — the most member-specific reasons win the three slots.
  add(input.level)
  // The breadth label ("Your field", "Pivot: …", "Skills match: …"); ring notes it carries ("45 mi away") come along.
  const [lead, ...notes] = (input.reason?.label ?? '').split(' · ').filter(Boolean)
  add(lead === 'Your field' ? input.field : lead)
  for (const n of notes) add(n)
  if (input.crit?.geo === 0) add(input.jobRemote ? 'Remote' : input.city ? `Near ${input.city}` : null)
  const skills = input.have.slice(0, 2)
  if (skills.length > 0 && input.reason?.kind !== 'skills') add(`Uses ${skills.join(', ')}`)
  if (input.hasIndustries && input.crit?.industry === 'own' && input.crit.industryName) add(`In ${input.crit.industryName}`)
  const gap = input.blocker ?? input.bridgeGap ?? (input.missing[0] ? `asks for ${input.missing[0]}` : null)
  return { fits: fits.slice(0, MAX_FITS), gap }
}
