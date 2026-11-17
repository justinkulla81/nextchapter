// Employers' jobs, pure parts: the organization reviews each job an approved employer posts before NextChapter's own review.
// Status flow for a job an employer posts to a workforce organization: org_pending (the organization reviews) → pending (NextChapter
// reviews) → approved, or rejected with a reason at either step. No database here.

export const ORG_PENDING = 'org_pending'
export const REASON_MAX = 200

export const cleanReason = (raw: string) => raw.replace(/\s+/g, ' ').trim().slice(0, REASON_MAX)

/** What an employer sees for its own job. */
export function employerRoleStatusLabel(status: string, orgName: string): string {
  if (status === ORG_PENDING) return `Waiting for ${orgName} to review`
  if (status === 'pending') return 'In review at NextChapter'
  if (status === 'approved') return 'Live'
  if (status === 'rejected') return 'Not approved'
  return status
}

/** A decline has to say why, so the employer knows what to change. Returns the error, or null when the decision can be made. */
export function declineBlocked(reason: string): string | null {
  return cleanReason(reason) ? null : 'Say why you are declining, so the employer knows what to change.'
}

/** Hours a job has waited for the organization's review. */
export const hoursWaiting = (createdAt: Date, now = new Date()) => Math.max(0, Math.round((+now - +createdAt) / 3_600_000))

export const waitedLabel = (hours: number) => (hours < 24 ? 'today' : `${Math.floor(hours / 24)} day${Math.floor(hours / 24) === 1 ? '' : 's'} ago`)
