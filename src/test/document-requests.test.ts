import { describe, expect, it } from 'vitest'
import {
  candidateCanUpload,
  dueDateFromInput,
  isDocumentStatus,
  isOverdue,
  needsCandidateAction,
  requesterCanCancel,
  requesterCanReview,
  type DocumentStatus,
} from '@/lib/documents/status'

const ALL: DocumentStatus[] = ['REQUESTED', 'UPLOADED', 'ACCEPTED', 'NEEDS_CHANGES', 'CANCELLED']

describe('due dates', () => {
  it('stores a calendar date as noon UTC so it reads the same date everywhere in the US', () => {
    expect(dueDateFromInput('2026-10-20')?.toISOString()).toBe('2026-10-20T12:00:00.000Z')
    expect(dueDateFromInput('20/10/2026')).toBeNull()
    expect(dueDateFromInput('2026-13-40')).toBeNull()
  })

  it('is not overdue until the due date has ended on the west coast', () => {
    const due = dueDateFromInput('2026-10-20')!
    expect(isOverdue(due, 'REQUESTED', new Date('2026-10-21T01:00:00Z'))).toBe(false) // 6pm Pacific on the due date
    expect(isOverdue(due, 'REQUESTED', new Date('2026-10-21T07:00:00Z'))).toBe(true)
  })
})

describe('document request lifecycle', () => {
  it('lets the candidate upload until the request is accepted or cancelled', () => {
    expect(ALL.filter(candidateCanUpload)).toEqual(['REQUESTED', 'UPLOADED', 'NEEDS_CHANGES'])
  })

  it('only lets the requester review an uploaded file', () => {
    expect(ALL.filter(requesterCanReview)).toEqual(['UPLOADED'])
  })

  it('lets the requester cancel anything still open, never an accepted one', () => {
    expect(requesterCanCancel('ACCEPTED')).toBe(false)
    expect(requesterCanCancel('CANCELLED')).toBe(false)
    expect(requesterCanCancel('REQUESTED')).toBe(true)
  })

  it('counts a request as needing the candidate only when the ball is in their court', () => {
    expect(ALL.filter(needsCandidateAction)).toEqual(['REQUESTED', 'NEEDS_CHANGES'])
  })

  it('is overdue only when due, past due, and still waiting on the candidate', () => {
    const now = new Date('2026-10-14T12:00:00Z')
    const yesterday = new Date('2026-10-12T12:00:00Z')
    expect(isOverdue(yesterday, 'REQUESTED', now)).toBe(true)
    expect(isOverdue(yesterday, 'UPLOADED', now)).toBe(false)
    expect(isOverdue(null, 'REQUESTED', now)).toBe(false)
    expect(isOverdue(new Date('2026-10-20T00:00:00Z'), 'REQUESTED', now)).toBe(false)
  })

  it('recognizes only real statuses', () => {
    expect(isDocumentStatus('ACCEPTED')).toBe(true)
    expect(isDocumentStatus('accepted')).toBe(false)
  })
})
