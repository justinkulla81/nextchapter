import { describe, expect, it } from 'vitest'
import { FAMILY_LABELS, PLANS } from '@/lib/marketing/plans'

const strings = (v: unknown): string[] =>
  typeof v === 'string' ? [v] : Array.isArray(v) ? v.flatMap(strings) : v && typeof v === 'object' ? Object.values(v).flatMap(strings) : []

describe('marketing plans data', () => {
  it('has no amounts or cost words in any string', () => {
    for (const s of strings([PLANS, FAMILY_LABELS])) {
      expect(s, s).not.toMatch(/\$\s*\d/)
      expect(s, s).not.toMatch(/\b(price|prices|pricing|cost|costs|discount|discounts)\b/i)
    }
  })
  it('has unique plan keys and outplacement plans point to Talk to us', () => {
    expect(new Set(PLANS.map((p) => p.planKey)).size).toBe(PLANS.length)
    for (const p of PLANS.filter((p) => p.planKey.startsWith('outplacement_'))) expect(p.cta.label).toBe('Talk to us')
  })
})
