import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => {
  const m = () => ({ findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn(), deleteMany: vi.fn() })
  return { conferenceEvent: m(), userConference: m(), candidateProfile: m(), conferenceOpportunityTrack: m() }
})
vi.mock('@/lib/prisma', () => ({ prisma: db }))
vi.mock('@/lib/posthog/server', () => ({ captureServerEvent: vi.fn() }))
const send = vi.hoisted(() => vi.fn())
vi.mock('@/lib/email/resend-client', () => ({ createResend: () => ({ emails: { send } }) }))
const getUserById = vi.hoisted(() => vi.fn())
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ auth: { admin: { getUserById } } }) }))
vi.mock('@/emails/conference-removed', () => ({ default: (props: unknown) => props }))

import { rejectEntry } from './notify-rejected'

beforeEach(() => {
  vi.clearAllMocks()
  process.env.RESEND_API_KEY = 'test'
  db.conferenceEvent.findUnique.mockResolvedValue({ id: 's1', name: 'Fake Summit', published: false })
  db.userConference.findMany.mockResolvedValue([{ id: 'u1', candidateId: 'c1', notes: 'call them', goals: 'meet buyers' }, { id: 'u2', candidateId: 'c2', notes: null, goals: null }])
  db.candidateProfile.findMany.mockResolvedValue([{ id: 'c1', userId: 'a1', firstName: 'Ana' }, { id: 'c2', userId: 'a2', firstName: null }])
  getUserById.mockImplementation(async (id: string) => ({ data: { user: { email: `${id}@example.com` } } }))
  send.mockResolvedValue({ error: null })
})

describe('rejectEntry', () => {
  it('records the reason, tells every member with their own notes, then takes it off their lists', async () => {
    const r = await rejectEntry('s1', ' This is a sales page. ', 'admin1')
    expect(r).toEqual({ members: 2, emailed: 2, failed: 0 })
    expect(db.conferenceEvent.update.mock.calls[0][0].data).toMatchObject({ published: false, rejectedNote: 'This is a sales page.' })
    expect(send).toHaveBeenCalledTimes(2)
    const first = send.mock.calls[0][0]
    expect(first.to).toBe('a1@example.com')
    expect(first.subject).toBe('We took Fake Summit off your conferences')
    expect(first.react).toMatchObject({ firstName: 'Ana', reason: 'This is a sales page.', goals: 'meet buyers', notes: 'call them' })
    expect(db.conferenceOpportunityTrack.deleteMany).toHaveBeenCalled()
    expect(db.userConference.deleteMany).toHaveBeenCalledWith({ where: { seriesId: 's1' } })
  })

  it('still rejects and clears the lists when an email fails, and reports how many failed', async () => {
    send.mockResolvedValueOnce({ error: { message: 'bounced' } })
    const r = await rejectEntry('s1', 'Not a real event', 'admin1')
    expect(r).toEqual({ members: 2, emailed: 1, failed: 1 })
    expect(db.userConference.deleteMany).toHaveBeenCalled()
  })

  it('counts every member as unreached when email is not configured, and still rejects', async () => {
    delete process.env.RESEND_API_KEY
    expect(await rejectEntry('s1', 'Duplicate spam', 'admin1')).toEqual({ members: 2, emailed: 0, failed: 2 })
    expect(db.userConference.deleteMany).toHaveBeenCalled()
  })

  it('needs a reason, and never rejects an approved entry', async () => {
    expect(await rejectEntry('s1', '   ', 'admin1')).toBeNull()
    db.conferenceEvent.findUnique.mockResolvedValue({ id: 's1', name: 'Real Summit', published: true })
    expect(await rejectEntry('s1', 'x', 'admin1')).toBeNull()
    expect(db.conferenceEvent.update).not.toHaveBeenCalled()
    expect(send).not.toHaveBeenCalled()
  })
})
