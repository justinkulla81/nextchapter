import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  inst: vi.fn(), findDraft: vi.fn(), create: vi.fn(), count: vi.fn(), donor: vi.fn(), hub: vi.fn(), notices: vi.fn(), reserve: vi.fn(), model: vi.fn(),
}))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    institution: { findUnique: mocks.inst },
    staffAgentDraft: { findUnique: mocks.findDraft, create: mocks.create, findFirst: vi.fn() },
    layoffMatch: { count: mocks.count }, transitionFlag: { count: mocks.count }, outcomeReport: { count: mocks.count },
  },
}))
vi.mock('@/lib/higher-ed/fund', () => ({ donorReport: mocks.donor }))
vi.mock('@/lib/workforce/hub', () => ({ hubDashboard: mocks.hub }))
vi.mock('@/lib/higher-ed/rapid-response', () => ({ regionNotices: mocks.notices }))
vi.mock('./reserve', () => ({ reserveStaffAgentCall: mocks.reserve }))
vi.mock('@/lib/anthropic', () => ({ getAnthropicClient: () => ({ messages: { create: mocks.model } }) }))
vi.mock('@/lib/posthog/server', () => ({ captureServerEvent: vi.fn() }))

import { runBrief } from './briefing-run'

const now = new Date('2026-10-30T12:00:00Z')
const reply = (text: string) => ({ content: [{ type: 'text', text }], usage: { input_tokens: 300, output_tokens: 200 } })
const brief = JSON.stringify({
  title: 'Alumni in transition: 9',
  summary: 'There are 9 alumni in transition, 7 matched to new layoff notices, and 6 recently placed.',
  actions: ['Review the 7 layoff matches'],
  note: 'Hi, we heard your employer filed a layoff notice and want you to know the college is here to help if you need it. Reply to this note any time.',
})

describe('runBrief', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.inst.mockResolvedValue({ id: 'i1', name: 'Valley College', isSampleData: false, enabledFeatures: { agents: { alumniServices: true } } })
    mocks.findDraft.mockResolvedValue(null)
    mocks.count.mockResolvedValueOnce(7).mockResolvedValueOnce(9).mockResolvedValueOnce(6)
    mocks.reserve.mockResolvedValue({ ok: true, release: vi.fn() })
    mocks.model.mockResolvedValue(reply(brief))
    mocks.create.mockResolvedValue({})
  })

  it('saves one brief for the week', async () => {
    expect(await runBrief('i1', 'alumni_services', now)).toMatchObject({ drafted: true })
    expect(mocks.create.mock.calls[0][0].data).toMatchObject({ institutionId: 'i1', agent: 'alumni_services', subjectId: 'i1', weekKey: '2026-10-26' })
  })
  it('does nothing when off, a sample, already drafted this week, or there is nothing to say', async () => {
    mocks.inst.mockResolvedValueOnce({ id: 'i1', name: 'V', isSampleData: false, enabledFeatures: {} })
    expect((await runBrief('i1', 'alumni_services', now)).drafted).toBe(false)
    mocks.findDraft.mockResolvedValueOnce({ id: 'd1' })
    expect((await runBrief('i1', 'alumni_services', now)).drafted).toBe(false)
    mocks.count.mockReset().mockResolvedValue(0)
    expect((await runBrief('i1', 'alumni_services', now)).drafted).toBe(false)
    expect(mocks.model).not.toHaveBeenCalled()
  })
  it('discards a brief with an invented number, and stops at the cap', async () => {
    mocks.model.mockResolvedValueOnce(reply(brief.replace('9 alumni', '41 alumni')))
    expect((await runBrief('i1', 'alumni_services', now)).drafted).toBe(false)
    expect(mocks.create).not.toHaveBeenCalled()
    mocks.count.mockResolvedValueOnce(7).mockResolvedValueOnce(9).mockResolvedValueOnce(6)
    mocks.reserve.mockResolvedValueOnce({ ok: false, reason: 'org' })
    expect(await runBrief('i1', 'alumni_services', now)).toMatchObject({ capped: true, drafted: false })
  })
})
