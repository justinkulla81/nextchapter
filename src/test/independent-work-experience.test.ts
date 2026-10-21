import { describe, it, expect } from 'vitest'
import {
  suggestIndependentWork,
  parseIndependentWorkExperience,
  isIndependentWorkAnswered,
  hasAnyIndependentWork,
} from '@/lib/independent-work/experience'

const now = new Date('2026-10-15T12:00:00Z')
const daysAgo = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000)

describe('suggestIndependentWork', () => {
  it('reads recent working/earning platforms as "now" and older ones as "past"', () => {
    const out = suggestIndependentWork(
      [
        { name: 'GLG', category: 'EXPERT_NETWORK', stage: 'EARNING', lastProgressAt: daysAgo(10), dismissed: false },
        { name: 'Upwork', category: 'FREELANCE', stage: 'WORKING', lastProgressAt: daysAgo(200), dismissed: false },
      ],
      [],
      now
    )
    expect(out.expert_network).toEqual({ status: 'now', evidence: ['GLG'] })
    expect(out.consulting).toEqual({ status: 'past', evidence: ['Upwork'] })
  })

  it('ignores sign-ups, acceptances and dismissed detections', () => {
    const out = suggestIndependentWork(
      [
        { name: 'Toptal', category: 'FRACTIONAL', stage: 'SIGNED_UP', lastProgressAt: daysAgo(1), dismissed: false },
        { name: 'Catalant', category: 'FRACTIONAL', stage: 'ACCEPTED', lastProgressAt: daysAgo(1), dismissed: false },
        { name: 'Guru', category: 'FREELANCE', stage: 'EARNING', lastProgressAt: daysAgo(1), dismissed: true },
      ],
      [],
      now
    )
    expect(out).toEqual({})
  })

  it('uses logged work history, and "now" wins over "past"', () => {
    const out = suggestIndependentWork(
      [{ name: 'Toptal', category: 'FRACTIONAL', stage: 'EARNING', lastProgressAt: daysAgo(300), dismissed: false }],
      [
        { engagementType: 'INTERIM', isCurrent: true, companyName: 'Acme' },
        { engagementType: 'CONSULTING', isCurrent: false, companyName: 'Own practice' },
        { engagementType: 'FULL_TIME', isCurrent: true, companyName: 'Ignored' },
      ],
      now
    )
    expect(out.fractional?.status).toBe('now')
    expect(out.fractional?.evidence).toEqual(['Toptal', 'Acme'])
    expect(out.consulting).toEqual({ status: 'past', evidence: ['Own practice'] })
  })
})

describe('answers', () => {
  it('parses only valid values and needs all four types answered', () => {
    const parsed = parseIndependentWorkExperience({ consulting: 'now', fractional: 'bogus', part_time: 'never' })
    expect(parsed).toEqual({ consulting: 'now', part_time: 'never' })
    expect(isIndependentWorkAnswered(parsed)).toBe(false)
    expect(
      isIndependentWorkAnswered({ consulting: 'now', expert_network: 'never', fractional: 'never', part_time: 'never' })
    ).toBe(true)
  })

  it('derives the legacy yes/no from now or past', () => {
    expect(hasAnyIndependentWork({ consulting: 'never', part_time: 'past' })).toBe(true)
    expect(hasAnyIndependentWork({ consulting: 'never', part_time: 'never' })).toBe(false)
  })
})
