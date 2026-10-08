import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import { firstDayOfRange, parseDcWarn, parseMichiganWarn, parseOhioWarn } from '@/lib/warn/states'

const fixture = (f: string) => readFileSync(path.join(__dirname, 'fixtures', f))
const day = (d: Date | null) => d?.toISOString().slice(0, 10)

describe('Ohio WARN', () => {
  const rows = parseOhioWarn(fixture('oh-warn-2026.csv'))
  it('skips the filler rows and splits city from county', () => {
    expect(rows.length).toBeGreaterThan(50)
    const p = rows.find((r) => r.employer === 'Pixelle Specialty Solutions Fremont')!
    expect(p).toMatchObject({ state: 'OH', employees: 61, layoffType: 'Closure', county: 'Sandusky', address: 'Fremont, OH' })
    expect(day(p.noticeDate)).toBe('2026-10-02')
    expect(day(p.effectiveDate)).toBe('2026-12-01')
  })
})

describe('Michigan WARN', () => {
  const rows = parseMichiganWarn(fixture('mi-warn-search.json'))
  it('reads each notice from the search results', () => {
    expect(rows.length).toBeGreaterThan(10)
    const d = rows.find((r) => r.employer === 'Dakkota Integrated Systems, LLC')!
    expect(d).toMatchObject({ state: 'MI', employees: 67, county: 'Clinton', address: '16130 Grove Road, Lansing, MI 48906', layoffType: 'Closure' })
    expect(day(d.effectiveDate)).toBe('2026-12-31')
    expect(day(d.noticeDate)).toBe('2026-09-10')
  })
  it('reads the older layout too (title link, fields on lines)', () => {
    const json = JSON.stringify({ Results: [{
      Path: '/sitecore/content/x/SearchData/2026/04/17/13/05/Samaritas',
      Html: '<div><a class="content-title-link" href="/x.pdf">Samaritas</a></div><div><p><strong>Type of company action:</strong> Facility closure<br /> <strong>City:</strong> Grand Rapids, Michigan<br /> <strong>County:</strong> Kent<br /> <strong>Commencing date:</strong> 3/31/26<br /> <strong>Number of jobs impacted:</strong> 58</p></div>',
    }] })
    const [r] = parseMichiganWarn(Buffer.from(json))
    expect(r).toMatchObject({ employer: 'Samaritas', employees: 58, county: 'Kent', address: 'Grand Rapids, Michigan', layoffType: 'Facility closure' })
    expect(day(r.effectiveDate)).toBe('2026-03-31')
    expect(day(r.noticeDate)).toBe('2026-04-17')
  })

  it('takes the first site of a notice with several', () => {
    const multi = rows.find((r) => /rugged liner/i.test(r.employer))
    if (multi) expect(multi.address).toMatch(/Owosso/i)
  })
})

describe('DC WARN', () => {
  const rows = parseDcWarn(fixture('dc-warn-2026.html'))
  it('reads the year’s table', () => {
    expect(rows.length).toBeGreaterThan(10)
    const e = rows.find((r) => r.employer === 'Elior North America')!
    expect(e).toMatchObject({ state: 'DC', employees: 76, layoffType: 'Layoff', address: 'Washington, DC' })
    expect(day(e.noticeDate)).toBe('2026-02-02')
    expect(rows.find((r) => r.employer === "Albertson's/Safeway")?.layoffType).toBe('Closure')
  })
  it('uses the first day of an effective range', () => {
    expect(day(firstDayOfRange('May 19 - June 2, 2026'))).toBe('2026-05-19')
    expect(firstDayOfRange('TBD')).toBeNull()
  })
})
