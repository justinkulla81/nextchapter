import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const { upsert, deleteMany, findUnique, profileFindUnique } = vi.hoisted(() => ({
  upsert: vi.fn(async (_args: unknown) => ({})),
  deleteMany: vi.fn(async (): Promise<{ count: number }> => ({ count: 1 })),
  findUnique: vi.fn(async (): Promise<unknown> => null),
  profileFindUnique: vi.fn(async (): Promise<unknown> => ({ resumeLatestJobTitle: 'Accountant', primaryFunction: null })),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    candidateOccupation: { upsert, deleteMany, findUnique },
    candidateProfile: { findUnique: profileFindUnique },
  },
}))

const ACCOUNTANT = vi.hoisted(() => '13-2011.00')
vi.mock('@/lib/careers/taxonomy', () => ({
  getTaxonomy: async () => ({ profiles: new Map([[ACCOUNTANT, { socCode: ACCOUNTANT, title: 'Accountants and Auditors' }]]) }),
  getTitleIndex: async () => ({}),
}))
vi.mock('@/lib/careers/title-match', () => ({
  normalizeTitle: (s: string) => s.toLowerCase(),
  matchTitle: () => ({ kind: 'EXACT', socCode: ACCOUNTANT, title: 'Accountants and Auditors', candidates: [] }),
}))
vi.mock('@/lib/market/soc-codes', () => ({ lookupSocCode: () => null }))

import { clearCandidateOccupation, confirmCandidateOccupation, resolveCandidateOccupation } from '@/lib/careers/candidate-occupation'

beforeEach(() => {
  vi.clearAllMocks()
  deleteMany.mockResolvedValue({ count: 1 })
  findUnique.mockResolvedValue(null)
})

describe('what is stored about a candidate\'s occupation', () => {
  it('does not save a match made from the resume job title', async () => {
    const r = await resolveCandidateOccupation('c1')
    expect(r).toMatchObject({ status: 'resolved', socCode: ACCOUNTANT, source: 'TITLE_EXACT' })
    expect(upsert).not.toHaveBeenCalled()
  })

  it('saves only the occupation the candidate confirms', async () => {
    expect(await confirmCandidateOccupation('c1', ACCOUNTANT)).toBe(true)
    expect(upsert).toHaveBeenCalledTimes(1)
    expect(upsert.mock.calls[0][0]).toMatchObject({ create: { candidateId: 'c1', socCode: ACCOUNTANT, source: 'CANDIDATE_CONFIRMED' } })
  })

  it('clearing removes the candidate\'s saved choice and says whether there was one', async () => {
    expect(await clearCandidateOccupation('c1')).toBe(true)
    expect(deleteMany).toHaveBeenCalledWith({ where: { candidateId: 'c1' } })
    deleteMany.mockResolvedValue({ count: 0 })
    expect(await clearCandidateOccupation('c1')).toBe(false)
  })

  it('after clearing, the occupation is matched from the title again and still not stored', async () => {
    await clearCandidateOccupation('c1')
    const r = await resolveCandidateOccupation('c1')
    expect(r).toMatchObject({ status: 'resolved', socCode: ACCOUNTANT })
    expect(upsert).not.toHaveBeenCalled()
  })
})
