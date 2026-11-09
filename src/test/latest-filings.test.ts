import { describe, expect, it } from 'vitest'
import { filingDateLabel } from '@/components/layoffs/LatestFilings'

const d = (s: string) => new Date(`${s}T12:00:00Z`)

describe('filingDateLabel', () => {
  it('says filed when the state publishes the filing date', () => {
    expect(filingDateLabel({ noticeDate: d('2026-11-03'), noticeDateKnown: true, effectiveDate: d('2027-01-02') })).toBe('Filed Nov 3, 2026')
  })
  it('says effective when the state publishes only the effective date', () => {
    expect(filingDateLabel({ noticeDate: d('2026-09-03'), noticeDateKnown: false, effectiveDate: d('2026-11-02') })).toBe('Effective Nov 2, 2026')
  })
})
