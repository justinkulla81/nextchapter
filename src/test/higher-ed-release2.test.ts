import { describe, expect, it } from 'vitest'
import { annualDue, earlyCareerDue, graduationDate, isCheckInAnswer } from '@/lib/higher-ed/checkins'
import { merge } from '@/lib/higher-ed/outreach'
import { ENGAGEMENT_POINTS, mentorCallRows } from '@/lib/higher-ed/engagement'

const d = (s: string) => new Date(`${s}T12:00:00Z`)

describe('early-career check-ins', () => {
  it('assumes mid-May graduation', () => {
    expect(graduationDate(2025).toISOString().slice(0, 10)).toBe('2025-05-15')
  })
  it('is due 6, 18 and 24 months out, while fresh', () => {
    expect(earlyCareerDue(2026, d('2026-11-20'))?.kind).toBe('M6')
    expect(earlyCareerDue(2025, d('2026-11-20'))?.kind).toBe('M18')
    expect(earlyCareerDue(2024, d('2026-05-20'))?.kind).toBe('M24')
  })
  it('never backfills an old check-in or schedules one early', () => {
    expect(earlyCareerDue(2026, d('2026-11-10'))).toBeNull() // five days early
    expect(earlyCareerDue(2026, d('2027-02-01'))).toBeNull() // M6 went stale
    expect(earlyCareerDue(2010, d('2026-11-20'))).toBeNull()
  })
})

describe('annual check-in', () => {
  it('is due from the first of the chosen month, for 45 days', () => {
    expect(annualDue(9, d('2026-09-02'))?.toISOString().slice(0, 10)).toBe('2026-09-01')
    expect(annualDue(9, d('2026-10-10'))).not.toBeNull()
    expect(annualDue(9, d('2026-10-20'))).toBeNull()
    expect(annualDue(9, d('2026-08-31'))).toBeNull()
  })
})

describe('check-in answers', () => {
  it('accepts only the four answers', () => {
    expect(isCheckInAnswer('looking')).toBe(true)
    expect(isCheckInAnswer('nothing')).toBe(false)
    expect(isCheckInAnswer(undefined)).toBe(false)
  })
})

describe('outreach merge fields', () => {
  it('fills known fields and blanks unknown ones', () => {
    expect(merge('Hi {{firstName}}, {{college}} {{missing}}!', { firstName: 'Ann', college: 'W&J' })).toBe('Hi Ann, W&J !')
  })
})

describe('engagement points', () => {
  it('scores a mentor call for both people, differently', () => {
    const [mentor, requester] = mentorCallRows('i', 'r', 'm1', 'm2', d('2026-01-01'))
    expect([mentor.points, mentor.caseCategory]).toEqual([5, 'VOLUNTEER'])
    expect([requester.points, requester.caseCategory]).toEqual([ENGAGEMENT_POINTS.MENTOR_CALL.points, 'EXPERIENTIAL'])
  })
})
