import { describe, it, expect } from 'vitest'
import {
  resolveContextualLevel,
  selectLikelyFullTimeRole,
  type ConcurrentRoleCandidate,
  type LevelResolutionContext,
} from '@/lib/scoring/seniority/resolve-contextual-level'
import { calibratedLevelRank } from '@/lib/scoring/level-rank'
import { HIGHEST_LEVEL_OPTIONS } from '@/lib/constants/onboarding'

const MONTH = 1

function ctx(overrides: Partial<LevelResolutionContext>): LevelResolutionContext {
  return {
    title: '',
    companyName: '',
    freeformIndustry: null,
    tenureMonthsInRole: 24,
    yearsIntoCareerAtStart: 5,
    companySizeBand: null,
    concurrentRoles: [],
    ...overrides,
  }
}

function role(overrides: Partial<ConcurrentRoleCandidate>): ConcurrentRoleCandidate {
  return {
    title: '',
    startDateMs: 0,
    endDateMs: null,
    isDeclaredFullTime: false,
    tenureMonths: 24,
    ...overrides,
  }
}

describe('resolveContextualLevel — law firm', () => {
  it('a bare Partner at a law firm resolves to C-Suite', () => {
    const result = resolveContextualLevel(ctx({ title: 'Partner', companyName: 'Smith & Jones LLP' }))
    expect(result?.level).toBe('C-Suite')
  })

  it('a bare Partner at a non-law-firm, non-finance company defers to the generic fallback', () => {
    const result = resolveContextualLevel(ctx({ title: 'Partner', companyName: 'Acme Manufacturing Co' }))
    expect(result).toBeUndefined()
  })

  it('a junior law-firm Associate (under 5 years) resolves to IC', () => {
    const result = resolveContextualLevel(
      ctx({ title: 'Associate', companyName: 'Smith & Jones LLP', tenureMonthsInRole: 24 })
    )
    expect(result?.level).toBe('IC')
  })

  it('a senior law-firm Associate (5+ years) resolves to Manager', () => {
    const result = resolveContextualLevel(
      ctx({ title: 'Senior Associate', companyName: 'Smith & Jones LLP', tenureMonthsInRole: 72 })
    )
    expect(result?.level).toBe('Manager')
  })
})

describe('resolveContextualLevel — Operating Partner', () => {
  it('a 4-year Operating Partner at a PE firm resolves to Director, not penalized for tenure', () => {
    const result = resolveContextualLevel(
      ctx({ title: 'Operating Partner', companyName: 'Acme Growth Equity Partners', tenureMonthsInRole: 48 * MONTH })
    )
    expect(result?.level).toBe('Director')
  })
})

describe('resolveContextualLevel — investment-firm Analyst', () => {
  it('a hedge-fund Analyst 20 years into their career resolves to Director', () => {
    const result = resolveContextualLevel(
      ctx({ title: 'Analyst', companyName: 'Acme Hedge Fund LP', yearsIntoCareerAtStart: 20 })
    )
    expect(result?.level).toBe('Director')
  })

  it('a hedge-fund Analyst 2 years into their career stays IC', () => {
    const result = resolveContextualLevel(
      ctx({ title: 'Analyst', companyName: 'Acme Hedge Fund LP', yearsIntoCareerAtStart: 2 })
    )
    expect(result?.level).toBe('IC')
  })

  it('a PE (non-hedge-fund) Analyst 20 years into their career still stays junior — only hedge funds get the exception', () => {
    const result = resolveContextualLevel(
      ctx({ title: 'Analyst', companyName: 'Acme Private Equity Partners', yearsIntoCareerAtStart: 20 })
    )
    expect(result?.level).toBe('IC')
  })
})

describe('resolveContextualLevel — Owner/Exec', () => {
  it('an Owner at a tiny company for 6 months defers rather than guessing', () => {
    const result = resolveContextualLevel(
      ctx({ title: 'Owner', companyName: 'Main Street Cafe', tenureMonthsInRole: 6, companySizeBand: 'MICRO' })
    )
    expect(result?.level).toBeNull()
    expect(result?.weightMultiplier).toBeLessThan(1)
  })

  it('an Owner at a large, recognizably-sized company for 6 months does not defer', () => {
    const result = resolveContextualLevel(
      ctx({ title: 'Owner', companyName: 'Acme Industries', tenureMonthsInRole: 6, companySizeBand: 'LARGE' })
    )
    expect(result?.level).toBe('C-Suite')
  })

  it('an Owner with substantial tenure at an unsized company does not defer', () => {
    const result = resolveContextualLevel(ctx({ title: 'Owner', companyName: 'Acme Industries', tenureMonthsInRole: 36 }))
    expect(result?.level).toBe('C-Suite')
  })
})

describe('resolveContextualLevel — Advisor/Consultant', () => {
  it('defers to a genuine concurrent full-time job', () => {
    const result = resolveContextualLevel(
      ctx({
        title: 'Senior Advisor',
        companyName: 'Acme Ventures',
        tenureMonthsInRole: 24,
        concurrentRoles: [role({ title: 'VP of Sales', isDeclaredFullTime: true, tenureMonths: 36 })],
      })
    )
    expect(result?.level).toBeNull()
    expect(result?.reason).toBe('advisory_secondary_role')
  })

  it('a sole 2-year Advisor engagement (no concurrent full-time job) resolves to Director', () => {
    const result = resolveContextualLevel(ctx({ title: 'Advisor', companyName: 'Acme Ventures', tenureMonthsInRole: 24 }))
    expect(result?.level).toBe('Director')
    expect(result?.weightMultiplier).toBe(1)
  })

  it('a short, solo advisory stint (under 6 months) defers as likely filler', () => {
    const result = resolveContextualLevel(ctx({ title: 'Advisor', companyName: 'Acme Ventures', tenureMonthsInRole: 3 }))
    expect(result?.level).toBeNull()
    expect(result?.reason).toBe('advisory_short_tenure_filler')
  })

  it('three concurrent Advisor seats each get down-weighted rather than triple-counted', () => {
    const result = resolveContextualLevel(
      ctx({
        title: 'Advisor',
        companyName: 'Acme Ventures',
        tenureMonthsInRole: 24,
        concurrentRoles: [
          role({ title: 'Advisor', tenureMonths: 18 }),
          role({ title: 'Advisor', tenureMonths: 12 }),
        ],
      })
    )
    expect(result?.level).toBe('Director')
    expect(result?.weightMultiplier).toBeLessThan(1)
  })

  it('an Investor Consulting Partner is claimed by the Advisor branch, not the finance bare-partner ladder', () => {
    const result = resolveContextualLevel(
      ctx({ title: 'Investor Consulting Partner', companyName: 'Acme Capital Partners', tenureMonthsInRole: 24 })
    )
    expect(result?.reason).not.toBe('finance_md_partner')
    expect(result?.level).toBe('Director')
  })
})

describe('resolveContextualLevel — finance ladder ordering', () => {
  const rungs: Array<{ title: string; tenureMonthsInRole?: number }> = [
    { title: 'Associate', tenureMonthsInRole: 12 },
    { title: 'Senior Associate', tenureMonthsInRole: 48 },
    { title: 'Vice President' },
    { title: 'Director' },
    { title: 'Managing Director' },
  ]

  it('produces a monotonically increasing calibratedLevelRank score across the real finance ladder order', () => {
    const scores = rungs.map((rung) => {
      const result = resolveContextualLevel(
        ctx({ title: rung.title, companyName: 'Acme Bank', tenureMonthsInRole: rung.tenureMonthsInRole ?? 24 })
      )
      expect(result).toBeDefined()
      return calibratedLevelRank(result!.level, null, result!.scoreNudge ?? 0)
    })

    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]!).toBeGreaterThan(scores[i - 1]!)
    }
  })

  it('a finance VP maps to Manager with a positive score nudge, landing between Manager and Director', () => {
    const result = resolveContextualLevel(ctx({ title: 'Vice President', companyName: 'Acme Bank' }))
    expect(result?.level).toBe('Manager')
    expect(result?.scoreNudge).toBeGreaterThan(0)

    const vpScore = calibratedLevelRank('Manager', null, result?.scoreNudge ?? 0)!
    const plainManagerScore = calibratedLevelRank('Manager', null, 0)!
    const directorScore = calibratedLevelRank('Director', null, 0)!
    expect(vpScore).toBeGreaterThan(plainManagerScore)
    expect(vpScore).toBeLessThan(directorScore)
  })
})

describe('resolveContextualLevel — vocabulary safety', () => {
  const fixtures: LevelResolutionContext[] = [
    ctx({ title: 'Partner', companyName: 'Smith LLP' }),
    ctx({ title: 'Associate', companyName: 'Smith LLP', tenureMonthsInRole: 90 }),
    ctx({ title: 'Operating Partner', companyName: 'Acme Capital Partners' }),
    ctx({ title: 'Analyst', companyName: 'Acme Hedge Fund LP', yearsIntoCareerAtStart: 20 }),
    ctx({ title: 'Advisor', companyName: 'Acme Ventures', tenureMonthsInRole: 24 }),
    ctx({ title: 'Vice President', companyName: 'Acme Bank' }),
    ctx({ title: 'Managing Partner', companyName: 'Acme Capital Management' }),
    ctx({ title: 'Chairman', companyName: 'Acme Industries', tenureMonthsInRole: 36 }),
  ]

  it('never returns a level outside HIGHEST_LEVEL_OPTIONS', () => {
    for (const fixture of fixtures) {
      const result = resolveContextualLevel(fixture)
      if (result?.level) {
        expect(HIGHEST_LEVEL_OPTIONS as readonly string[]).toContain(result.level)
      }
    }
  })
})

describe('selectLikelyFullTimeRole', () => {
  it('prefers a declared full-time role over a longer non-full-time one', () => {
    const picked = selectLikelyFullTimeRole([
      role({ title: 'Advisor', tenureMonths: 60, isDeclaredFullTime: false }),
      role({ title: 'VP of Sales', tenureMonths: 12, isDeclaredFullTime: true }),
    ])
    expect(picked?.title).toBe('VP of Sales')
  })

  it('falls back to the longest-tenured role when none is declared full-time', () => {
    const picked = selectLikelyFullTimeRole([
      role({ title: 'Advisor A', tenureMonths: 6 }),
      role({ title: 'Advisor B', tenureMonths: 24 }),
    ])
    expect(picked?.title).toBe('Advisor B')
  })

  it('returns null for an empty list', () => {
    expect(selectLikelyFullTimeRole([])).toBeNull()
  })
})
