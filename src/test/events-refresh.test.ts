import { describe, it, expect } from 'vitest'
import { classifyHttp, extractDateRanges, pickNewDates, visibleText } from '@/lib/events/refresh'

const NOW = new Date('2026-10-23T12:00:00Z')

describe('date extraction', () => {
  it('reads a same-month range', () => {
    expect(extractDateRanges('Join us March 14-16, 2027 in Austin', NOW)).toEqual([{ start: '2027-03-14', end: '2027-03-16' }])
  })
  it('reads a cross-month range and day-first ranges', () => {
    expect(extractDateRanges('Mar 30 – Apr 2, 2027', NOW)).toEqual([{ start: '2027-03-30', end: '2027-04-02' }])
    expect(extractDateRanges('14-16 March 2027', NOW)).toEqual([{ start: '2027-03-14', end: '2027-03-16' }])
  })
  it('ignores dates in the past or too far out, and impossible days', () => {
    expect(extractDateRanges('March 14-16, 2026 and June 3, 2031 and February 31, 2027', NOW)).toEqual([])
  })
  it('takes one clear range and refuses an ambiguous page', () => {
    expect(pickNewDates(extractDateRanges('March 14-16, 2027. Early bird ends June 3, 2027.', NOW))).toEqual({ start: '2027-03-14', end: '2027-03-16' })
    expect(pickNewDates(extractDateRanges('March 14-16, 2027 or September 12-14, 2027', NOW))).toBeNull()
  })
  it('strips tags and scripts', () => {
    expect(visibleText('<script>var d="May 1-3, 2027"</script><p>June&nbsp;2-4, 2027</p>')).not.toMatch(/May 1/)
  })
})

describe('link status', () => {
  it('separates dead links from sites that block bots', () => {
    expect([200, 301, 404, 410, 403, 429, 500, null].map((s) => classifyHttp(s))).toEqual(['OK', 'OK', 'BROKEN', 'BROKEN', 'BLOCKED', 'BLOCKED', 'ERROR', 'ERROR'])
  })
})
