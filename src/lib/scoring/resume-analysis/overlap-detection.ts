// Shared "do these two roles overlap in a way that's actually a problem"
// primitive — was independently reimplemented, identically, in both
// modifiers.ts's computeReconciliation (feeds the Market Reality Grade's
// overlapping_full_time penalty) and reviewer-questions.ts's OVERLAPPING_ROLES
// detection (feeds the Guided Resume Walkthrough). Both now call this one
// function so the Market Reality Grade and the Guided Walkthrough can never
// silently drift apart on which overlaps count.
//
// A concurrent board seat, advisor, or non-employee director role next to a
// primary full-time job is normal and expected — the primary job is simply
// dominant, and flagging the overlap as a defect would penalize candidates
// for something that isn't actually a red flag. A "Consultant" title
// overlapping a full-time job is a different situation and IS flagged: it's
// exactly the shape of a gap-filling euphemism or a double-counted stretch
// of time a reviewer would reasonably question. So this pattern is
// deliberately narrower than resolve-contextual-level.ts's ADVISOR_PATTERN
// (which groups advisor/consultant together for seniority-calibration
// purposes) — the two patterns answer different questions and are not
// interchangeable.
const OVERLAP_EXEMPT_TITLE_PATTERN =
  /\b(board member|board seat|board director|board of directors|non-executive director|independent director|advisor|adviser)\b/i

const OVERLAP_THRESHOLD_MS = 1000 * 60 * 60 * 24 * 30 // ~30 days — short overlaps are normal handoff periods, not a red flag

export interface DatedRoleInput {
  title: string
  company: string
  startDate: string | null
  endDate: string | null
  isCurrent: boolean
  isInternship: boolean
}

export interface OverlappingRolePair {
  earlier: { title: string; company: string }
  later: { title: string; company: string }
}

// Internships are excluded entirely — a summer internship overlapping
// school or another internship isn't the "two claimed full-time
// commitments at once" situation this exists to catch.
export function detectOverlappingRolePairs(roles: DatedRoleInput[]): OverlappingRolePair[] {
  const dated = roles
    .filter((r) => r.startDate && !r.isInternship)
    .map((r) => ({
      title: r.title,
      company: r.company,
      start: new Date(r.startDate as string).getTime(),
      end: r.isCurrent || !r.endDate ? Date.now() : new Date(r.endDate).getTime(),
    }))
    .sort((a, b) => a.start - b.start)

  const pairs: OverlappingRolePair[] = []
  for (let i = 1; i < dated.length; i++) {
    if (dated[i].start >= dated[i - 1].end - OVERLAP_THRESHOLD_MS) continue

    const eitherIsLegitimateSecondary =
      OVERLAP_EXEMPT_TITLE_PATTERN.test(dated[i].title) || OVERLAP_EXEMPT_TITLE_PATTERN.test(dated[i - 1].title)
    if (eitherIsLegitimateSecondary) continue

    pairs.push({
      earlier: { title: dated[i - 1].title, company: dated[i - 1].company },
      later: { title: dated[i].title, company: dated[i].company },
    })
  }
  return pairs
}
