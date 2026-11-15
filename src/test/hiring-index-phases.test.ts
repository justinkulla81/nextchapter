import { beforeEach, describe, expect, it, vi } from 'vitest'

// One failing phase of the nightly company hiring index must not stop the phases after it, and the run then fails naming the phase.
const db = vi.hoisted(() => ({ close: vi.fn(), sweep: vi.fn() }))

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
vi.mock('@/lib/companies/job-openings', () => ({ buildOpeningRow: vi.fn(), upsertOpenings: vi.fn().mockResolvedValue(0), closeArchivedOpenings: db.close, sweepOpenOpenings: db.sweep }))

import { rebuildHiringIndex } from '@/lib/companies/hiring-index'

beforeEach(() => {
  db.close.mockReset()
  db.sweep.mockReset().mockResolvedValue({ closed: 0, windows: 1, after: 'https://a/10000' })
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('rebuildHiringIndex phases', () => {
  it('runs every phase and reports each one as it finishes when all succeed', async () => {
    db.close.mockResolvedValue(3)
    const steps: string[] = []
    const result = await rebuildHiringIndex({ since: new Date(0), now: new Date('2026-11-10T05:00:00Z'), onStep: (s) => void steps.push(s) })
    expect(result).toMatchObject({ closed: 3 })
    expect(steps).toEqual(['link', 'sync', 'close', 'sweep', 'market', 'profiles'])
  })

  it('carries on after a phase fails, then fails the run naming that phase', async () => {
    db.close.mockRejectedValue(new Error('canceling statement due to statement timeout'))
    const steps: string[] = []
    await expect(rebuildHiringIndex({ since: new Date(0), now: new Date('2026-11-10T05:00:00Z'), onStep: (s) => void steps.push(s) })).rejects.toThrow(
      /close failed after \d+s \(canceling statement due to statement timeout\)/
    )
    expect(steps).toEqual(['link', 'sync', 'close', 'sweep', 'market', 'profiles'])
  })

  it('closes only what was archived since the last good run on a Sunday too (the full sweep ran past the statement timeout)', async () => {
    db.close.mockResolvedValue(0)
    const since = new Date('2026-11-14T08:29:31Z')
    await rebuildHiringIndex({ since, now: new Date('2026-11-15T08:27:00Z') }).catch(() => {})
    expect(db.close).toHaveBeenCalledWith(expect.objectContaining({ since }))
  })

  it('resumes the sweep where the last run stopped, hands the new position on before the later phases, and returns it first', async () => {
    db.close.mockResolvedValue(0)
    db.sweep.mockResolvedValue({ closed: 40, windows: 6, after: 'https://b/1' })
    const heard: (string | null)[] = []
    const result = await rebuildHiringIndex({ since: new Date(0), sweepAfter: 'https://a/1', now: new Date('2026-11-15T08:30:00Z'), onSweep: (a) => void heard.push(a) })
    expect(db.sweep).toHaveBeenCalledWith(expect.objectContaining({ after: 'https://a/1' }))
    expect(heard).toEqual(['https://b/1'])
    expect(Object.keys(result)[0]).toBe('sweepAfter')
    expect(result).toMatchObject({ sweepAfter: 'https://b/1', sweep: { closed: 40, windows: 6 } })
  })
})
