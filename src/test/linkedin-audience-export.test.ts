import { describe, expect, it } from 'vitest'
import { buildOrgRows, buildPeopleRows, domainOf, splitName, type BoardRow, type LeadRow } from '@/lib/linkedin/audience-export'

const board = (o: Partial<BoardRow> = {}): BoardRow => ({
  name: 'Adams County Workforce Development Board', website: 'https://www.adworks.org/home', state: 'CO',
  directorName: 'Dr. Jane Q. Smith', directorTitle: null, directorEmail: 'Jane.Smith@adworks.org', chairName: null, chairEmail: null, ...o,
})
const lead = (o: Partial<LeadRow> = {}): LeadRow => ({
  name: 'Metro Chamber', kind: 'CHAMBER', state: 'OH', city: 'Dayton', website: 'metrochamber.org', contactName: 'Al Ray', contactTitle: 'President', contactEmail: 'al@metrochamber.org', ...o,
})

describe('domainOf', () => {
  it('reduces a site to its domain and drops junk', () => {
    expect(domainOf('https://www.adworks.org/home?x=1')).toBe('adworks.org')
    expect(domainOf('careersourceokaloosawalton.https:')).toBe('')
    expect(domainOf(null)).toBe('')
  })
})

describe('splitName', () => {
  it('takes first and last, drops titles and suffixes, and gives nothing for one word', () => {
    expect(splitName('Dr. Jane Q. Smith')).toEqual({ first: 'Jane', last: 'Smith' })
    expect(splitName('Al Ray, MBA')).toEqual({ first: 'Al', last: 'Ray' })
    expect(splitName('Cher')).toEqual({ first: '', last: '' })
  })
})

describe('buildOrgRows', () => {
  it('lists boards, then leads that have a site, once per organization', () => {
    const rows = buildOrgRows([board(), board()], [lead(), lead({ name: 'No Site Chamber', website: null }), lead({ name: 'Metro Chamber', state: 'OH' })])
    expect(rows.map((r) => r.name)).toEqual(['Adams County Workforce Development Board', 'Metro Chamber'])
    expect(rows[0].website).toBe('adworks.org')
  })

  it('narrows to the kinds asked for', () => {
    expect(buildOrgRows([board()], [lead()], ['CHAMBER']).map((r) => r.name)).toEqual(['Metro Chamber'])
  })
})

describe('buildPeopleRows', () => {
  it('keeps named people with personal-looking emails, once each', () => {
    const rows = buildPeopleRows(
      [board({ chairName: 'Bo Lee', chairEmail: 'info@adworks.org' }), board()],
      [lead(), lead({ contactEmail: 'jobs@metrochamber.org' }), lead({ name: 'Other', contactName: 'Solo', contactEmail: 'solo@x.org' })],
    )
    expect(rows.map((r) => r.email)).toEqual(['jane.smith@adworks.org', 'al@metrochamber.org'])
    expect(rows[0]).toMatchObject({ firstName: 'Jane', lastName: 'Smith', title: 'Executive Director' })
  })
})
