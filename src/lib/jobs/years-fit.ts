// The one rule for "does a member's years of experience fit a job's stated
// years?" — used by fit scoring v2 (job-fit-bucket.ts yearsBonus), the job
// match skills dimension and its coaching line (job-match.ts), and the admin
// application-fit page (application-fit.ts). Pure; tested in
// src/test/years-fit.test.ts.
//
// Justin's rule: don't be strict about years. Roughly in line is fine — 6
// against "8-15" is fine, 2 against "8-15" is not.
//
//   in line        member >= min - tolerance, tolerance = max(2, round(min × 0.25))
//                  (+1 for a "preferred" / "or equivalent" requirement).
//                  6 vs 8 and 4 vs 5 are in line. Being over the range is in
//                  line too, unless overqualified (below).
//   stretch        short by more than the tolerance but still at least half
//                  the minimum (4 vs 8). A mild penalty.
//   far            under half the minimum (2 vs 8-15). The only real mismatch:
//                  the real penalty, and "reaching" in admin.
//   overqualified  member >= min + 8 AND more than twice the stated max (twice
//                  the min when there's no max). 15 against "10+" is not.

import { parseYearsRequired, type YearsRequirement } from './years-required'

export type YearsFitBand = 'in_line' | 'stretch' | 'far' | 'overqualified' | 'unknown'

export interface YearsRange {
  min: number
  /** Top of a stated range; null for "5+" / "at least 5". */
  max: number | null
  /** "preferred" / "or equivalent" — one more year of tolerance. */
  soft?: boolean
}

export interface YearsFitRead {
  band: YearsFitBand
  /** Years under the minimum (0 when at or above it). Null when unknown. */
  short: number | null
  /** Years over the top of the range (the minimum when there's no top); 0 when not over. Null when unknown. */
  over: number | null
}

export const YEARS_FIT_RULE = {
  /** Shortfall always tolerated, in years. */
  minTolerance: 2,
  /** …or this share of the minimum, whichever is larger. */
  toleranceShare: 0.25,
  /** Extra tolerance for a "preferred" / "or equivalent" requirement. */
  softSlack: 1,
  /** Under this share of the minimum = far off. */
  farShare: 0.5,
  /** Overqualified needs at least this many years over the minimum… */
  overMinYears: 8,
  /** …and more than this multiple of the max (or the min when no max). */
  overMultiple: 2,
} as const

/** Shortfall that still reads as in line. */
export function yearsTolerance(min: number, soft = false): number {
  return Math.max(YEARS_FIT_RULE.minTolerance, Math.round(min * YEARS_FIT_RULE.toleranceShare)) + (soft ? YEARS_FIT_RULE.softSlack : 0)
}

/**
 * Full parse (years-required.ts): "8-15 years" → {8, 15}; "5+ years" → {5,
 * null}; knows "preferred" / "or equivalent" and skips "founded 25 years
 * ago". Null when the text states no years. ~0.1 ms per long description, so
 * the board scorers use quickYearsRange instead.
 */
export function parseYearsRange(text: string | null | undefined): YearsRange | null {
  return yearsRangeOf(parseYearsRequired(text))
}

// "5+ years of experience", "8-15 years of finance experience", "3 to 5 yrs
// relevant experience" — a number tied to the word "experience" within a few
// words. The first such phrase wins.
const QUICK_YEARS =
  /\b(\d{1,2})\s*(?:\+|(?:-|–|—|to)\s*(\d{1,2}))?\s*\+?\s*(?:years?|yrs?)\b(?:\s+of)?(?:\s+[\w-]+){0,4}?\s+experience/i

/**
 * Cheap one-regex parse for hot paths (board fit scoring runs over every
 * posting): same {min, max} shape as parseYearsRange, without the
 * preferred / or-equivalent reading.
 */
export function quickYearsRange(text: string | null | undefined): YearsRange | null {
  if (!text) return null
  const m = text.match(QUICK_YEARS)
  if (!m) return null
  let min = parseInt(m[1], 10)
  let max = m[2] !== undefined ? parseInt(m[2], 10) : null
  if (max !== null && max < min) [min, max] = [max, min]
  if (max !== null && max === min) max = null
  if (!(min >= 1 && min <= 30) || (max !== null && max > 40)) return null
  return { min, max }
}

export function yearsRangeOf(req: YearsRequirement | null | undefined): YearsRange | null {
  if (!req) return null
  return { min: req.min, max: req.max, soft: req.strength === 'preferred' || req.orEquivalent }
}

export function assessYearsFit(memberYears: number | null | undefined, range: YearsRange | null | undefined): YearsFitRead {
  if (memberYears === null || memberYears === undefined || !range || !(range.min > 0)) return { band: 'unknown', short: null, over: null }
  const { min, max } = range
  const short = Math.max(0, min - memberYears)
  const over = Math.max(0, memberYears - (max ?? min))

  if (memberYears < min - yearsTolerance(min, range.soft)) {
    return { band: memberYears < min * YEARS_FIT_RULE.farShare ? 'far' : 'stretch', short, over }
  }
  const overqualified = memberYears >= min + YEARS_FIT_RULE.overMinYears && memberYears > YEARS_FIT_RULE.overMultiple * (max ?? min)
  return { band: overqualified ? 'overqualified' : 'in_line', short, over }
}

/** "8–15 years" / "5+ years", for evidence lines. */
export function formatYearsRange(r: YearsRange): string {
  return r.max !== null ? `${r.min}–${r.max} years` : `${r.min}+ years`
}
