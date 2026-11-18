import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({ institution: { findFirst: vi.fn() } }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/prisma', () => ({ prisma: db }))

import { openDemo } from '@/lib/higher-ed/open-demo'

describe('demos that open without a login', () => {
  beforeEach(() => vi.clearAllMocks())
  it('opens a curated demo college and a demo NextChapter staff built', async () => {
    db.institution.findFirst.mockResolvedValue({ id: 'i1', orgType: 'COLLEGE', enabledFeatures: {} })
    expect(await openDemo('cmu')).toEqual({ id: 'i1', orgType: 'COLLEGE' })
    db.institution.findFirst.mockResolvedValue({ id: 'i2', orgType: 'ECONOMIC_DEVELOPMENT', enabledFeatures: { demo: { source: 'admin' } } })
    expect(await openDemo('demo-one-louisville-e8d04')).toEqual({ id: 'i2', orgType: 'ECONOMIC_DEVELOPMENT' })
  })
  it('keeps a prospect-made demo behind its signed link, and never opens a real organization', async () => {
    db.institution.findFirst.mockResolvedValue({ id: 'i3', orgType: 'WORKFORCE_BOARD', enabledFeatures: { demo: { source: 'public' } } })
    expect(await openDemo('demo-riverbend-x1')).toBeNull()
    db.institution.findFirst.mockResolvedValue(null)
    expect(await openDemo('acme-college')).toBeNull()
    expect(db.institution.findFirst.mock.calls.at(-1)?.[0].where).toMatchObject({ isDemo: true, isSampleData: true })
  })
})
