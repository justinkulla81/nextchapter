import { describe, expect, it } from 'vitest'
import { TABLE_SPECS, makeTableParser, parseLouisianaItems, parseNewMexicoItems, parseWestVirginiaWarn, resolveNewMexicoPdfs } from '@/lib/warn/states'
import type { PdfItem } from '@/lib/warn/pdf-table'

const it_ = (s: string, x: number, y: number): PdfItem => ({ s, x, y })

// Positions copied from https://www.laworks.net/Downloads/WFD/WarnNotices2026.pdf (a name or address wraps over two lines).
const LA_HEADER = [it_('2026 WARN NOTICES', 239, 737), it_('Notice', 306, 701), it_('Layoff', 363, 701), it_('Employees', 416, 701),
  it_('Company Name', 43, 695), it_('Address', 158, 695), it_('Industry', 489, 695), it_('Date', 310, 688), it_('Date', 368, 688), it_('Affected', 423, 688)]
const LA_ROWS = [
  it_('Westlake', 41, 669), it_('330 Belden Street', 156, 669), it_('Petrochemical', 487, 669),
  it_('12/15/25', 301, 663), it_('2/14/26', 361, 663), it_('121', 435, 663),
  it_('Corporation', 41, 656), it_('Lake Charles, LA 70601', 156, 656), it_('Manufacturing', 487, 656),
  it_('601 Poydras Street,', 156, 637), it_('McGlinchey', 41, 631),
  it_('Suite 1200', 156, 624), it_('1/13/26', 304, 624), it_('3/16/26', 361, 624), it_('101', 435, 624), it_('Legal Services', 487, 624),
  it_('Stafford PLLC', 41, 618), it_('New Orleans, LA 70130', 156, 612),
]

describe('Louisiana WARN PDF', () => {
  it('rebuilds each row from its position, including names and addresses that wrap above and below the dates', () => {
    const rows = parseLouisianaItems([[...LA_HEADER, ...LA_ROWS]])
    expect(rows.map((r) => r.employer)).toEqual(['Westlake Corporation', 'McGlinchey Stafford PLLC'])
    expect(rows[0]).toMatchObject({ state: 'LA', employees: 121, address: '330 Belden Street Lake Charles, LA 70601' })
    expect(rows[0].noticeDate?.toISOString().slice(0, 10)).toBe('2025-12-15')
    expect(rows[0].effectiveDate?.toISOString().slice(0, 10)).toBe('2026-02-14')
    expect(rows[1]).toMatchObject({ employees: 101, address: '601 Poydras Street, Suite 1200 New Orleans, LA 70130' })
  })
  it('reads nothing from a page without the table header, and says so when the header goes missing', () => {
    expect(parseLouisianaItems([[it_('Page 1 of 1', 10, 10)]])).toEqual([])
    expect(() => parseLouisianaItems([[it_('Company Name', 43, 695), it_('1/13/26', 304, 624)]])).toThrow(/layout has changed/)
  })
})

// Positions copied from https://www.dws.nm.gov/Portals/0/2026_WARN.pdf.
describe('New Mexico WARN PDF', () => {
  const header = [it_('NOTICE DATE', 36, 539), it_('JOB SITE NAME', 173, 532), it_('COUNTY NAME', 315, 532), it_('WDA NAME', 448, 532),
    it_('TOTAL LAYOFF', 563, 547), it_('NUMBER', 575, 533), it_('LAYOFF DATE', 655, 532), it_('RECEIVED DATE', 748, 532), it_('CITY NAME', 858, 532)]
  const row = (y: number, notice: string, site: string, county: string, n: string, layoff: string, received: string, city: string) =>
    [it_(notice, 48, y), it_(site, 116, y), it_(county, 328, y), it_('Central Region', 442, y), it_(n, 591, y), it_(layoff, 668, y), it_(received, 765, y), it_(city, 854, y)]
  it('reads one row per line and ignores the page footer', () => {
    const rows = parseNewMexicoItems([[...header, ...row(517, '4/27/26', 'Atkore HDPE, LLC', 'Bernalillo', '51', '6/30/26', '5/6/26', 'Albuquerque'),
      ...row(503, '9/15/26', 'Sierra Lobo', 'Otero', '242', '11/29/26', '9/22/26', 'Alamogordo'), it_('New Mexico Department of Workforce Solutions', 19, 26)]])
    expect(rows).toHaveLength(2)
    expect(rows[1]).toMatchObject({ state: 'NM', employer: 'Sierra Lobo', county: 'Otero', address: 'Alamogordo', employees: 242 })
    expect(rows[1].noticeDate?.toISOString().slice(0, 10)).toBe('2026-09-15')
  })
  it('finds this year\'s and last year\'s PDF on the Rapid Response page', () => {
    const html = '<a href="https://www.dws.nm.gov/Portals/0/2026_WARN.pdf">2026</a><a href="/Portals/0/DM/Business/2025_WARN.pdf">2025</a><a href="/Portals/0/DM/Business/2024_WARN.pdf">2024</a>'
    expect(resolveNewMexicoPdfs(html)).toEqual(['https://www.dws.nm.gov/Portals/0/2026_WARN.pdf', 'https://www.dws.nm.gov/Portals/0/DM/Business/2025_WARN.pdf'])
  })
})

describe('West Virginia WARN listing', () => {
  const link = (path: string, text: string) => `<a href="/wp-content/uploads/${path}">${text}</a>`
  it('takes the employer and date from each notice link, skips the list file, and dates an undated link by its upload month', () => {
    const html = [
      link('2026/08/ECM-Energy-Services-WARN-8-19-26.pdf', 'ECM Energy Services WARN 8-19-26'),
      link('2026/07/WARN-Notice-State-West-Virginia-Conduent.pdf', 'WARN Notice State &#8211; West Virginia Conduent'),
      link('2026/06/Greenbrier-Minerals-July-WARN.pdf', 'Greenbrier Minerals July WARN'),
      link('2025/01/WV-WARN-Notices-1-1-22-to-1-3-25.pdf', 'Download Warn Notice PDF'),
      link('2025/06/Delbarton-Prep-Plant-r2-WARN-6-4-25.pdf', 'Delbarton Prep Plant r2 WARN 6-4-25'),
    ].join('')
    const rows = parseWestVirginiaWarn(html)
    expect(rows.map((r) => r.employer)).toEqual(['ECM Energy Services', 'Conduent', 'Greenbrier Minerals', 'Delbarton Prep Plant'])
    expect(rows.map((r) => r.noticeDate?.toISOString().slice(0, 10))).toEqual(['2026-08-19', '2026-07-01', '2026-06-01', '2025-06-04'])
    expect(rows.every((r) => r.state === 'WV' && r.employees === null)).toBe(true)
  })
})

describe('Georgia WARN table (rendered by the browser job)', () => {
  it('reads company, submitted date and the number affected', () => {
    const spec = TABLE_SPECS.find((s) => s.state === 'GA')!
    const html = `<table><thead><tr><th>GA WARN ID</th><th>Company Name</th><th>Submitted Date</th><th>Total Number of Affected Employees</th></tr></thead><tbody>
      <tr><td><a href="https://www.tcsg.edu/warn-public-view/entry/41068/">GA202200071</a></td><td>Dexter Axle Company</td><td>January 17, 2023</td><td>67</td></tr>
      <tr><td><a href="#">GA202600099</a></td><td>SDH Services East</td><td>August 8, 2026</td><td>1,204</td></tr></tbody></table>`
    const rows = makeTableParser(spec)(Buffer.from(html), '')
    expect(rows).toHaveLength(2)
    expect(rows[1]).toMatchObject({ state: 'GA', employer: 'SDH Services East', employees: 1204 })
    expect(rows[1].noticeDate?.toISOString().slice(0, 10)).toBe('2026-08-08')
  })
})
