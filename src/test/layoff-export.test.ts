import { describe, expect, it } from 'vitest'
import { csvField, parseStateParam, toCsv, type LayoffRow } from '@/lib/data/layoff-export'

describe('layoff export', () => {
  it('quotes fields that need it and neutralises formulas', () => {
    expect(csvField('Acme, Inc.')).toBe('"Acme, Inc."')
    expect(csvField('say "hi"')).toBe('"say ""hi"""')
    expect(csvField('=SUM(A1)')).toBe("'=SUM(A1)")
    expect(csvField(120)).toBe('120')
    expect(csvField(null)).toBe('')
  })
  it('writes a header and one line per row', () => {
    const row: LayoffRow = { state: 'TX', employer: 'Acme, Inc.', notice_date: '2026-10-01', effective_date: null, workers: 50, layoff_type: 'Layoff', place: 'Travis County', source_url: 'https://twc.texas.gov/x', nextchapter_url: 'https://launchyournextchapter.com/layoffs/company/acme' }
    const lines = toCsv([row]).trim().split('\r\n')
    expect(lines).toHaveLength(2)
    expect(lines[0]).toBe('state,employer,notice_date,effective_date,workers,layoff_type,place,source_url,nextchapter_url')
    expect(lines[1]).toContain('"Acme, Inc."')
  })
  it('reads a state from a code or a name', () => {
    expect(parseStateParam('tx')).toBe('TX')
    expect(parseStateParam('New York')).toBe('NY')
    expect(parseStateParam('zz')).toBeNull()
    expect(parseStateParam('atlantis')).toBeNull()
    expect(parseStateParam(null)).toBeNull()
  })
})
