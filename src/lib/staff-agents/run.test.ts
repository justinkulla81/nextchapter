import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ inst: vi.fn(), create: vi.fn(), notices: vi.fn(), cohorts: vi.fn(), reserve: vi.fn(), model: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/prisma', () => ({ prisma: { institution: { findUnique: mocks.inst, findMany: vi.fn() }, rapidResponse: { create: mocks.create } } }))
vi.mock('@/lib/higher-ed/rapid-response', () => ({ regionNotices: mocks.notices }))
vi.mock('@/lib/higher-ed/programs', () => ({ openCohorts: mocks.cohorts }))
vi.mock('./reserve', () => ({ reserveStaffAgentCall: mocks.reserve }))
vi.mock('@/lib/anthropic', () => ({ getAnthropicClient: () => ({ messages: { create: mocks.model } }) }))
vi.mock('@/lib/posthog/server', () => ({ captureServerEvent: vi.fn() }))

import { runRapidResponseAgent } from './run'

const notice = (id: string, employer: string, over = {}) => ({ id, employer, state: 'OH', county: 'Franklin', noticeDate: new Date('2026-10-20'), effectiveDate: null, employees: 90, sourceUrl: null, responseId: null, inRegion: true, ...over })
const good = (employer: string) => ({
  content: [{ type: 'text', text: JSON.stringify({ title: `Training for ${employer} workers`, message: `${employer} has filed a layoff notice. This offer is open to affected workers, whether or not they are alumni. The Data Analytics Certificate is listed below. Sign up on this page when you are ready.` }) }],
  usage: { input_tokens: 350, output_tokens: 140 },
})

describe('runRapidResponseAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.inst.mockResolvedValue({ id: 'i1', name: 'Valley College', isSampleData: false, enabledFeatures: { agents: { rapidResponse: true } } })
    mocks.notices.mockResolvedValue([notice('n1', 'Acme'), notice('n2', 'Beta')])
    mocks.cohorts.mockResolvedValue([{ programId: 'p1', program: { name: 'Data Analytics', credential: 'Certificate', wioaEligible: true } }])
    mocks.reserve.mockResolvedValue({ ok: true, release: vi.fn() })
    mocks.model.mockImplementation(async (a: { messages: { content: string }[] }) => good(a.messages[0].content.includes('Acme') ? 'Acme' : 'Beta'))
    mocks.create.mockResolvedValue({})
  })

  it('saves each draft as a closed, agent-made offer', async () => {
    const r = await runRapidResponseAgent('i1')
    expect(r).toMatchObject({ drafted: 2, capped: false })
    expect(mocks.create.mock.calls[0][0].data).toMatchObject({ institutionId: 'i1', warnNoticeId: 'n1', isActive: false, createdBy: 'agent:rapid-response', programIds: ['p1'] })
  })
  it('does nothing when the organization has not switched it on, is a sample, or has no open program', async () => {
    mocks.inst.mockResolvedValueOnce({ id: 'i1', name: 'V', isSampleData: false, enabledFeatures: {} })
    mocks.inst.mockResolvedValueOnce({ id: 'i1', name: 'V', isSampleData: true, enabledFeatures: { agents: { rapidResponse: true } } })
    expect((await runRapidResponseAgent('i1')).drafted).toBe(0)
    expect((await runRapidResponseAgent('i1')).drafted).toBe(0)
    mocks.cohorts.mockResolvedValueOnce([])
    expect((await runRapidResponseAgent('i1')).drafted).toBe(0)
    expect(mocks.model).not.toHaveBeenCalled()
  })
  it('skips layoffs outside the region and ones that already have an offer', async () => {
    mocks.notices.mockResolvedValue([notice('n1', 'Acme', { inRegion: false }), notice('n2', 'Beta', { responseId: 'r1' })])
    expect((await runRapidResponseAgent('i1')).drafted).toBe(0)
    expect(mocks.model).not.toHaveBeenCalled()
  })
  it('stops at the cap without calling the model', async () => {
    mocks.reserve.mockResolvedValue({ ok: false, reason: 'org' })
    expect(await runRapidResponseAgent('i1')).toMatchObject({ drafted: 0, capped: true })
    expect(mocks.model).not.toHaveBeenCalled()
  })
  it('releases the slot on a failed call and stores nothing for an unusable reply', async () => {
    const release = vi.fn()
    mocks.reserve.mockResolvedValue({ ok: true, release })
    mocks.model.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce({ content: [{ type: 'text', text: 'nope' }], usage: { input_tokens: 1, output_tokens: 1 } })
    expect(await runRapidResponseAgent('i1')).toMatchObject({ drafted: 0, skipped: 2 })
    expect(release).toHaveBeenCalledTimes(1)
    expect(mocks.create).not.toHaveBeenCalled()
  })
})
