import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const m = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fn = () => vi.fn(async (..._a: unknown[]): Promise<any> => null)
  return {
    sessionFindFirst: fn(),
    sessionCreate: fn(),
    sessionUpdate: fn(),
    summaryUpdateMany: fn(),
    summaryUpsert: fn(),
    summaryFindFirst: fn(),
    followUpUpdateMany: fn(),
    followUpFindMany: fn(),
    followUpFindFirst: fn(),
    followUpUpdate: fn(),
    followUpCreate: fn(),
    followUpDeleteMany: fn(),
    captureCreate: fn(),
    captureDeleteMany: fn(),
    topicFindFirst: fn(),
    topicFindUnique: fn(),
    topicCreate: fn(),
    topicUpdate: fn(),
    sprintFindUnique: fn(),
    sprintCreate: fn(),
    sprintUpdate: fn(),
    candidateFindFirst: fn(),
    email: vi.fn(async (..._a: unknown[]) => ({ sent: true as boolean })),
    capture: vi.fn(),
  }
})

vi.mock('@/lib/prisma', () => {
  const prisma: Record<string, unknown> = {
    coachSession: { findFirst: m.sessionFindFirst, create: m.sessionCreate, update: m.sessionUpdate },
    coachSessionSummary: { updateMany: m.summaryUpdateMany, upsert: m.summaryUpsert, findFirst: m.summaryFindFirst },
    coachFollowUp: { updateMany: m.followUpUpdateMany, findMany: m.followUpFindMany, findFirst: m.followUpFindFirst, update: m.followUpUpdate, create: m.followUpCreate, deleteMany: m.followUpDeleteMany },
    coachSessionCapture: { create: m.captureCreate, deleteMany: m.captureDeleteMany },
    coachSessionTopic: { findFirst: m.topicFindFirst, findUnique: m.topicFindUnique, create: m.topicCreate, update: m.topicUpdate },
    weeklySprint: { findUnique: m.sprintFindUnique, create: m.sprintCreate, update: m.sprintUpdate },
    candidateProfile: { findFirst: m.candidateFindFirst },
  }
  prisma.$transaction = async (cb: (tx: unknown) => unknown) => cb(prisma)
  return { prisma }
})
vi.mock('@/lib/posthog/server', () => ({ captureServerEvent: m.capture }))
vi.mock('@/lib/email/send-coach-update-email', () => ({ sendCoachUpdateEmail: m.email }))
vi.mock('@/lib/admin/coaching-rate-card', () => ({ getApplicableRateCents: async () => 15000 }))
vi.mock('@/lib/higher-ed/coaching', () => ({ collegeForSession: async () => null }))
vi.mock('@/lib/access/grants', () => ({ countCoachingSession: async () => 4 }))
vi.mock('@/lib/weekly/sprint', () => ({ getMondayOfWeek: () => new Date('2026-10-26T00:00:00.000Z') }))

import {
  addCapture,
  addFollowUp,
  decideTopic,
  getMemberCoachingView,
  getUnviewedCoachUpdate,
  getWorkspace,
  saveSummary,
  sendToMember,
  setTopicConfirmed,
  startSessionNotes,
} from '@/lib/coach/session-notes-service'

const DUE = new Date('2026-11-03T00:00:00.000Z')

function sessionForSend(over: Record<string, unknown> = {}) {
  return {
    id: 's1',
    candidateId: 'c1',
    occurredAt: new Date('2026-10-29T18:00:00Z'),
    summary: { id: 'sum1', state: 'REVIEWED', text: 'SECRET SUMMARY TEXT' },
    followUps: [
      { id: 'f1', ownerKind: 'member', text: 'Decide on controller roles', dueOn: DUE },
      { id: 'f2', ownerKind: 'coach', text: 'Introduce Dana', dueOn: null },
    ],
    topics: [{ status: 'confirmed' }, { status: 'suggested' }],
    candidate: { firstName: 'Dana', email: 'dana@example.com', confidentialSearchMode: false },
    coach: { fullName: 'Maya Ortiz' },
    ...over,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  // clearAllMocks keeps implementations, so reset the ones a test overrides with a rejection.
  m.sprintCreate.mockReset().mockResolvedValue({})
  m.sessionFindFirst.mockReset().mockResolvedValue(null)
  m.summaryFindFirst.mockReset().mockResolvedValue(null)
  m.topicFindUnique.mockReset().mockResolvedValue(null)
  m.summaryUpdateMany.mockResolvedValue({ count: 1 })
  m.followUpUpdateMany.mockResolvedValue({ count: 2 })
  m.sprintFindUnique.mockResolvedValue(null)
  m.email.mockResolvedValue({ sent: true })
})

describe('sending to the member', () => {
  it('marks the summary SENT, makes the follow-ups visible, adds the member’s to-dos to the plan and emails a notice', async () => {
    m.sessionFindFirst.mockResolvedValue(sessionForSend())
    const r = await sendToMember('coach1', 's1')
    expect(r).toEqual({ ok: true, memberTodos: 1, coachFollowUps: 1, confirmedTopics: 1, emailed: true })

    expect(m.summaryUpdateMany).toHaveBeenCalledWith({ where: { id: 'sum1', state: { not: 'SENT' } }, data: expect.objectContaining({ state: 'SENT', sentAt: expect.any(Date) }) })
    expect(m.followUpUpdateMany).toHaveBeenCalledWith({ where: { sessionId: 's1' }, data: { visibleToMemberAt: expect.any(Date) } })

    // Only the member's own follow-up becomes a to-do in the weekly plan, tagged so ticking it closes the follow-up.
    const created = m.sprintCreate.mock.calls[0][0] as { data: { committedActions: Record<string, unknown>[] } }
    expect(created.data.committedActions).toHaveLength(1)
    expect(created.data.committedActions[0]).toMatchObject({ text: 'Decide on controller roles (due Nov 3)', fromCoach: true, coachFollowUpId: 'f1', coachSessionId: 's1', completed: false })
  })

  it('emails only a notice: a link, no summary text, and none of the follow-ups', async () => {
    m.sessionFindFirst.mockResolvedValue(sessionForSend())
    await sendToMember('coach1', 's1')
    const arg = m.email.mock.calls[0][0] as Record<string, unknown>
    expect(arg).toMatchObject({ to: 'dana@example.com', coachFirstName: 'Maya', confidential: false })
    expect(String(arg.url)).toMatch(/\/dashboard\/my-coaching$/)
    expect(JSON.stringify(arg)).not.toContain('SECRET SUMMARY TEXT')
    expect(JSON.stringify(arg)).not.toContain('controller')
  })

  it('passes Confidential Search Mode to the email so it can stay neutral', async () => {
    m.sessionFindFirst.mockResolvedValue(sessionForSend({ candidate: { firstName: 'Dana', email: 'dana@example.com', confidentialSearchMode: true } }))
    await sendToMember('coach1', 's1')
    expect(m.email.mock.calls[0][0]).toMatchObject({ confidential: true })
    expect(String((m.email.mock.calls[0][0] as { url: string }).url)).toMatch(/\/dashboard$/)
  })

  it('appends to the plan when the week already has one', async () => {
    m.sessionFindFirst.mockResolvedValue(sessionForSend())
    m.sprintFindUnique.mockResolvedValue({ id: 'w1', committedActions: [{ text: 'Existing', completed: false }] })
    await sendToMember('coach1', 's1')
    const upd = m.sprintUpdate.mock.calls[0][0] as { data: { committedActions: { text: string }[] } }
    expect(upd.data.committedActions.map((a) => a.text)).toEqual(['Existing', 'Decide on controller roles (due Nov 3)'])
  })

  it('refuses to send an empty summary and sends nothing', async () => {
    m.sessionFindFirst.mockResolvedValue(sessionForSend({ summary: { id: 'sum1', state: 'DRAFT', text: '   ' } }))
    const r = await sendToMember('coach1', 's1')
    expect(r).toMatchObject({ ok: false, error: expect.stringContaining('Write or draft the summary first') })
    expect(m.summaryUpdateMany).not.toHaveBeenCalled()
    expect(m.email).not.toHaveBeenCalled()
  })

  it('sends once: an already-sent summary, or a lost race, sends nothing more', async () => {
    m.sessionFindFirst.mockResolvedValue(sessionForSend({ summary: { id: 'sum1', state: 'SENT', text: 'x' } }))
    expect((await sendToMember('coach1', 's1')).ok).toBe(false)
    expect(m.summaryUpdateMany).not.toHaveBeenCalled()

    m.sessionFindFirst.mockResolvedValue(sessionForSend())
    m.summaryUpdateMany.mockResolvedValue({ count: 0 })
    expect((await sendToMember('coach1', 's1')).ok).toBe(false)
    expect(m.followUpUpdateMany).not.toHaveBeenCalled()
    expect(m.email).not.toHaveBeenCalled()
  })

  it('only sends the coach’s own session', async () => {
    m.sessionFindFirst.mockResolvedValue(null)
    expect((await sendToMember('someone-else', 's1')).ok).toBe(false)
    expect(m.sessionFindFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 's1', coachId: 'someone-else' } }))
  })

  it('still counts as sent when the email fails', async () => {
    m.sessionFindFirst.mockResolvedValue(sessionForSend())
    m.email.mockResolvedValue({ sent: false })
    expect(await sendToMember('coach1', 's1')).toMatchObject({ ok: true, emailed: false })
  })

  it('still counts as sent when the plan cannot be written', async () => {
    m.sessionFindFirst.mockResolvedValue(sessionForSend())
    m.sprintCreate.mockRejectedValue(new Error('db down'))
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(await sendToMember('coach1', 's1')).toMatchObject({ ok: true })
    spy.mockRestore()
  })

  it('records the send event with counts and the confidential flag', async () => {
    m.sessionFindFirst.mockResolvedValue(sessionForSend())
    await sendToMember('coach1', 's1')
    expect(m.capture).toHaveBeenCalledWith('coach1', 'coach_session_summary_sent', expect.objectContaining({ sessionId: 's1', candidateId: 'c1', memberTodos: 1, coachFollowUps: 1, confirmedTopics: 1, emailed: true, confidential: false }))
  })
})

describe('nothing changes after a send', () => {
  const sent = { id: 's1', candidateId: 'c1', coachId: 'coach1', occurredAt: new Date(), notes: null, summary: { id: 'sum1', state: 'SENT', text: 't', meetNotes: null, aiDrafted: false, sentAt: new Date() } }
  it('refuses captures, summary edits, follow-ups and topic changes', async () => {
    m.sessionFindFirst.mockResolvedValue(sent)
    expect((await addCapture('coach1', 's1', 'win', 'x')).ok).toBe(false)
    expect((await saveSummary('coach1', 's1', 'new text')).ok).toBe(false)
    expect((await addFollowUp('coach1', 's1', { ownerKind: 'coach', text: 'x' })).ok).toBe(false)
    expect((await setTopicConfirmed('coach1', 's1', 'public_speaking', true)).ok).toBe(false)
    expect(m.captureCreate).not.toHaveBeenCalled()
    expect(m.summaryUpsert).not.toHaveBeenCalled()
    expect(m.followUpCreate).not.toHaveBeenCalled()
    expect(m.topicCreate).not.toHaveBeenCalled()
  })
})

describe('capturing and editing before a send', () => {
  const open = { id: 's1', candidateId: 'c1', coachId: 'coach1', occurredAt: new Date(), notes: null, summary: null }
  beforeEach(() => m.sessionFindFirst.mockResolvedValue(open))

  it('files a capture under a real kind and refuses a bad kind or empty text with a plain reason', async () => {
    m.captureCreate.mockResolvedValue({ id: 'cap1' })
    expect(await addCapture('coach1', 's1', 'win', '  Doubled search time ')).toEqual({ ok: true, id: 'cap1' })
    expect(m.captureCreate).toHaveBeenCalledWith({ data: { sessionId: 's1', kind: 'win', text: 'Doubled search time' }, select: { id: true } })
    expect(await addCapture('coach1', 's1', 'idea', 'x')).toMatchObject({ ok: false, error: expect.stringContaining('Choose what you are capturing') })
    expect(await addCapture('coach1', 's1', 'win', '  ')).toMatchObject({ ok: false })
  })

  it('saving the summary marks it REVIEWED, and emptying it goes back to DRAFT', async () => {
    await saveSummary('coach1', 's1', 'Hello Dana')
    expect(m.summaryUpsert).toHaveBeenLastCalledWith(expect.objectContaining({ update: expect.objectContaining({ state: 'REVIEWED', text: 'Hello Dana' }) }))
    await saveSummary('coach1', 's1', '  ')
    expect(m.summaryUpsert).toHaveBeenLastCalledWith(expect.objectContaining({ update: expect.objectContaining({ state: 'DRAFT', reviewedAt: null }) }))
  })

  it('adds a follow-up with an owner and a real due date, and keeps the input on a bad date', async () => {
    m.followUpCreate.mockResolvedValue({ id: 'f9' })
    expect(await addFollowUp('coach1', 's1', { ownerKind: 'member', text: 'Write three notes', dueOn: '2026-11-03' })).toEqual({ ok: true, id: 'f9' })
    expect(m.followUpCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ ownerKind: 'member', candidateId: 'c1', coachId: 'coach1', dueOn: DUE }) }))
    expect(await addFollowUp('coach1', 's1', { ownerKind: 'member', text: 'x', dueOn: '2026-13-45' })).toMatchObject({ ok: false, error: expect.stringContaining('not a real date') })
    expect(await addFollowUp('coach1', 's1', { ownerKind: 'friend', text: 'x' })).toMatchObject({ ok: false })
  })

  it('never reaches another coach’s session', async () => {
    m.sessionFindFirst.mockResolvedValue(null)
    expect(await addCapture('other', 's1', 'win', 'x')).toMatchObject({ ok: false })
    expect(m.captureCreate).not.toHaveBeenCalled()
  })
})

describe('starting the notes', () => {
  it('opens a session with the rate locked in and counts it against the member’s coaching', async () => {
    m.candidateFindFirst.mockResolvedValue({ id: 'c1' })
    m.sessionCreate.mockResolvedValue({ id: 'new1' })
    expect(await startSessionNotes('coach1', 'c1')).toEqual({ ok: true, sessionId: 'new1' })
    expect(m.sessionCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ coachId: 'coach1', candidateId: 'c1', sessionType: 'STANDARD', rateSnapshotCents: 15000 }) }))
    expect(m.capture).toHaveBeenCalledWith('coach1', 'coach_session_notes_started', expect.objectContaining({ sessionsLeft: 4 }))
  })
  it('refuses a member who is not this coach’s client', async () => {
    m.candidateFindFirst.mockResolvedValue(null)
    expect((await startSessionNotes('coach1', 'stranger')).ok).toBe(false)
    expect(m.sessionCreate).not.toHaveBeenCalled()
  })
})

describe('topics, coach side', () => {
  const open = { id: 's1', candidateId: 'c1', coachId: 'coach1', occurredAt: new Date(), notes: null, summary: null }
  beforeEach(() => m.sessionFindFirst.mockResolvedValue(open))

  it('confirms a suggested topic, adds a new one from the vocabulary, and takes one back', async () => {
    m.topicFindUnique.mockResolvedValueOnce({ id: 't1', status: 'suggested' })
    expect((await setTopicConfirmed('coach1', 's1', 'public_speaking', true)).ok).toBe(true)
    expect(m.topicUpdate).toHaveBeenLastCalledWith({ where: { id: 't1' }, data: { status: 'confirmed', confirmedAt: expect.any(Date) } })

    m.topicFindUnique.mockResolvedValueOnce(null)
    expect((await setTopicConfirmed('coach1', 's1', 'leadership', true)).ok).toBe(true)
    expect(m.topicCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ sessionId: 's1', candidateId: 'c1', topic: 'leadership', status: 'confirmed' }) })

    m.topicFindUnique.mockResolvedValueOnce({ id: 't1', status: 'confirmed' })
    expect((await setTopicConfirmed('coach1', 's1', 'public_speaking', false)).ok).toBe(true)
    expect(m.topicUpdate).toHaveBeenLastCalledWith({ where: { id: 't1' }, data: { status: 'suggested', confirmedAt: null } })
  })
  it('refuses a topic outside the vocabulary and a topic the member already decided', async () => {
    expect((await setTopicConfirmed('coach1', 's1', 'made_up', true)).ok).toBe(false)
    m.topicFindUnique.mockResolvedValueOnce({ id: 't1', status: 'accepted' })
    expect(await setTopicConfirmed('coach1', 's1', 'public_speaking', false)).toMatchObject({ ok: false })
  })
})

describe('topics, member side', () => {
  it('lets the member accept a confirmed topic, and records when', async () => {
    m.topicFindFirst.mockResolvedValue({ id: 't1', topic: 'public_speaking', status: 'confirmed', sessionId: 's1' })
    expect(await decideTopic('c1', 't1', 'accepted')).toEqual({ ok: true })
    expect(m.topicUpdate).toHaveBeenCalledWith({ where: { id: 't1' }, data: { status: 'accepted', acceptedAt: expect.any(Date), dismissedAt: null } })
    expect(m.capture).toHaveBeenCalledWith('c1', 'coach_topic_accepted', expect.objectContaining({ topic: 'public_speaking', from: 'confirmed' }))
  })
  it('lets the member change their mind, and takes the acceptance back so recommendations follow at once', async () => {
    m.topicFindFirst.mockResolvedValue({ id: 't1', topic: 'public_speaking', status: 'accepted', sessionId: 's1' })
    expect(await decideTopic('c1', 't1', 'dismissed')).toEqual({ ok: true })
    expect(m.topicUpdate).toHaveBeenCalledWith({ where: { id: 't1' }, data: { status: 'dismissed', dismissedAt: expect.any(Date), acceptedAt: null } })
  })
  it('refuses a topic the coach has not confirmed, and one that is not the member’s', async () => {
    m.topicFindFirst.mockResolvedValue({ id: 't1', topic: 'public_speaking', status: 'suggested', sessionId: 's1' })
    expect(await decideTopic('c1', 't1', 'accepted')).toMatchObject({ ok: false })
    expect(m.topicUpdate).not.toHaveBeenCalled()
    m.topicFindFirst.mockResolvedValue(null)
    expect(await decideTopic('c2', 't1', 'accepted')).toMatchObject({ ok: false })
    // The lookup is scoped to the member and to a SENT summary.
    expect(m.topicFindFirst).toHaveBeenLastCalledWith(expect.objectContaining({ where: expect.objectContaining({ candidateId: 'c2', session: { summary: { is: { state: 'SENT' } } } }) }))
  })
  it('does nothing when the choice is already made', async () => {
    m.topicFindFirst.mockResolvedValue({ id: 't1', topic: 'public_speaking', status: 'accepted', sessionId: 's1' })
    expect(await decideTopic('c1', 't1', 'accepted')).toEqual({ ok: true })
    expect(m.topicUpdate).not.toHaveBeenCalled()
  })
})

describe('what the member can see', () => {
  const row = {
    id: 's1',
    coach: { fullName: 'Maya Ortiz' },
    summary: { id: 'sum1', text: 'Dana, a good session.', sentAt: new Date('2026-10-29T20:00:00Z'), viewedAt: null },
    followUps: [
      { id: 'f1', ownerKind: 'member', text: 'Decide', dueOn: DUE, status: 'open', visibleToMemberAt: new Date() },
      { id: 'f2', ownerKind: 'coach', text: 'Introduce', dueOn: null, status: 'open', visibleToMemberAt: new Date() },
    ],
    topics: [{ id: 't1', topic: 'public_speaking', status: 'confirmed' }, { id: 't2', topic: 'not_in_vocabulary', status: 'confirmed' }],
  }

  it('asks the database only for a SENT summary, sent follow-ups and confirmed-or-decided topics', async () => {
    m.sessionFindFirst.mockResolvedValue(row)
    await getMemberCoachingView('c1')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const arg = m.sessionFindFirst.mock.calls[0][0] as { where: unknown; select: Record<string, any> }
    expect(arg.where).toEqual({ candidateId: 'c1', summary: { is: { state: 'SENT' } } })
    expect(arg.select.followUps.where).toEqual({ visibleToMemberAt: { not: null } })
    expect(arg.select.topics.where).toEqual({ status: { in: ['confirmed', 'accepted', 'dismissed'] } })
    // Private notes, captures and imported notes are not even selected.
    expect(Object.keys(arg.select)).not.toContain('notes')
    expect(Object.keys(arg.select)).not.toContain('captures')
    expect(JSON.stringify(arg.select.summary)).not.toContain('meetNotes')
  })

  it('labels the coach’s first name, labels owners, and drops topics outside the vocabulary', async () => {
    m.sessionFindFirst.mockResolvedValue(row)
    const v = await getMemberCoachingView('c1')
    expect(v?.coachFirstName).toBe('Maya')
    expect(v?.summaryText).toBe('Dana, a good session.')
    expect(v?.followUps.map((f) => f.ownerKind)).toEqual(['member', 'coach'])
    expect(v?.topics.map((t) => t.topic)).toEqual(['public_speaking'])
    expect(v?.topics[0].effect).toMatch(/^Learn: /)
  })

  it('shows nothing when nothing was sent, and does not break the page when the tables are missing', async () => {
    m.sessionFindFirst.mockResolvedValue(null)
    expect(await getMemberCoachingView('c1')).toBeNull()
    m.sessionFindFirst.mockRejectedValue(new Error('relation "CoachSessionSummary" does not exist'))
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(await getMemberCoachingView('c1')).toBeNull()
    spy.mockRestore()
  })

  it('raises the in-app notice only for a sent, unopened summary', async () => {
    m.summaryFindFirst.mockResolvedValue({ session: { coach: { fullName: 'Maya Ortiz' } } })
    expect(await getUnviewedCoachUpdate('c1')).toEqual({ coachFirstName: 'Maya' })
    expect(m.summaryFindFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { state: 'SENT', viewedAt: null, session: { candidateId: 'c1' } } }))
    m.summaryFindFirst.mockResolvedValue(null)
    expect(await getUnviewedCoachUpdate('c1')).toBeNull()
    m.summaryFindFirst.mockRejectedValue(new Error('no table'))
    expect(await getUnviewedCoachUpdate('c1')).toBeNull()
  })
})

describe('consent on the coach’s page', () => {
  const base = (consented: Date | null) => ({
    id: 's1',
    occurredAt: new Date(),
    notes: null,
    candidate: { id: 'c1', firstName: 'Dana', coachDossierConsentedAt: consented },
    coach: { fullName: 'Maya Ortiz' },
    captures: [],
    summary: null,
    followUps: [],
    topics: [],
  })

  it('reads earlier follow-ups, and how they are going, only after the member consented', async () => {
    m.sessionFindFirst.mockResolvedValue(base(new Date()))
    m.followUpFindMany.mockResolvedValue([{ id: 'f0', ownerKind: 'member', text: 'Old step', dueOn: null }])
    const v = await getWorkspace('coach1', 's1')
    expect(v?.member.shared).toBe(true)
    expect(v?.earlierOpen).toHaveLength(1)
    // Only steps the member was shown, from this coach's own sessions with this member.
    expect(m.followUpFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ coachId: 'coach1', candidateId: 'c1', visibleToMemberAt: { not: null } }) }))
  })

  it('does not even query progress when the member has not consented', async () => {
    m.sessionFindFirst.mockResolvedValue(base(null))
    const v = await getWorkspace('coach1', 's1')
    expect(v?.member.shared).toBe(false)
    expect(v?.earlierOpen).toEqual([])
    expect(m.followUpFindMany).not.toHaveBeenCalled()
  })

  it('tells the coach what is sent and what is not, from the real rows', async () => {
    m.sessionFindFirst.mockResolvedValue({ ...base(null), notes: 'private', summary: { text: 'Hi', state: 'REVIEWED', aiDrafted: true, sentAt: null, meetNotes: 'x' }, captures: [{ id: 'k', kind: 'win', text: 't', createdAt: new Date() }] })
    const v = await getWorkspace('coach1', 's1')
    expect(v?.manifest.notSent).toBe('Not sent: your private notes, the captures, the meeting notes')
    expect(v?.manifest.blockedReason).toBeNull()
  })
})
