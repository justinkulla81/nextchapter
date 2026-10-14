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

export function isDocumentStatus(value: string): value is DocumentStatus {
  return value in DOCUMENT_STATUS_LABEL
}

/** The candidate can add or replace the file until it is accepted or cancelled. */
export function candidateCanUpload(status: DocumentStatus): boolean {
  return status === 'REQUESTED' || status === 'UPLOADED' || status === 'NEEDS_CHANGES'
}

/** The requester can only review a file that has been uploaded. */
export function requesterCanReview(status: DocumentStatus): boolean {
  return status === 'UPLOADED'
}

export function requesterCanCancel(status: DocumentStatus): boolean {
  return status === 'REQUESTED' || status === 'UPLOADED' || status === 'NEEDS_CHANGES'
}

/** Requests that still need the candidate to do something. Drives the nav badge. */
export function needsCandidateAction(status: DocumentStatus): boolean {
  return status === 'REQUESTED' || status === 'NEEDS_CHANGES'
}

export function isOverdue(dueAt: Date | null, status: DocumentStatus, now = new Date()): boolean {
  return dueAt !== null && needsCandidateAction(status) && dueAt.getTime() < now.getTime()
}
