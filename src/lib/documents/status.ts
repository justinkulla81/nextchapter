/**
 * The requested-document lifecycle. Pure, so both portals and the tests agree on
 * who can do what at each step.
 *
 *   REQUESTED -> UPLOADED -> ACCEPTED
 *                   |
 *                   +-> NEEDS_CHANGES -> UPLOADED ...
 *   (any open status) -> CANCELLED by the requester
 */
export type DocumentStatus = 'REQUESTED' | 'UPLOADED' | 'ACCEPTED' | 'NEEDS_CHANGES' | 'CANCELLED'

export const DOCUMENT_STATUS_LABEL: Record<DocumentStatus, string> = {
  REQUESTED: 'Waiting for you',
  UPLOADED: 'Uploaded, waiting for review',
  ACCEPTED: 'Accepted',
  NEEDS_CHANGES: 'Changes requested',
  CANCELLED: 'Cancelled',
}

/** What the requester sees, which reads the other way round. */
export const REQUESTER_STATUS_LABEL: Record<DocumentStatus, string> = {
  REQUESTED: 'Waiting for the client',
  UPLOADED: 'Ready for your review',
  ACCEPTED: 'Accepted',
  NEEDS_CHANGES: 'Waiting for a new file',
  CANCELLED: 'Cancelled',
}

/** Statuses that are still in progress. Used by queries so the lists live in one place. */
export const OPEN_STATUSES: DocumentStatus[] = ['REQUESTED', 'UPLOADED', 'NEEDS_CHANGES']
/** Statuses that are waiting on the candidate (drives the nav badge). */
export const CANDIDATE_ACTION_STATUSES: DocumentStatus[] = ['REQUESTED', 'NEEDS_CHANGES']
/** Statuses in which the candidate may add or replace the file. */
export const UPLOADABLE_STATUSES: DocumentStatus[] = ['REQUESTED', 'UPLOADED', 'NEEDS_CHANGES']
/** Statuses in which the requester may cancel. */
export const CANCELLABLE_STATUSES: DocumentStatus[] = OPEN_STATUSES

export function isDocumentStatus(value: string): value is DocumentStatus {
  return value in DOCUMENT_STATUS_LABEL
}

/** The candidate can add or replace the file until it is accepted or cancelled. */
export function candidateCanUpload(status: DocumentStatus): boolean {
  return UPLOADABLE_STATUSES.includes(status)
}

/** The requester can only review a file that has been uploaded. */
export function requesterCanReview(status: DocumentStatus): boolean {
  return status === 'UPLOADED'
}

export function requesterCanCancel(status: DocumentStatus): boolean {
  return CANCELLABLE_STATUSES.includes(status)
}

/** Requests that still need the candidate to do something. Drives the nav badge. */
export function needsCandidateAction(status: DocumentStatus): boolean {
  return CANDIDATE_ACTION_STATUSES.includes(status)
}

// A due date is a calendar date, not a moment. It is stored as noon UTC on that date so it reads as
// the same date in every US time zone, and counts as overdue only once that date has ended in the
// last US time zone (18 hours after noon UTC is 6am UTC the next day, which is the end of the date
// on the US west coast in daylight time).
const DUE_DATE_GRACE_MS = 18 * 60 * 60 * 1000

export function dueDateFromInput(yyyyMmDd: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(yyyyMmDd)) return null
  const d = new Date(`${yyyyMmDd}T12:00:00Z`)
  return Number.isNaN(d.getTime()) ? null : d
}

export function isOverdue(dueAt: Date | null, status: DocumentStatus, now = new Date()): boolean {
  return dueAt !== null && needsCandidateAction(status) && dueAt.getTime() + DUE_DATE_GRACE_MS < now.getTime()
}
