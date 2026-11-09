import { beforeEach, describe, expect, it, vi } from 'vitest'

// One failing phase of the nightly company hiring index must not stop the phases after it, and the run then fails naming the phase.
const db = vi.hoisted(() => ({ close: vi.fn() }))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    exclusiveJobPosting: { count: vi.fn().mockResolvedValue(0), findMany: vi.fn().mockResolvedValue([]) },
    $queryRawUnsafe: vi.fn().mockResolvedValue([]),
    $executeRawUnsafe: vi.fn().mockResolvedValue(0),
    $transaction: vi.fn().mockResolvedValue({ benchmarks: 0, areas: 0 }),
  },
}))
vi.mock('@/lib/companies/posting-company', () => ({ linkPostingsToCompanies: vi.fn().mockResolvedValue(new Map()) }))
vi.mock('@/lib/companies/job-openings', () => ({ buildOpeningRow: vi.fn(), upsertOpenings: vi.fn().mockResolvedValue(0), closeArchivedOpenings: db.close }))

import { rebuildHiringIndex } from '@/lib/companies/hiring-index'

beforeEach(() => {
  db.close.mockReset()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('rebuildHiringIndex phases', () => {
  it('runs every phase and reports each one as it finishes when all succeed', async () => {
    db.close.mockResolvedValue(3)
    const steps: string[] = []
    const result = await rebuildHiringIndex({ since: new Date(0), now: new Date('2026-11-10T05:00:00Z'), onStep: (s) => void steps.push(s) })
    expect(result).toMatchObject({ closed: 3 })
    expect(steps).toEqual(['link', 'sync', 'close', 'market', 'profiles'])
  })

  it('carries on after a phase fails, then fails the run naming that phase', async () => {
    db.close.mockRejectedValue(new Error('canceling statement due to statement timeout'))
    const steps: string[] = []
    await expect(rebuildHiringIndex({ since: new Date(0), now: new Date('2026-11-10T05:00:00Z'), onStep: (s) => void steps.push(s) })).rejects.toThrow(
      /close failed after \d+s \(canceling statement due to statement timeout\)/
    )
    expect(steps).toEqual(['link', 'sync', 'close', 'market', 'profiles'])
  })
})
