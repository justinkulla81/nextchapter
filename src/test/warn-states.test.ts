import { describe, it, expect } from 'vitest'
import { readTables, columnOf, parseDate, parseCount, stripTags } from '@/lib/warn/html'
import { TABLE_SPECS, makeTableParser, parseGeosolincList, parseGeosolincDetail, parseNewJerseyWarn } from '@/lib/warn/states'
import { isKnowledgeSector } from '@/lib/warn/sources'

const spec = (state: string) => TABLE_SPECS.find((s) => s.state === state)!
const buf = (s: string) => Buffer.from(s, 'utf8')

describe('parseCount', () => {
  it('ignores a parenthetical note rather than absorbing its digits', () => {
    // Maryland writes "39 (Remote service workers)"; South Dakota "2 (South Dakota)".
    expect(parseCount('39 (Remote service workers)')).toBe(39)
    expect(parseCount('2 (South Dakota)')).toBe(2)
    expect(parseCount('~1,000 (18%)')).toBe(1000)
  })

  it('rejects values that cannot be a headcount', () => {
    expect(parseCount('')).toBeNull()
    expect(parseCount('n/a')).toBeNull()
    expect(parseCount('0')).toBeNull()
    expect(parseCount('900000')).toBeNull()
  })
})

describe('parseDate', () => {
  it('reads the formats these pages actually use', () => {
    expect(parseDate('09/10/2026')?.toISOString().slice(0, 10)).toBe('2026-09-10')
    expect(parseDate('10/30/26')?.toISOString().slice(0, 10)).toBe('2026-10-30')
    expect(parseDate('Jan 28, 2000')?.toISOString().slice(0, 10)).toBe('2000-01-28')
    // Oregon appends a time component.
    expect(parseDate('9/1/2026 12:00:00 AM')?.toISOString().slice(0, 10)).toBe('2026-09-01')
  })

  it('returns null instead of guessing', () => {
    expect(parseDate('')).toBeNull()
    expect(parseDate('TBD')).toBeNull()
  })
})

describe('columnOf', () => {
  it('matches a header regardless of punctuation or a sort arrow', () => {
    const header = ['Employer', 'City', 'Notice Date ▼', 'WARN Type']
    expect(columnOf(header, 'Notice Date')).toBe(2)
    expect(columnOf(header, 'Employer', 'Company')).toBe(0)
  })

  it('reports -1 rather than falling back to column zero', () => {
    expect(columnOf(['A', 'B'], 'Employees Affected')).toBe(-1)
  })
})

describe('readTables', () => {
  it('returns every table, not just the largest', () => {
    // Utah files one table per year on a single page; reading only the biggest
    // made 2020 look like the most recent notice.
    const html = `
      <table><tr><th>Date of Notice</th><th>Company Name</th><th>Affected Workers</th></tr>
        <tr><td>10/30/26</td><td>Point Designs</td><td>8</td></tr></table>
      <table><tr><th>Date of Notice</th><th>Company Name</th><th>Affected Workers</th></tr>
        <tr><td>12/05/25</td><td>De La Rue</td><td>50</td></tr>
        <tr><td>12/02/25</td><td>Insurance Office</td><td>11</td></tr></table>`
    expect(readTables(html)).toHaveLength(2)

    const rows = makeTableParser(spec('UT'))(buf(html), '')
    expect(rows.map((r) => r.employer)).toEqual(['Point Designs', 'De La Rue', 'Insurance Office'])
    expect(rows[0].noticeDate?.getUTCFullYear()).toBe(2026)
  })
})

describe('makeTableParser', () => {
  it('skips a repeated machine-readable header row', () => {
    // Alaska prints a human header and then a second Name/Notice_Date header.
    const html = `<table>
      <tr><th>Company</th><th>Location</th><th>Notice Date</th><th>Layoff Date</th><th>Employees Affected</th></tr>
      <tr><td>Name</td><td>Location</td><td>Notice_Date</td><td>Layoff_Date</td><td>Num_Employees</td></tr>
      <tr><td>RNDC Shared Services LLC</td><td>Anchorage</td><td>07/06/2026</td><td>09/06/2026</td><td>160</td></tr>
    </table>`
    const rows = makeTableParser(spec('AK'))(buf(html), '')
    expect(rows).toHaveLength(1)
    expect(rows[0].employer).toBe('RNDC Shared Services LLC')
    expect(rows[0].employees).toBe(160)
  })

  it('maps a sector name to the same code as a NAICS number', () => {
    // Florida prints the name, Maryland the code; the filter reads both.
    const fl = makeTableParser(spec('FL'))(
      buf(`<table><tr><th>Company Name</th><th>State Notification Date</th><th>Layoff Date</th><th>Employees Affected</th><th>Industry</th></tr>
           <tr><td>Astrion</td><td>08/28/2026</td><td>10/28/2026</td><td>204</td><td>Professional, Scientific, and Technical Services</td></tr></table>`),
      ''
    )
    expect(fl[0].industry).toMatch(/^54/)
    expect(isKnowledgeSector(fl[0].industry)).toBe(true)

    const md = makeTableParser(spec('MD'))(
      buf(`<table><tr><th>Notice Date</th><th>NAICS Code</th><th>Company</th><th>Total Employees</th><th>Effective Date</th></tr>
           <tr><td>09/10/2026</td><td>541511</td><td>Some Consultancy</td><td>60</td><td>11/10/2026</td></tr></table>`),
      ''
    )
    expect(md[0].industry).toBe('54 (NAICS 541511)')
    expect(isKnowledgeSector(md[0].industry)).toBe(true)
  })

  it('does not treat a construction filing as knowledge work', () => {
    const md = makeTableParser(spec('MD'))(
      buf(`<table><tr><th>Notice Date</th><th>NAICS Code</th><th>Company</th><th>Total Employees</th></tr>
           <tr><td>09/10/2026</td><td>238220</td><td>United Air Temp</td><td>39 (Remote service workers)</td></tr></table>`),
      ''
    )
    expect(md[0].employees).toBe(39)
    expect(isKnowledgeSector(md[0].industry)).toBe(false)
  })

  it('drops pagination and empty rows', () => {
    const rows = makeTableParser(spec('FL'))(
      buf(`<table><tr><th>Company Name</th><th>State Notification Date</th><th>Employees Affected</th><th>Industry</th></tr>
           <tr><td>1 2 3 ></td><td></td><td></td><td></td></tr>
           <tr><td>Real Co</td><td>08/28/2026</td><td>204</td><td>Information</td></tr></table>`),
      ''
    )
    expect(rows.map((r) => r.employer)).toEqual(['Real Co'])
  })
})

describe('geosolinc', () => {
  const list = `<table>
      <tr><th>Employer</th><th>City</th><th>ZIP</th><th>LWIB Area</th><th>Notice Date ▼</th><th>WARN Type</th></tr>
      <tr><td><a href="/search/warn_lookups/4821">First Student</a></td><td>Cincinnati</td><td>45202</td><td>1 - Kansas</td><td>May 01, 2026</td><td>WARN</td></tr>
    </table>`

  it('reads the list and keeps the detail path for the headcount pass', () => {
    const rows = parseGeosolincList(buf(list), 'KS')
    expect(rows).toHaveLength(1)
    expect(rows[0].state).toBe('KS')
    expect(rows[0].employer).toBe('First Student')
    expect(rows[0].address).toBe('Cincinnati')
    expect(rows[0].noticeDate?.toISOString().slice(0, 10)).toBe('2026-05-01')
    // The list page has no headcount at all — that is the point of the second pass.
    expect(rows[0].employees).toBeNull()
    expect(rows[0].detailPath).toBe('/search/warn_lookups/4821')
  })

  it('reads the headcount off a detail page', () => {
    const detail = `<div><dt>Company Name</dt><dd>Continental Grain Co.</dd>
      <dt>Number of Employees Affected</dt><dd>66</dd></div>`
    expect(parseGeosolincDetail(detail)).toBe(66)
    expect(parseGeosolincDetail('<div>no such field</div>')).toBeNull()
  })
})

describe('stripTags', () => {
  it('decodes the entities these pages use', () => {
    expect(stripTags('<td>Smith&nbsp;&amp;&nbsp;Co.</td>')).toBe('Smith & Co.')
  })
})

describe('rendered states', () => {
  it('parses the Massachusetts table the browser job posts', () => {
    // mass.gov returns 403 to every scripted request, so this HTML can only
    // come from a rendered page.
    const html = `<table>
      <tr><th>RECEIVED</th><th>EMPLOYER</th><th>CITY/TOWN</th><th>REGION</th><th>DATE(S) OF LAYOFFS</th><th># EMPLOYEES IMPACTED</th></tr>
      <tr><td>9/9/2026</td><td>Metri BWI, LLC</td><td>Leominster, MA</td><td>Central</td><td>10/31/2026</td><td>25</td></tr>
    </table>`
    const rows = makeTableParser(spec('MA'))(buf(html), '')
    expect(rows).toHaveLength(1)
    expect(rows[0].state).toBe('MA')
    expect(rows[0].employer).toBe('Metri BWI, LLC')
    expect(rows[0].employees).toBe(25)
    expect(rows[0].noticeDate?.toISOString().slice(0, 10)).toBe('2026-09-09')
    expect(rows[0].effectiveDate?.toISOString().slice(0, 10)).toBe('2026-10-31')
  })

  it('keeps the Wisconsin NAICS description without pretending it is a code', () => {
    const html = `<table>
      <tr><th>Company</th><th>City</th><th>Affected Workers</th><th>Notice Received</th><th>Original Notice Type</th><th>Layoff Begin Date</th><th>NAICS Description</th></tr>
      <tr><td>Sparhawk Trucking Inc.</td><td>Wisconsin Rapids</td><td>Unknown</td><td>5/29/2026</td><td>Unknown</td><td>Unknown</td><td>General Freight Trucking</td></tr>
    </table>`
    const [row] = makeTableParser(spec('WI'))(buf(html), '')
    expect(row.employer).toBe('Sparhawk Trucking Inc.')
    // "Unknown" is not a headcount, and must not become one.
    expect(row.employees).toBeNull()
    expect(row.industry).toBe('General Freight Trucking')
    // No sector code, so it cannot pass the knowledge-work filter on its own.
    expect(isKnowledgeSector(row.industry)).toBe(false)
  })
})

describe('New Jersey', () => {
  it('rebuilds a notice date from the month column and the sheet year', () => {
    const rows = parseNewJerseyWarn([
      { name: '2026 WARN Notices', rows: [
        ['Company', 'City', 'Month Posted', 'Effective Date', 'Workforce Affected'],
        ['The Fresh Market', 'Montvale', 'January', '4/12/26', '55'],
      ] },
      { name: '2025 WARN Notices', rows: [
        ['Company', 'City', 'Month Posted', 'Effective Date', 'Workforce Affected'],
        ['Older Co', 'Newark', 'March', '5/1/25', '80'],
      ] },
    ])
    // Only the newest sheet is read.
    expect(rows).toHaveLength(1)
    expect(rows[0].employer).toBe('The Fresh Market')
    expect(rows[0].noticeDate?.toISOString().slice(0, 10)).toBe('2026-01-01')
    expect(rows[0].employees).toBe(55)
  })

  it('takes the first date when the effective date is a range', () => {
    const [row] = parseNewJerseyWarn([
      { name: '2026 WARN Notices', rows: [
        ['Company', 'City', 'Month Posted', 'Effective Date', 'Workforce Affected'],
        ['Lifetime Brands', 'Robbinsville', 'January', '4/10/26 - 11/26/26', '140'],
      ] },
    ])
    expect(row.effectiveDate?.toISOString().slice(0, 10)).toBe('2026-04-10')
  })
})
