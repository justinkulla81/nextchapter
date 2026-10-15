import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({
  upsert: vi.fn(),
  emailFind: vi.fn(),
  emailUpdate: vi.fn(),
  calFind: vi.fn(),
  calUpdate: vi.fn(),
  contactUpdate: vi.fn(),
  senderFind: vi.fn(),
  senderDelete: vi.fn(),
  capture: vi.fn(),
}))

vi.mock('next/cache', async (importOriginal) => ({ ...(await importOriginal<typeof import('next/cache')>()), revalidatePath: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) } }),
}))
vi.mock('@/lib/profile', () => ({ getOrCreateCandidateProfile: async () => ({ id: 'c1', confidentialSearchMode: false }) }))
vi.mock('@/lib/posthog/server', () => ({ captureServerEvent: m.capture }))
vi.mock('@/lib/anthropic', () => ({ getAnthropicClient: vi.fn() }))
vi.mock('@/lib/security/rate-limit', () => ({ allowRequest: async () => true, HOUR_MS: 3_600_000 }))
vi.mock('@/lib/weekly/sprint', () => ({ getCurrentWeekSprint: vi.fn(), autoCompleteEngagementAction: vi.fn() }))
vi.mock('@/lib/weekly/action-effort', () => ({ estimateActionEffort: vi.fn() }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    suppressedSender: { upsert: m.upsert, findFirst: m.senderFind, delete: m.senderDelete },
    trackedEmailActivity: { findFirst: m.emailFind, updateMany: m.emailUpdate },
    trackedCalendarEvent: { findFirst: m.calFind, updateMany: m.calUpdate },
    supportNetworkContact: { updateMany: m.contactUpdate },
  },
}))

import { flagNotJobRelated, unblockSender } from './actions'

describe('flagNotJobRelated', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    m.upsert.mockResolvedValue({})
    m.emailUpdate.mockResolvedValue({ count: 2 })
    m.calUpdate.mockResolvedValue({ count: 0 })
    m.contactUpdate.mockResolvedValue({ count: 1 })
  })

  it('blocks the whole domain for spam and clears prior mail', async () => {
    m.emailFind.mockResolvedValue({ fromAddress: 'Deals <news@shop.example.com>' })
    expect(await flagNotJobRelated('e1', 'email', 'SPAM_BULK')).toEqual({})
    expect(m.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ value: 'shop.example.com', isDomain: true }) })
    )
    expect(m.emailUpdate).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ candidateId: 'c1' }) }))
    expect(m.capture).toHaveBeenCalledWith('c1', 'sender_flagged_not_job_related', expect.objectContaining({ reason: 'SPAM_BULK', scope: 'domain' }))
  })

  it('only blocks the single address for family on a consumer domain', async () => {
    m.emailFind.mockResolvedValue({ fromAddress: 'mom@gmail.com' })
    await flagNotJobRelated('e1', 'email', 'FAMILY_FRIENDS')
    expect(m.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ value: 'mom@gmail.com', isDomain: false }) })
    )
  })

  it("never touches another candidate's activity", async () => {
    m.emailFind.mockResolvedValue(null)
    const result = await flagNotJobRelated('someone-elses', 'email', 'NOT_WORK')
    expect(result.error).toBeTruthy()
    expect(m.upsert).not.toHaveBeenCalled()
    expect(m.emailFind).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'someone-elses', candidateId: 'c1' } }))
  })

  it('keeps the data and reports an error if saving the block fails', async () => {
    m.emailFind.mockResolvedValue({ fromAddress: 'x@example.com' })
    m.upsert.mockRejectedValue(new Error('db down'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const result = await flagNotJobRelated('e1', 'email', 'NOT_WORK')
    expect(result.error).toMatch(/Try again/)
    expect(m.emailUpdate).not.toHaveBeenCalled()
  })
})

describe('unblockSender', () => {
  beforeEach(() => vi.clearAllMocks())

  it('deletes only the candidate\'s own row', async () => {
    m.senderFind.mockResolvedValue({ value: 'a.com', isDomain: true, reason: 'SPAM_BULK' })
    expect(await unblockSender('s1')).toEqual({})
    expect(m.senderFind).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 's1', candidateId: 'c1' } }))
    expect(m.senderDelete).toHaveBeenCalledWith({ where: { id: 's1' } })
  })

  it('does nothing for a row that is not theirs', async () => {
    m.senderFind.mockResolvedValue(null)
    await unblockSender('other')
    expect(m.senderDelete).not.toHaveBeenCalled()
  })
})
