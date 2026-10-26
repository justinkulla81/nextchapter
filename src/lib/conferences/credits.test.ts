import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => {
  const m = () => ({ findMany: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn() })
  return {
    conferenceEdition: m(), userConference: m(), conferenceEvent: m(), conferenceOpportunity: m(), conferenceOpportunityTrack: m(), conferenceTalk: m(),
    supportNetworkContact: m(), conferenceContactMet: m(), conferenceInterest: m(),
  }
})
vi.mock('@/lib/prisma', () => ({ prisma: db }))
vi.mock('@/lib/posthog/server', () => ({ captureServerEvent: vi.fn() }))
const credit = vi.hoisted(() => ({ creditConferenceAction: vi.fn() }))
vi.mock('./sprint-credit', () => credit)

import { logPeopleMet, setTrackStatus, setUserStatus } from './tracking'
import { applyOutcome } from '@/lib/events/outcome'

beforeEach(() => {
  vi.clearAllMocks()
  db.conferenceEdition.findFirst.mockResolvedValue({ id: 'ed' })
  db.userConference.upsert.mockResolvedValue({})
})

describe('Sprint credit on a conference status change', () => {
  const before = (status: string | null) => db.userConference.findUnique.mockResolvedValue(status ? { status } : null)

  it('Registered pays once, on the change only', async () => {
    before('TRACKING'); await setUserStatus('m1', 's1', 'REGISTERED')
    expect(credit.creditConferenceAction).toHaveBeenCalledExactlyOnceWith('m1', 'CONFERENCE_REGISTER')
    credit.creditConferenceAction.mockClear()
    before('REGISTERED'); await setUserStatus('m1', 's1', 'REGISTERED')
    expect(credit.creditConferenceAction).not.toHaveBeenCalled()
  })
  it('Attended pays the existing event action', async () => {
    before('REGISTERED'); await setUserStatus('m1', 's1', 'ATTENDED')
    expect(credit.creditConferenceAction).toHaveBeenCalledExactlyOnceWith('m1', 'ENGAGE_EVENT')
  })
  it('Interested, Tracking, Speaking and Skipped pay nothing', async () => {
    for (const st of ['INTERESTED', 'TRACKING', 'SPEAKING', 'SKIPPED'] as const) { before(null); await setUserStatus('m1', 's1', st) }
    expect(credit.creditConferenceAction).not.toHaveBeenCalled()
  })
  it('adding a series to your list never pays (onlyIfNew path)', async () => {
    before(null); await setUserStatus('m1', 's1', 'INTERESTED', { onlyIfNew: true })
    expect(credit.creditConferenceAction).not.toHaveBeenCalled()
  })
})

describe('Sprint credit on an opportunity stage', () => {
  beforeEach(() => {
    db.conferenceOpportunity.findUnique.mockResolvedValue({ id: 'o1', seriesId: 's1', type: 'CALL_FOR_SPEAKERS', title: 'Speak', published: true, series: { id: 's1', name: 'HR Tech', published: true, rejectedAt: null } })
    db.conferenceTalk.findFirst.mockResolvedValue(null)
    db.userConference.findUnique.mockResolvedValue(null)
  })
  const from = (status: string | null) => db.conferenceOpportunityTrack.findUnique.mockResolvedValue(status ? { status } : null)
  const calls = () => credit.creditConferenceAction.mock.calls.map((c) => c[1])

  it('Submitted pays the submission once', async () => { from('DRAFTING'); await setTrackStatus('m1', 'o1', 'SUBMITTED'); expect(calls()).toEqual(['CONFERENCE_SUBMISSION']) })
  it('moving on from Submitted to Accepted does not pay it again', async () => { from('SUBMITTED'); await setTrackStatus('m1', 'o1', 'ACCEPTED'); expect(calls()).toEqual([]) })
  it('jumping straight to Accepted or Rejected still pays it once, because it must have gone in', async () => {
    from('WATCHING'); await setTrackStatus('m1', 'o1', 'ACCEPTED'); expect(calls()).toEqual(['CONFERENCE_SUBMISSION'])
    credit.creditConferenceAction.mockClear(); from(null); await setTrackStatus('m1', 'o1', 'REJECTED'); expect(calls()).toEqual(['CONFERENCE_SUBMISSION'])
  })
  it('Delivered pays the talk, and the submission too if it was never marked Submitted', async () => {
    from('ACCEPTED'); await setTrackStatus('m1', 'o1', 'DELIVERED'); expect(calls()).toEqual(['CONFERENCE_TALK'])
    credit.creditConferenceAction.mockClear(); from('DRAFTING'); await setTrackStatus('m1', 'o1', 'DELIVERED'); expect(calls()).toEqual(['CONFERENCE_SUBMISSION', 'CONFERENCE_TALK'])
  })
  it('Watching and Drafting pay nothing; setting Delivered twice pays once', async () => {
    from(null); await setTrackStatus('m1', 'o1', 'WATCHING'); await setTrackStatus('m1', 'o1', 'DRAFTING'); expect(calls()).toEqual([])
    from('DELIVERED'); await setTrackStatus('m1', 'o1', 'DELIVERED'); expect(calls()).toEqual([])
  })
})

describe('Sprint credit for people met', () => {
  beforeEach(() => {
    db.userConference.findUnique.mockResolvedValue({ id: 'uc1' })
    db.conferenceEvent.findUnique.mockResolvedValue({ name: 'HR Tech' })
    db.supportNetworkContact.create.mockResolvedValue({ id: 'new1' })
  })
  it('pays when a genuinely new contact is added, and links them to the conference', async () => {
    db.supportNetworkContact.findFirst.mockResolvedValue(null)
    expect(await logPeopleMet('m1', 's1', [{ name: 'Dana Lee', company: 'Acme' }])).toBe(1)
    expect(credit.creditConferenceAction).toHaveBeenCalledExactlyOnceWith('m1', 'NETWORKING_LIST')
    expect(db.conferenceContactMet.upsert.mock.calls[0][0].create).toMatchObject({ userConferenceId: 'uc1', contactId: 'new1' })
  })
  it('pays nothing for someone already in the Contact Book, but still links them', async () => {
    db.supportNetworkContact.findFirst.mockResolvedValue({ id: 'old1' })
    await logPeopleMet('m1', 's1', [{ name: 'Dana Lee', company: 'Acme' }])
    expect(db.supportNetworkContact.create).not.toHaveBeenCalled()
    expect(credit.creditConferenceAction).not.toHaveBeenCalled()
    expect(db.conferenceContactMet.upsert).toHaveBeenCalled()
  })
})

describe('the "How did it go?" check-in keeps Conferences in step', () => {
  const interest = { id: 'i1', attendedCount: 0, spokeCount: 0, editionEnd: new Date('2026-10-10T00:00:00Z') }
  beforeEach(() => {
    db.conferenceInterest.findUnique.mockResolvedValue(interest)
    db.userConference.findUnique.mockResolvedValue({ status: 'REGISTERED' })
    db.conferenceEvent.findUnique.mockResolvedValue({ name: 'HR Tech' })
    db.conferenceTalk.findFirst.mockResolvedValue(null)
  })
  it('"I went" marks it Attended and credits attending', async () => {
    await applyOutcome('m1', 's1', 'ATTENDED')
    expect(db.userConference.upsert.mock.calls[0][0].create).toMatchObject({ status: 'ATTENDED' })
    expect(credit.creditConferenceAction).toHaveBeenCalledWith('m1', 'ENGAGE_EVENT')
    expect(db.conferenceTalk.create).not.toHaveBeenCalled()
  })
  it('"I spoke" also records a talk in the speaking history, once', async () => {
    await applyOutcome('m1', 's1', 'SPOKE')
    expect(db.conferenceTalk.create.mock.calls[0][0].data).toMatchObject({ candidateId: 'm1', seriesId: 's1', kind: 'TALK', title: 'Spoke at HR Tech' })
    db.conferenceTalk.create.mockClear(); db.conferenceTalk.findFirst.mockResolvedValue({ id: 't' })
    await applyOutcome('m1', 's1', 'SPOKE')
    expect(db.conferenceTalk.create).not.toHaveBeenCalled()
  })
  it('"I did not go" keeps following it and pays nothing', async () => {
    await applyOutcome('m1', 's1', 'DID_NOT_GO')
    expect(db.userConference.upsert.mock.calls[0][0].create).toMatchObject({ status: 'TRACKING' })
    expect(credit.creditConferenceAction).not.toHaveBeenCalled()
  })
  it('a failure syncing Conferences never loses the check-in itself', async () => {
    db.userConference.findUnique.mockRejectedValue(new Error('table missing'))
    await expect(applyOutcome('m1', 's1', 'ATTENDED')).resolves.toBe(true)
  })
})
