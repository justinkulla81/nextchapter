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
