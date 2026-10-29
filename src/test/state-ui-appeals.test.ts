import { describe, expect, it } from 'vitest'
import { APPEAL_DEADLINES, appealDaysLabel } from '@/lib/data/state-ui-appeals'
import { appealSentence } from '@/components/benefits/StateFilingGuide'
import { ALL_STATE_CODES, stateName } from '@/lib/seo/states'

describe('state appeal deadlines', () => {
  it('has a sourced deadline for every state and DC', () => {
    for (const c of ALL_STATE_CODES) {
      const a = APPEAL_DEADLINES[c]
      expect(a, c).toBeDefined()
      expect(a.days).toBeGreaterThanOrEqual(7)
      expect(a.days).toBeLessThanOrEqual(60)
      expect(a.source).toMatch(/^https:\/\//)
      expect(a.asOf).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
  })
  it('labels calendar days and states the notice controls', () => {
    expect(appealDaysLabel(APPEAL_DEADLINES.TX)).toBe('14 calendar days')
    const s = appealSentence('NY', stateName('NY'))!
    expect(s).toContain('30 days')
    expect(s).toContain('notice controls')
  })
})
