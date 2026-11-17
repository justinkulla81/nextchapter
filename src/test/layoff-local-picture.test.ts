import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn }))
vi.mock('@/lib/prisma', () => ({ prisma: {} }))
vi.mock('@/lib/market/company-industry', () => ({ resolveCompanyIndustry: async () => ({ bucket: null }) }))

import { pictureFigures } from '@/lib/warn/layoff-context'

const rows = [
  { industry: 'finance', n: 40, senior: 12 },
  { industry: 'health', n: 70, senior: 9 },
  { industry: null, n: 25, senior: 3 },
  { industry: 'tech', n: 55, senior: 20 },
]

describe('pictureFigures: the four local-picture numbers from one pass over a state\'s openings', () => {
  it('totals every opening and every senior one, unclassified included, as the two counts did', () => {
    const f = pictureFigures(rows, 'tech')
    expect(f.openInState).toBe(190)
    expect(f.openSeniorInState).toBe(44)
  })

  it('gives the layoff\'s own industry, 0 when the state has none of it, null when it has no industry', () => {
    expect(pictureFigures(rows, 'tech').openInIndustry).toBe(55)
    expect(pictureFigures(rows, 'retail').openInIndustry).toBe(0)
    expect(pictureFigures(rows, null).openInIndustry).toBeNull()
  })

  it('ranks the classified industries by openings, leaving out the unclassified', () => {
    expect(pictureFigures(rows, null).byIndustry.map((r) => r.industry)).toEqual(['health', 'tech', 'finance'])
  })
})
