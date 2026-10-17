import { describe, it, expect } from 'vitest'
import {
  FIRST_READ_WINDOW_MS,
  countScan,
  hasAnyFindings,
  rejectionNote,
  revealLines,
  scanProgress,
} from '@/lib/onboarding/scan-summary-core'

const DAY = 24 * 60 * 60 * 1000
const now = new Date('2026-10-17T12:00:00Z')
const connectedAt = new Date(now.getTime() - 5 * 60 * 1000)

describe('scanProgress', () => {
  it('is not_connected with no email connection', () => {
    expect(scanProgress({ email: null, calendar: null, now })).toEqual({ state: 'not_connected', progress: 0 })
  })

  it('is starting until the first sync records a bookmark', () => {
    expect(scanProgress({ email: { connectedAt, lastSyncAt: null }, calendar: null, now })).toEqual({ state: 'starting', progress: 0 })
  })

  it('reports partial progress while the bookmark is still walking forward', () => {
    const lastSyncAt = new Date(connectedAt.getTime() - FIRST_READ_WINDOW_MS / 2)
    const r = scanProgress({ email: { connectedAt, lastSyncAt }, calendar: null, now })
    expect(r.state).toBe('reading')
    expect(r.progress).toBeGreaterThan(0.4)
    expect(r.progress).toBeLessThan(0.6)
  })

  it('is done once the bookmark has caught up to now', () => {
    const lastSyncAt = new Date(now.getTime() - 60 * 1000)
    expect(scanProgress({ email: { connectedAt, lastSyncAt }, calendar: null, now })).toEqual({ state: 'done', progress: 1 })
  })

  it('waits for the first calendar read before calling it done', () => {
    const lastSyncAt = new Date(now.getTime() - 60 * 1000)
    const waiting = scanProgress({ email: { connectedAt, lastSyncAt }, calendar: { lastSyncAt: null }, now })
    expect(waiting.state).toBe('reading')
    expect(waiting.progress).toBeLessThan(1)
    expect(scanProgress({ email: { connectedAt, lastSyncAt }, calendar: { lastSyncAt: new Date(now) }, now }).state).toBe('done')
  })

  it('never reports more than 100% or less than 0%', () => {
    const future = scanProgress({ email: { connectedAt, lastSyncAt: new Date(now.getTime() + 3 * DAY) }, calendar: null, now })
    expect(future.progress).toBeLessThanOrEqual(1)
    const past = scanProgress({ email: { connectedAt, lastSyncAt: new Date(connectedAt.getTime() - 365 * DAY) }, calendar: null, now })
    expect(past.progress).toBeGreaterThanOrEqual(0)
  })
})

describe('countScan', () => {
  it('counts one conversation once per type, even with many messages', () => {
    const rows = [
      { activityType: 'APPLICATION_CONFIRMATION', threadId: 't1' },
      { activityType: 'APPLICATION_CONFIRMATION', threadId: 't1' },
      { activityType: 'APPLICATION_CONFIRMATION', threadId: 't2' },
      { activityType: 'APPLICATION_CONFIRMATION', threadId: null },
      { activityType: 'APPLICATION_CONFIRMATION', threadId: null },
    ]
    expect(countScan(rows, []).applications).toBe(4)
  })

  it('does not add an interview invite email and the calendar event for the same interview', () => {
    const emails = [{ activityType: 'INTERVIEW_INVITE', threadId: 'a' }]
    const events = [{ eventType: 'INTERVIEW' }, { eventType: 'INTERVIEW' }]
    expect(countScan(emails, events).interviews).toBe(2)
    expect(countScan(emails, [{ eventType: 'INTERVIEW' }]).interviews).toBe(1)
  })

  it('counts networking from outreach, intro requests and networking calls', () => {
    const emails = [
      { activityType: 'NETWORKING_OUTREACH', threadId: 'n1' },
      { activityType: 'INTRO_REQUEST', threadId: 'n2' },
      { activityType: 'FOLLOW_UP', threadId: 'n3' },
    ]
    const c = countScan(emails, [{ eventType: 'NETWORKING_CALL' }])
    expect(c.networking).toBe(3)
    expect(c.followUps).toBe(1)
  })

  it('ignores types it does not report', () => {
    expect(countScan([{ activityType: 'NEEDS_REVIEW', threadId: 'x' }], [{ eventType: 'LEARNING' }])).toEqual({
      applications: 0,
      interviews: 0,
      networking: 0,
      followUps: 0,
      rejections: 0,
    })
  })
})

describe('revealLines', () => {
  const counts = { applications: 14, interviews: 1, networking: 22, followUps: 0, rejections: 0 }

  it('shows applications and interviews as counts and networking as "about"', () => {
    const lines = revealLines(counts)
    expect(lines.map((l) => l.display)).toEqual(['14', '1', 'about 22'])
    expect(lines.map((l) => l.label)).toEqual(['applications', 'interview', 'networking conversations'])
  })

  it('does not say "about 0"', () => {
    expect(revealLines({ ...counts, networking: 0 })[2].display).toBe('0')
  })
})

describe('rejectionNote and hasAnyFindings', () => {
  it('only mentions rejections when there are some, and keeps the tone calm', () => {
    expect(rejectionNote(0)).toBeNull()
    expect(rejectionNote(1)).toBe("1 reply was a no. That's a normal part of a search.")
    expect(rejectionNote(9)).toBe("9 replies were a no. That's a normal part of a search.")
  })

  it('knows when the read found nothing', () => {
    expect(hasAnyFindings({ applications: 0, interviews: 0, networking: 0, followUps: 0, rejections: 0 })).toBe(false)
    expect(hasAnyFindings({ applications: 0, interviews: 0, networking: 0, followUps: 0, rejections: 2 })).toBe(true)
  })
})
