import { describe, it, expect } from 'vitest'
import { companyFromDisplayName, filingUrl, parseEdgarHits, readLayoffFiling } from '@/lib/warn/sec-8k'

describe('sec 8-K Item 2.05', () => {
  it('cleans the company name EDGAR displays', () => {
    expect(companyFromDisplayName('Azenta, Inc.  (AZTA)  (CIK 0000933974)')).toBe('Azenta, Inc.')
    expect(companyFromDisplayName('MESA LABORATORIES INC /CO/  (MLAB)  (CIK 0000724004)')).toBe('MESA LABORATORIES INC /CO/')
    expect(companyFromDisplayName('Acme Corp  (CIK 0000000123)')).toBe('Acme Corp')
  })

  it('builds the filing address', () => {
    expect(filingUrl('0000933974', '0001628280-26-065292', 'azta-20261005.htm'))
      .toBe('https://www.sec.gov/Archives/edgar/data/933974/000162828026065292/azta-20261005.htm')
  })

  it('keeps only Item 2.05 hits', () => {
    const body = { hits: { hits: [
      { _id: '0001628280-26-065292:azta-20261005.htm', _source: { ciks: ['0000933974'], display_names: ['Azenta, Inc.  (AZTA)  (CIK 0000933974)'], adsh: '0001628280-26-065292', file_date: '2026-10-07', items: ['2.05', '9.01'], biz_states: ['MA'] } },
      { _id: '0001-26-1:x.htm', _source: { ciks: ['1'], display_names: ['Other  (CIK 0000000001)'], adsh: '0001-26-1', file_date: '2026-10-07', items: ['7.01'] } },
    ] } }
    const out = parseEdgarHits(body)
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ company: 'Azenta, Inc.', fileDate: '2026-10-07', state: 'MA' })
  })

  it('tells a layoff from a plant closure, and reads the headcount', () => {
    expect(readLayoffFiling('The Board approved a reduction in force of approximately 250 employees, about 8% of the workforce.'))
      .toEqual({ isLayoff: true, employees: 250 })
    expect(readLayoffFiling('The Company will close its Ohio facility and record an impairment charge.').isLayoff).toBe(false)
    expect(readLayoffFiling('A workforce reduction will be announced.')).toEqual({ isLayoff: true, employees: null })
  })
})
