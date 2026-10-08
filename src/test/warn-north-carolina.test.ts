import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import { parseNorthCarolinaWarn, resolveNorthCarolinaFile, northCarolinaPage } from '@/lib/warn/states'

describe('North Carolina WARN', () => {
  const rows = parseNorthCarolinaWarn(readFileSync(path.join(__dirname, 'fixtures/nc-warn-2026.csv')))

  it('reads the year’s CSV', () => {
    expect(rows.length).toBeGreaterThan(50)
    const mb = rows.find((r) => r.employer === 'MasterBrand Cabinets LLC')!
    expect(mb).toMatchObject({ state: 'NC', employees: 391, county: 'Lenoir County', address: '651 Collier-Loftin Rd, Kinston, NC', layoffType: 'Layoff' })
    expect(mb.noticeDate?.toISOString().slice(0, 10)).toBe('2026-09-28')
    expect(mb.effectiveDate?.toISOString().slice(0, 10)).toBe('2026-11-27')
  })

  it('finds the CSV link on the summary page', () => {
    const html = '<a href="https://files.nc.gov/commerce/2026-10/warn%20summary%20report%2010_7_2026.csv?VersionId=abc&amp;x=1">CSV</a>'
    expect(resolveNorthCarolinaFile(html)).toBe('https://files.nc.gov/commerce/2026-10/warn%20summary%20report%2010_7_2026.csv?VersionId=abc&x=1')
    expect(northCarolinaPage(2027)).toMatch(/summary-list-2027$/)
  })
})
