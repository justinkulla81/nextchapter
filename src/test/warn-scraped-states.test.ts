import { describe, expect, it } from 'vitest'
import { parseScrapedNotices, SCRAPED_STATES } from '@/lib/warn/sources'

describe('scraped states', () => {
  it('turn standardized notices into rows', () => {
    const [row] = parseScrapedNotices('PA', [
      { company: '  Qualfon  ', location: '1003 Broad Street, Johnstown, PA 15906', notice_date: '2026-09-01', effective_date: '2026-11-01', jobs: 206, is_closure: false, is_temporary: false },
    ])
    expect(row).toMatchObject({
      state: 'PA', employer: 'Qualfon', employees: 206, layoffType: 'Layoff',
      address: '1003 Broad Street, Johnstown, PA 15906', industry: null, county: null,
    })
    expect(row.noticeDate?.toISOString().slice(0, 10)).toBe('2026-09-01')
    expect(row.effectiveDate?.toISOString().slice(0, 10)).toBe('2026-11-01')
  })

  it('leave out amendments and nameless rows, and keep unknowns unknown', () => {
    const rows = parseScrapedNotices('NY', [
      { company: 'A Corp', location: null, notice_date: null, effective_date: null, jobs: null, is_closure: true },
      { company: 'A Corp', location: null, notice_date: '2026-01-02', effective_date: null, jobs: 5, is_amendment: true },
      { company: ' ', location: null, notice_date: '2026-01-02', effective_date: null, jobs: 5 },
    ])
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ employer: 'A Corp', employees: null, noticeDate: null, layoffType: 'Closure' })
  })

  it('cover the twenty states our own fetchers could not read', () => {
    expect(Object.keys(SCRAPED_STATES).sort()).toEqual(['CT', 'DC', 'GA', 'HI', 'IL', 'KY', 'LA', 'MI', 'MO', 'MT', 'ND', 'NM', 'NY', 'OH', 'OK', 'PA', 'SC', 'TN', 'VA', 'WA'])
  })
})
