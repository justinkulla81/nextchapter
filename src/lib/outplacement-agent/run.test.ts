import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  seat: vi.fn(), profile: vi.fn(), existing: vi.fn(), contacts: vi.fn(), create: vi.fn(),
  plan: vi.fn(), reserve: vi.fn(), model: vi.fn(),
}))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    outplacementSeat: { findUnique: mocks.seat, findMany: vi.fn() },
    candidateProfile: { findUnique: mocks.profile },
    outplacementAgentDraft: { findMany: mocks.existing, create: mocks.create },
    supportNetworkContact: { findMany: mocks.contacts },
  },
}))
vi.mock('@/lib/network/weekly-outreach', () => ({ getWeeklyOutreachPlan: mocks.plan }))
vi.mock('./reserve', () => ({ reserveAgentCall: mocks.reserve }))
vi.mock('@/lib/anthropic', () => ({ getAnthropicClient: () => ({ messages: { create: mocks.model } }) }))
vi.mock('@/lib/posthog/server', () => ({ captureServerEvent: vi.fn() }))

import { runSeatWeek } from './run'

const now = new Date('2026-10-28T15:00:00Z')
const item = (id: string, name: string) => ({ contactId: id, name, company: 'Acme', reason: 'You know them there.', purpose: 'REACH_OUT', askSize: 'SMALL', hook: 'SHARED_HISTORY' })
const reply = (name: string) => ({
  content: [{ type: 'text', text: JSON.stringify({ subject: 'Hello', body: `Hi ${name}, it has been a while and I wanted to reconnect. Would you reply with any thoughts on where my field is heading? No rush at all.` }) }],
  usage: { input_tokens: 400, output_tokens: 120 },
})

describe('runSeatWeek', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.seat.mockResolvedValue({ id: 's1', status: 'ACTIVATED', candidateId: 'c1', accessEndsAt: null, contract: { status: 'ACTIVE', termEndAt: new Date('2027-01-01') } })
    mocks.profile.mockResolvedValue({ firstName: 'Sam', targetRoleType: 'PM', confidentialSearchMode: false })
    mocks.plan.mockResolvedValue([item('k1', 'Priya Rao'), item('k2', 'Dan Lee')])
    mocks.existing.mockResolvedValue([])
    mocks.contacts.mockResolvedValue([])
    mocks.reserve.mockResolvedValue({ ok: true, release: vi.fn() })
    mocks.model.mockImplementation(async (a: { messages: { content: string }[] }) => reply(a.messages[0].content.includes('Priya') ? 'Priya' : 'Dan'))
    mocks.create.mockResolvedValue({})
  })

  it('drafts one note per planned person and stores it', async () => {
    const r = await runSeatWeek('s1', now)
    expect(r).toMatchObject({ drafted: 2, capped: false })
    expect(mocks.create).toHaveBeenCalledTimes(2)
    expect(mocks.create.mock.calls[0][0].data).toMatchObject({ seatId: 's1', candidateId: 'c1', contactId: 'k1', weekKey: '2026-10-26' })
  })
  it('does nothing for a seat that is not activated, expired, or has no person', async () => {
    mocks.seat.mockResolvedValueOnce({ id: 's1', status: 'INVITED', candidateId: null, accessEndsAt: null, contract: { status: 'ACTIVE', termEndAt: new Date('2027-01-01') } })
    expect((await runSeatWeek('s1', now)).drafted).toBe(0)
    mocks.seat.mockResolvedValueOnce({ id: 's1', status: 'ACTIVATED', candidateId: 'c1', accessEndsAt: new Date('2026-10-01'), contract: { status: 'ACTIVE', termEndAt: new Date('2027-01-01') } })
    expect((await runSeatWeek('s1', now)).drafted).toBe(0)
    expect(mocks.model).not.toHaveBeenCalled()
  })
  it('does not draft twice for a person already drafted this week', async () => {
    mocks.existing.mockResolvedValue([{ contactId: 'k1' }])
    const r = await runSeatWeek('s1', now)
    expect(r).toMatchObject({ drafted: 1, skipped: 1 })
    expect(mocks.model).toHaveBeenCalledTimes(1)
  })
  it('stops at the cap without calling the model', async () => {
    mocks.reserve.mockResolvedValue({ ok: false, reason: 'seat' })
    const r = await runSeatWeek('s1', now)
    expect(r).toMatchObject({ drafted: 0, capped: true })
    expect(mocks.model).not.toHaveBeenCalled()
  })
  it('gives the slot back when the model call fails, and stores nothing for an unusable reply', async () => {
    const release = vi.fn()
    mocks.reserve.mockResolvedValue({ ok: true, release })
    mocks.model.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce({ content: [{ type: 'text', text: 'nope' }], usage: { input_tokens: 1, output_tokens: 1 } })
    const r = await runSeatWeek('s1', now)
    expect(r).toMatchObject({ drafted: 0, skipped: 2 })
    expect(release).toHaveBeenCalledTimes(1)
    expect(mocks.create).not.toHaveBeenCalled()
  })
})
