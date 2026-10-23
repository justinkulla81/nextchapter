import { describe, expect, it } from 'vitest'
import { correctFutureDates } from './filed-date'

const now = new Date('2026-10-23T12:00:00Z')
const d = (s: string) => new Date(`${s}T00:00:00Z`)

describe('correctFutureDates', () => {
  it('leaves a filing dated today or earlier alone', () => {
    const n = { noticeDate: d('2026-10-19'), effectiveDate: null, fetchedAt: d('2026-10-20') }
    expect(correctFutureDates(n, now)).toBe(n)
  })
  it('reads a future notice date as the day it was fetched and keeps it as the layoff date', () => {
    const c = correctFutureDates({ noticeDate: d('2026-12-20'), effectiveDate: null, fetchedAt: d('2026-10-15') }, now)
    expect(c.noticeDate).toEqual(d('2026-10-15'))
    expect(c.effectiveDate).toEqual(d('2026-12-20'))
  })
  it('keeps an effective date the state did give', () => {
    const c = correctFutureDates({ noticeDate: d('2026-12-08'), effectiveDate: d('2026-10-12'), fetchedAt: d('2026-10-01') }, now)
    expect(c.effectiveDate).toEqual(d('2026-10-12'))
  })
  it('never moves a notice into the future when the fetch time is too', () => {
    const c = correctFutureDates({ noticeDate: d('2026-12-20'), effectiveDate: null, fetchedAt: d('2027-01-01') }, now)
    expect(c.noticeDate).toEqual(now)
  })
  it('leaves a notice with no date alone', () => {
    const n = { noticeDate: null, effectiveDate: null, fetchedAt: d('2026-10-01') }
    expect(correctFutureDates(n, now)).toBe(n)
  })
})
