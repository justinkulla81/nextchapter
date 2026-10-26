import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/prisma', () => ({ prisma: {} }))

import { announcementKind, hasRecentAnnouncement } from '@/lib/warn/company-announcements'

describe('company announcements', () => {
  it('labels buyout and voluntary offers as buyouts, not layoffs', () => {
    expect(announcementKind('Voluntary buyout offered to about 60,000 employees, not layoffs')).toBe('buyout')
    expect(announcementKind('Voluntary separation program for US staff')).toBe('buyout')
    expect(announcementKind('Cutting 10% of staff, per memo')).toBe('layoff')
    expect(announcementKind(null)).toBe('layoff')
  })

  it('counts an announcement as recent for 12 months only', () => {
    const now = Date.parse('2026-10-26')
    const mk = (d: string) => ({ slug: 'x', name: 'X', items: [], latest: new Date(d) })
    expect(hasRecentAnnouncement(mk('2026-10-20'), now)).toBe(true)
    expect(hasRecentAnnouncement(mk('2025-09-01'), now)).toBe(false)
    expect(hasRecentAnnouncement(undefined, now)).toBe(false)
  })
})
