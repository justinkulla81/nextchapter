import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next/headers', () => ({ cookies: vi.fn() }))
vi.mock('@/lib/prisma', () => ({ prisma: {} }))
vi.mock('@/lib/posthog/server', () => ({ captureServerEvent: vi.fn() }))
vi.mock('@/lib/jobs/change-status', () => ({ upsertTracked: vi.fn() }))

import { addToSavedJobsCookie, parseSavedJobsCookie } from '@/lib/leads/claim-saved-jobs'

describe('saved jobs cookie', () => {
  it('keeps valid ids, drops junk and duplicates', () => {
    expect(parseSavedJobsCookie('abc123xyz, abc123xyz,bad id,<script>')).toEqual(['abc123xyz'])
    expect(parseSavedJobsCookie(undefined)).toEqual([])
  })
  it('puts the newest first and caps the list', () => {
    expect(addToSavedJobsCookie('aaaaaa,bbbbbb', 'bbbbbb')).toBe('bbbbbb,aaaaaa')
    const many = Array.from({ length: 12 }, (_, i) => `job${String(i).padStart(4, '0')}`).join(',')
    expect(parseSavedJobsCookie(addToSavedJobsCookie(many, 'newest1'))).toHaveLength(10)
  })
})

describe('claimSavedJobs', () => {
  it('saves each job found by cookie or by email onto the new account', async () => {
    vi.resetModules()
    const upsertTracked = vi.fn(async () => ({ id: 't1', savedAt: null }))
    const update = vi.fn(async () => ({}))
    const findJobs = vi.fn(async () => [{ id: 'job111', title: 'Manager', companyName: 'Acme', url: 'https://x/y' }])
    vi.doMock('next/headers', () => ({ cookies: async () => ({ get: () => ({ value: 'job111' }) }) }))
    vi.doMock('@/lib/jobs/change-status', () => ({ upsertTracked }))
    vi.doMock('@/lib/prisma', () => ({
      prisma: {
        homepageLead: { findMany: async () => [{ searchQ: 'job222' }] },
        exclusiveJobPosting: { findMany: findJobs },
        trackedJob: { update },
      },
    }))
    const { claimSavedJobs } = await import('@/lib/leads/claim-saved-jobs')
    expect(await claimSavedJobs('cand1', 'A@B.com')).toBe(1)
    expect(findJobs).toHaveBeenCalledWith(expect.objectContaining({ where: { id: { in: ['job111', 'job222'] } } }))
    expect(upsertTracked).toHaveBeenCalledWith('cand1', expect.objectContaining({ source: 'job_board', sourceId: 'job111' }))
    expect(update).toHaveBeenCalled()
  })
})
