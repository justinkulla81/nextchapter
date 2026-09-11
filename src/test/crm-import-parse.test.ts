import { describe, it, expect } from 'vitest'
import { isRealOrgName } from '@/lib/crm/normalize'
import { parseCsv, toRows, linkedinSlug, cleanPersonName, parseCheckSize, parseDateish } from '../../scripts/crm/parse'

describe('parseCsv', () => {
  it('keeps a quoted newline inside one field', () => {
    // The real failure this guards against: the exported Networking CRM has
    // newlines inside quoted note fields, so a line-based parser merges two
    // contacts into one corrupted row (3,552 physical lines, 3,551 records).
    const csv = 'Name,Notes\nAda,"line one\nline two"\nGrace,fine'
    const rows = parseCsv(csv)
    expect(rows).toHaveLength(3)
    expect(rows[1]).toEqual(['Ada', 'line one\nline two'])
    expect(rows[2]).toEqual(['Grace', 'fine'])
  })

  it('handles quoted commas and escaped quotes', () => {
    const rows = parseCsv('A,B\n"x, y","he said ""hi"""')
    expect(rows[1]).toEqual(['x, y', 'he said "hi"'])
  })

  it('drops blank lines, which is why header offsets must be found not assumed', () => {
    const rows = parseCsv('Notes:\n\nFirst Name,Last Name\nAda,Lovelace')
    expect(rows.map((r) => r[0])).toEqual(['Notes:', 'First Name', 'Ada'])
  })
})

describe('toRows', () => {
  it('treats placeholder dashes as empty', () => {
    const rows = toRows('Name,Org\nAda,—')
    expect(rows[0].get('Name')).toBe('Ada')
    expect(rows[0].get('Org')).toBeNull()
  })

  it('reports the spreadsheet row number for provenance', () => {
    const rows = toRows('Name\nAda\nGrace')
    expect(rows[0].rowNumber).toBe(2)
    expect(rows[1].rowNumber).toBe(3)
  })
})

describe('linkedinSlug', () => {
  it.each([
    ['https://www.linkedin.com/in/caribou', 'caribou'],
    ['https://linkedin.com/in/Caribou/', 'caribou'],
    ['http://www.linkedin.com/in/jane-doe-123?trk=x', 'jane-doe-123'],
    ['https://example.com/in/nope', null],
    [null, null],
  ])('%s -> %s', (input, expected) => {
    expect(linkedinSlug(input)).toBe(expected)
  })
})

describe('cleanPersonName', () => {
  it('strips credential suffixes and parentheticals', () => {
    expect(cleanPersonName('Juan Zavala, CFA, CAIA')).toBe('Juan Zavala')
    expect(cleanPersonName('Vinit Nijhawan (he/him)')).toBe('Vinit Nijhawan')
    expect(cleanPersonName('🌀Mike Taylor')).toBe('Mike Taylor')
  })
})

describe('parseCheckSize', () => {
  it('reads a range', () => {
    expect(parseCheckSize('$250K–$1M')).toEqual({ min: 250_000, max: 1_000_000 })
  })
  it('treats "up to" as a ceiling, not a floor', () => {
    expect(parseCheckSize('Up to ~$1M')).toEqual({ min: null, max: 1_000_000 })
  })
  it('returns nulls for prose', () => {
    expect(parseCheckSize('Program-dependent')).toEqual({ min: null, max: null })
  })
})

describe('parseDateish', () => {
  it('finds an ISO date inside prose', () => {
    expect(parseDateish('Applications 2026-08-08 to 2026-09-22')?.toISOString().slice(0, 10)).toBe('2026-08-08')
  })
  it('returns null for "Rolling" rather than inventing a date', () => {
    // 241 of 252 deadline cells in the funding sheet are prose like this.
    // A fake date here would poison the urgency term in the priority score.
    expect(parseDateish('Rolling')).toBeNull()
    expect(parseDateish('Rolling (via partner)')).toBeNull()
  })
})

describe('isRealOrgName', () => {
  it('rejects placeholders that arrive where a company should be', () => {
    for (const junk of ['Self-employed', 'self employed', 'Independent', 'Confidential', 'N/A', '—', '']) {
      expect(isRealOrgName(junk)).toBe(false)
    }
  })
  it('accepts real organizations', () => {
    for (const real of ['Owl Ventures', 'SemperVirens VC', 'AARP']) {
      expect(isRealOrgName(real)).toBe(true)
    }
  })
})
