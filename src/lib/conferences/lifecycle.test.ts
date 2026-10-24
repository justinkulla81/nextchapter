import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => {
  const m = () => ({ findMany: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn() })
  return { conferenceEdition: m(), userConference: m(), conferenceChange: m(), conferenceEvent: m(), conferenceOpportunity: m(), conferenceOpportunityTrack: m(), conferenceTalk: m() }
})
vi.mock('@/lib/prisma', () => ({ prisma: db }))
vi.mock('@/lib/posthog/server', () => ({ captureServerEvent: vi.fn() }))

import { rollEditions } from './editions'
import { resolveChange } from './apply-change'
import { setTrackStatus } from './tracking'
import { buildEvidenceTraits } from '@/lib/dossier/evidence-traits'

beforeEach(() => { vi.clearAllMocks(); db.conferenceEdition.upsert.mockResolvedValue({ id: 'next' }); db.conferenceEdition.findFirst.mockResolvedValue({ id: 'ed' }) })

describe('rollEditions', () => {
  it('creates next year as TBA, moves member tracking onto it and marks the old one ended', async () => {
    db.conferenceEdition.findMany.mockResolvedValue([{ id: 'old', seriesId: 's1', year: 2026 }])
    expect(await rollEditions(new Date('2026-10-23'))).toBe(1)
    expect(db.conferenceEdition.upsert.mock.calls[0][0]).toMatchObject({ where: { seriesId_year: { seriesId: 's1', year: 2027 } }, create: { status: 'TBA' } })
    expect(db.userConference.updateMany.mock.calls[0][0].data).toEqual({ editionId: 'next' })
    // Skipped goes back to Tracking; Attended, Speaking and the rest are left alone.
    expect(db.userConference.updateMany.mock.calls[1][0]).toMatchObject({ where: { status: 'SKIPPED' }, data: { status: 'TRACKING' } })
    expect(db.conferenceEdition.update).toHaveBeenCalledWith({ where: { id: 'old' }, data: { status: 'ENDED' } })
  })
  it('does nothing when no edition has ended', async () => {
    db.conferenceEdition.findMany.mockResolvedValue([])
    expect(await rollEditions()).toBe(0)
    expect(db.conferenceEdition.upsert).not.toHaveBeenCalled()
  })
})

describe('resolveChange', () => {
  const change = (over = {}) => ({ id: 'c', seriesId: 's1', kind: 'DATES', status: 'PENDING', payload: { start: '2027-09-13', end: '2027-09-15' }, series: { id: 's1', locked: false, published: true }, ...over })

  it('applies new dates to the series and its edition only when a member who tracks it confirms', async () => {
    db.conferenceChange.findUnique.mockResolvedValue(change())
    db.userConference.findUnique.mockResolvedValue({ id: 'uc' })
    expect(await resolveChange('c', 'APPLY', { candidateId: 'm1' })).toBe(true)
    expect(db.conferenceEvent.update.mock.calls[0][0].data).toMatchObject({ datesConfirmed: true })
    expect(db.conferenceChange.update.mock.calls[0][0].data.status).toBe('APPLIED')
  })
  it('refuses a member who does not track the series', async () => {
    db.conferenceChange.findUnique.mockResolvedValue(change())
    db.userConference.findUnique.mockResolvedValue(null)
    expect(await resolveChange('c', 'APPLY', { candidateId: 'm2' })).toBe(false)
    expect(db.conferenceEvent.update).not.toHaveBeenCalled()
  })
  it('refuses a member applying to an admin-locked series, but lets an admin', async () => {
    db.conferenceChange.findUnique.mockResolvedValue(change({ series: { id: 's1', locked: true, published: true } }))
    db.userConference.findUnique.mockResolvedValue({ id: 'uc' })
    expect(await resolveChange('c', 'APPLY', { candidateId: 'm1' })).toBe(false)
    expect(await resolveChange('c', 'APPLY', { admin: true })).toBe(true)
  })
  it('a dismissal changes nothing in the catalog', async () => {
    db.conferenceChange.findUnique.mockResolvedValue(change())
    db.userConference.findUnique.mockResolvedValue({ id: 'uc' })
    await resolveChange('c', 'DISMISS', { candidateId: 'm1' })
    expect(db.conferenceEvent.update).not.toHaveBeenCalled()
    expect(db.conferenceChange.update.mock.calls[0][0].data.status).toBe('DISMISSED')
  })
  it('ignores a change that is already resolved', async () => {
    db.conferenceChange.findUnique.mockResolvedValue(change({ status: 'APPLIED' }))
    expect(await resolveChange('c', 'APPLY', { admin: true })).toBe(false)
  })
  it('a new opportunity is published only when its series is', async () => {
    db.conferenceChange.findUnique.mockResolvedValue(change({ kind: 'NEW_OPPORTUNITY', payload: { opportunity: { type: 'AWARD', title: 'Award', url: null, deadline: null, opensAt: null } }, series: { id: 's1', locked: false, published: false } }))
    await resolveChange('c', 'APPLY', { admin: true })
    expect(db.conferenceOpportunity.create.mock.calls[0][0].data).toMatchObject({ published: false, source: 'RECHECK' })
  })
})

describe('setTrackStatus and Dossier evidence', () => {
  beforeEach(() => {
    db.conferenceOpportunity.findFirst.mockResolvedValue({ id: 'o1', seriesId: 's1', type: 'CALL_FOR_SPEAKERS', title: 'Speak', series: { id: 's1', name: 'HR Tech' } })
    db.conferenceOpportunityTrack.findUnique.mockResolvedValue(null)
    db.conferenceTalk.findFirst.mockResolvedValue(null)
    db.userConference.findUnique.mockResolvedValue(null)
  })
  it('Accepted writes one speaking-history row', async () => {
    await setTrackStatus('m1', 'o1', 'ACCEPTED')
    expect(db.conferenceTalk.create.mock.calls[0][0].data).toMatchObject({ candidateId: 'm1', opportunityId: 'o1', kind: 'TALK', eventName: 'HR Tech' })
  })
  it('Drafting is not evidence', async () => {
    await setTrackStatus('m1', 'o1', 'DRAFTING')
    expect(db.conferenceTalk.create).not.toHaveBeenCalled()
  })
  it('a second Accepted or Delivered does not duplicate the row', async () => {
    db.conferenceTalk.findFirst.mockResolvedValue({ id: 't' })
    await setTrackStatus('m1', 'o1', 'DELIVERED')
    expect(db.conferenceTalk.create).not.toHaveBeenCalled()
  })
  it('an unpublished opportunity cannot be tracked', async () => {
    db.conferenceOpportunity.findFirst.mockResolvedValue(null)
    await setTrackStatus('m1', 'o9', 'WATCHING')
    expect(db.conferenceOpportunityTrack.upsert).not.toHaveBeenCalled()
  })
  it('speaking lifts the Communication trait', () => {
    const s = { effortMinutes: 0, profileSections: 0, tailoredApplications: 0, workSamples: 0, goalStreakWeeks: 0, helpfulPosts: 0, outreachCount: 0, completedReferences: 0, behavioralAssessments: 0, skillsAssessmentDone: false }
    const level = (x: object) => buildEvidenceTraits({ ...s, ...x }).find((t) => t.key === 'communication')!.level
    expect(level({})).toBe(0)
    expect(level({ speakingActivities: 1 })).toBe(2)
    expect(level({ speakingActivities: 3 })).toBe(3)
  })
})
