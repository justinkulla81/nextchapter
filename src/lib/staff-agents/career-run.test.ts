import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ inst: vi.fn(), raw: vi.fn(), recent: vi.fn(), create: vi.fn(), reserve: vi.fn(), model: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/prisma', () => ({
  prisma: { institution: { findUnique: mocks.inst }, $queryRaw: mocks.raw, staffAgentDraft: { findMany: mocks.recent, create: mocks.create } },
}))
vi.mock('./reserve', () => ({ reserveStaffAgentCall: mocks.reserve }))
vi.mock('@/lib/anthropic', () => ({ getAnthropicClient: () => ({ messages: { create: mocks.model } }) }))
vi.mock('@/lib/posthog/server', () => ({ captureServerEvent: vi.fn() }))

import { runCareerServicesAgent } from './career-services-run'

const now = new Date('2026-10-30T12:00:00Z')
const ago = (n: number) => new Date(now.getTime() - n * 86_400_000)
const row = (id: string, name: string, over = {}) => ({ assignmentId: `a-${id}`, counselorId: 'c1', memberId: id, firstName: name, classYear: 2024, shareSearchDetail: true, lastActivityAt: ago(30), sprintActionsTotal: null, sprintActionsDone: null, journey: null, journeyStage: null, assignedAt: ago(90), ...over })
const reply = (name: string) => ({ content: [{ type: 'text', text: JSON.stringify({ subject: 'Checking in', body: `Hi ${name}, I wanted to check in and see how things are going. What would be most useful to work on together? Book 20 minutes with me if you like.` }) }], usage: { input_tokens: 200, output_tokens: 90 } })

describe('runCareerServicesAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.inst.mockResolvedValue({ id: 'i1', name: 'Valley College', isSampleData: false, enabledFeatures: { agents: { careerServices: true } } })
    mocks.raw.mockResolvedValue([row('m1', 'Jordan'), row('m2', 'Sam')])
    mocks.recent.mockResolvedValue([])
    mocks.reserve.mockResolvedValue({ ok: true, release: vi.fn() })
    mocks.model.mockImplementation(async (a: { messages: { content: string }[] }) => reply(a.messages[0].content.includes('Jordan') ? 'Jordan' : 'Sam'))
    mocks.create.mockResolvedValue({})
  })

  it('drafts a note for each quiet member and stores it for their counselor', async () => {
    expect(await runCareerServicesAgent('i1', now)).toMatchObject({ drafted: 2, capped: false })
    expect(mocks.create.mock.calls[0][0].data).toMatchObject({ institutionId: 'i1', agent: 'career_services', subjectId: 'm1', ownerId: 'c1', weekKey: '2026-10-26', reason: 'No activity for 30 days' })
  })
  it('does nothing when not switched on or a sample organization', async () => {
    mocks.inst.mockResolvedValueOnce({ id: 'i1', name: 'V', isSampleData: false, enabledFeatures: {} })
    mocks.inst.mockResolvedValueOnce({ id: 'i1', name: 'V', isSampleData: true, enabledFeatures: { agents: { careerServices: true } } })
    expect((await runCareerServicesAgent('i1', now)).drafted).toBe(0)
    expect((await runCareerServicesAgent('i1', now)).drafted).toBe(0)
    expect(mocks.model).not.toHaveBeenCalled()
  })
  it('skips someone drafted for in the last two weeks and anyone who is active', async () => {
    mocks.recent.mockResolvedValue([{ subjectId: 'm1' }])
    mocks.raw.mockResolvedValue([row('m1', 'Jordan'), row('m2', 'Sam', { lastActivityAt: ago(2) })])
    expect((await runCareerServicesAgent('i1', now)).drafted).toBe(0)
    expect(mocks.model).not.toHaveBeenCalled()
  })
  it('writes at most five a run', async () => {
    mocks.raw.mockResolvedValue(['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((n, i) => row(`m${i}`, 'Jordan')))
    expect((await runCareerServicesAgent('i1', now)).drafted).toBe(5)
  })
  it('stops at the cap, and gives the slot back when the call fails', async () => {
    mocks.reserve.mockResolvedValueOnce({ ok: false, reason: 'org' })
    expect(await runCareerServicesAgent('i1', now)).toMatchObject({ drafted: 0, capped: true })
    const release = vi.fn()
    mocks.reserve.mockResolvedValue({ ok: true, release })
    mocks.model.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce({ content: [{ type: 'text', text: 'nope' }], usage: { input_tokens: 1, output_tokens: 1 } })
    expect(await runCareerServicesAgent('i1', now)).toMatchObject({ drafted: 0, skipped: 2 })
    expect(release).toHaveBeenCalledTimes(1)
  })
})
