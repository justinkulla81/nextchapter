import { describe, expect, it, vi } from 'vitest'
import { EMPLOYEE_JOURNEYS } from '@/lib/journeys/employee-journeys'
import { NEWS_TAGS } from '@/lib/news/tags'
import { DISCOVERY_TOPICS } from '@/lib/news/discovery-topics'
import { SITUATION_TO_JOURNEY } from '@/lib/constants/onboarding'
import { pageSeo } from '@/lib/seo/keywords'

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({ unstable_cache: <T,>(fn: T) => fn }))

describe('employee journeys', () => {
  it('each has a News tag, a real onboarding situation and its own SEO entry', () => {
    const tags = new Set<string>(NEWS_TAGS.map((t) => t.key))
    for (const j of EMPLOYEE_JOURNEYS) {
      expect(tags.has(j.tag), j.slug).toBe(true)
      expect(j.situation in SITUATION_TO_JOURNEY, j.slug).toBe(true)
      expect(pageSeo(`/journeys/${j.slug}`).title.length, j.slug).toBeGreaterThan(0)
      expect(j.signs.length).toBeGreaterThanOrEqual(3)
    }
    expect(pageSeo('/journeys').title).toBeTruthy()
  })
  it('slugs and tags are unique', () => {
    expect(new Set(EMPLOYEE_JOURNEYS.map((j) => j.slug)).size).toBe(EMPLOYEE_JOURNEYS.length)
    expect(new Set(EMPLOYEE_JOURNEYS.map((j) => j.tag)).size).toBe(EMPLOYEE_JOURNEYS.length)
  })
  it('the daily news search covers the topics the journeys need', () => {
    const keys = DISCOVERY_TOPICS.map((t) => t.key)
    for (const k of ['non_disparagement', 'white_collar_benefits', 'wage_growth_costs', 'side_hustles']) expect(keys).toContain(k)
    expect(new Set(keys).size).toBe(keys.length)
  })
})

describe('pay against prices', () => {
  it('compares the newest month both series share, twelve months back', async () => {
    const { computePay } = await import('@/lib/market/bls-pay')
    const pts = (a: number, b: number, c: number) => [
      { year: 2025, month: 9, value: a }, { year: 2026, month: 8, value: b }, { year: 2026, month: 9, value: c },
    ]
    // Earnings have September 2026; prices stop at August, but have no August 2025, so the shared month is September.
    const r = computePay(pts(30, 31, 31.5), [
      { year: 2025, month: 9, value: 300 }, { year: 2026, month: 9, value: 309 },
    ])
    expect(r).toMatchObject({ year: 2026, month: 9 })
    expect(r.wagesPct).toBeCloseTo(5, 5)
    expect(r.pricesPct).toBeCloseTo(3, 5)
    expect(r.realPct).toBeCloseTo(2, 5)
  })
  it('handles December and refuses when no month lines up', async () => {
    const { computePay } = await import('@/lib/market/bls-pay')
    const dec = computePay([{ year: 2025, month: 12, value: 10 }, { year: 2026, month: 12, value: 11 }], [{ year: 2025, month: 12, value: 100 }, { year: 2026, month: 12, value: 100 }])
    expect(dec).toMatchObject({ year: 2026, month: 12 })
    expect(() => computePay([{ year: 2026, month: 9, value: 1 }], [{ year: 2026, month: 9, value: 1 }])).toThrow()
  })
})
