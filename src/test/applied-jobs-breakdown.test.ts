import { describe, expect, it } from 'vitest'
import {
  EXPERIENCE_ORDER,
  PAY_ORDER,
  experienceBucket,
  levelLabel,
  medianPay,
  payBand,
  tally,
  type AppliedJob,
} from '@/lib/admin/applied-jobs-breakdown'

function job(over: Partial<AppliedJob>): AppliedJob {
  return {
    url: 'https://example.com/1',
    title: 'Analyst',
    companyName: 'Acme',
    clicks: 1,
    people: 1,
    lastAt: new Date('2026-10-27T12:00:00Z'),
    function: null,
    level: null,
    state: null,
    industry: null,
    salaryMin: null,
    salaryMax: null,
    yearsMin: null,
    noExperience: false,
    aiExposed: null,
    aiMention: null,
    aiExposureLevel: null,
    ...over,
  }
}

describe('applied jobs breakdown', () => {
  it('bands pay by the middle of the range, and says when none is posted', () => {
    expect(payBand(null, null)).toBe('Pay not posted')
    expect(payBand(40_000, 60_000)).toBe('$50k–$75k')
    expect(payBand(null, 180_000)).toBe('$150k and up')
  })

  it('puts no-experience ahead of any years figure', () => {
    expect(experienceBucket({ noExperience: true, yearsMin: 7 })).toBe('No experience needed')
    expect(experienceBucket({ noExperience: false, yearsMin: 7 })).toBe('6–9 years')
    expect(experienceBucket({ noExperience: false, yearsMin: null })).toBe('Years not stated')
  })

  it('counts every apply, not every listing, and keeps ordered buckets in order', () => {
    const jobs = [
      job({ clicks: 3, salaryMin: 60_000, salaryMax: 80_000 }),
      job({ clicks: 1 }),
      job({ clicks: 2, salaryMin: 120_000, salaryMax: 140_000 }),
    ]
    expect(tally(jobs, (j) => payBand(j.salaryMin, j.salaryMax), PAY_ORDER)).toEqual([
      { label: '$50k–$75k', applies: 3 },
      { label: '$100k–$150k', applies: 2 },
      { label: 'Pay not posted', applies: 1 },
    ])
    expect(tally([job({ noExperience: true }), job({ yearsMin: 12, clicks: 5 })], experienceBucket, EXPERIENCE_ORDER).map((b) => b.label)).toEqual([
      'No experience needed',
      '10 or more years',
    ])
  })

  it('labels levels and falls back for unknown ones', () => {
    expect(levelLabel('ENTRY_IC')).toBe('Entry level')
    expect(levelLabel(null)).toBe('Not classified')
    expect(levelLabel('NEW_LEVEL')).toBe('New Level')
  })

  it('takes the median pay weighted by applies', () => {
    expect(medianPay([job({ clicks: 1 })])).toBeNull()
    expect(medianPay([job({ clicks: 2, salaryMin: 100_000, salaryMax: 100_000 }), job({ clicks: 1, salaryMin: 50_000, salaryMax: 50_000 })])).toBe(100_000)
  })
})
