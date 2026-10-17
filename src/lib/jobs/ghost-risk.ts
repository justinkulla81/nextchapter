// Is this job probably not a real, current opening? Pure — no database — so the
// rules are unit-tested (src/test/ghost-risk.test.ts).
//
// "Ghost" jobs are listings an employer keeps up without a real hire in mind:
// evergreen postings, pipeline-building, or roles reposted again and again. We
// can't see intent, so this reads only what the board itself can show:
//   - the same role at the same company has been posted and CLOSED before
//     (repeatedly = an evergreen listing, not a one-off opening);
//   - it has been open a long time without closing.
//
// What it deliberately does NOT treat as a ghost: the same title open in many
// places at once. A retailer with "Sales Manager" in 46 stores has 46 real
// openings, not one fake one.
//
// 'likely' is kept off the board and out of rankings; 'watch' stays visible but is
// not given freshness credit. Nothing is deleted.

export type GhostLevel = 'none' | 'watch' | 'likely'

export interface GhostInput {
  /** How many times this company + title was posted and then closed before this posting. */
  priorClosedCount: number
  /** Days since this posting was first seen. */
  ageDays: number
  /** Members who passed on it as a ghost job or too good to be true (JobPostingFlag). Raises 'watch' only. */
  memberFlags?: number
  /** An admin confirmed member ghost flags on /support/admin/job-flags. */
  adminConfirmed?: boolean
}

export interface GhostVerdict {
  level: GhostLevel
  reason: string | null
}

export const LIKELY_PRIOR_CLOSURES = 2
export const WATCH_AGE_DAYS = 60
export const LIKELY_AGE_DAYS = 90

/**
 * This many member flags queue a posting for admin review (owner's rule, 2026-10-16). Member
 * flags alone never hide a job for anyone else — the flagger's own dismissal hides it for
 * them; everyone else stops seeing it only when an admin confirms, or when our own signals
 * below already say 'likely'.
 */
export const REVIEW_MEMBER_FLAGS = 2

export function ghostRisk({ priorClosedCount, ageDays, memberFlags = 0, adminConfirmed = false }: GhostInput): GhostVerdict {
  if (adminConfirmed) return { level: 'likely', reason: 'Confirmed as a ghost job after members flagged it' }
  if (priorClosedCount >= LIKELY_PRIOR_CLOSURES) {
    return { level: 'likely', reason: `Posted and closed ${priorClosedCount} times before — looks like an evergreen listing` }
  }
  if (ageDays > LIKELY_AGE_DAYS) {
    return { level: 'likely', reason: `Open for ${Math.floor(ageDays)} days without closing` }
  }
  // Either signal alone is worth watching (owner's rule, 2026-10-14).
  if (priorClosedCount === 1) {
    return { level: 'watch', reason: 'Closed and reposted once before' }
  }
  if (ageDays > WATCH_AGE_DAYS) {
    return { level: 'watch', reason: `Open for ${Math.floor(ageDays)} days` }
  }
  if (memberFlags >= 1) {
    return { level: 'watch', reason: `${memberFlags === 1 ? 'A member' : `${memberFlags} members`} flagged it as a ghost job or too good to be true` }
  }
  return { level: 'none', reason: null }
}

// Per location, on purpose: a chain whose store-level roles close and reopen all the
// time has not reposted the SAME opening. Only the same role at the same place
// coming back counts.
export function repostKey(companyName: string, title: string, location: string | null): string {
  const norm = (v: string) => v.trim().toLowerCase().replace(/\s+/g, ' ')
  return `${norm(companyName)}|${norm(title)}|${norm(location ?? '')}`
}
