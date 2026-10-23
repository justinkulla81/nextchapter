import { describe, it, expect } from 'vitest'
import { isSweepHours } from '@/lib/crm/business-hours'

describe('isSweepHours', () => {
  it('runs on a weekday morning through early evening (EDT)', () => {
    expect(isSweepHours(new Date('2026-10-23T11:00:00Z'))).toBe(true) // Fri 7:00 EDT
    expect(isSweepHours(new Date('2026-10-23T23:30:00Z'))).toBe(true) // Fri 19:30 EDT
  })
  it('skips nights', () => {
    expect(isSweepHours(new Date('2026-10-23T10:59:00Z'))).toBe(false) // Fri 6:59 EDT
    expect(isSweepHours(new Date('2026-10-24T00:00:00Z'))).toBe(false) // Fri 20:00 EDT
  })
  it('skips weekends', () => {
    expect(isSweepHours(new Date('2026-10-24T16:00:00Z'))).toBe(false) // Sat noon
    expect(isSweepHours(new Date('2026-10-25T16:00:00Z'))).toBe(false) // Sun noon
  })
  it('follows daylight saving: 7:00 EST in winter is 12:00 UTC', () => {
    expect(isSweepHours(new Date('2026-12-02T12:00:00Z'))).toBe(true) // Wed 7:00 EST
    expect(isSweepHours(new Date('2026-12-02T11:00:00Z'))).toBe(false) // Wed 6:00 EST
  })
})
