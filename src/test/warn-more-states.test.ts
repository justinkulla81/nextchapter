import { describe, expect, it } from 'vitest'
import { TABLE_SPECS, makeTableParser, parseLouisianaItems, parseHawaiiWarn, parseMinnesotaList, parseNevadaItems, parseNewMexicoItems, parseWestVirginiaWarn, resolveNewMexicoPdfs } from '@/lib/warn/states'
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

// Positions copied from https://www.laworks.net/Downloads/WFD/WarnNotices2025.pdf: no Address column (the address sits under the name),
// and the table runs onto a second page that has no header.
describe('Louisiana 2025 PDF layout', () => {
  const head = [it_('Notice', 242, 707), it_('Layoff', 294, 707), it_('Employees', 354, 707), it_('Company Name', 103, 701), it_('Industry', 473, 701)]
  const page1 = [...head,
    it_('Dr. Reddy’s Laboratories', 58, 675), it_('8800 Line Ave', 58, 662), it_('1/7/25', 244, 662), it_('3/14/25', 293, 662), it_('107', 374, 662), it_('Manufacturing', 460, 662), it_('Shreveport, LA 71106', 58, 650),
    it_('General Dynamics Information', 58, 542), it_('Technology', 58, 529), it_('3/7/25', 244, 523), it_('5/14/25', 293, 523), it_('77', 377, 523), it_('Information Technology', 438, 523),
    it_('2251 Lakeshore Drive', 58, 517), it_('New Orleans', 58, 504)]
  const page2 = [it_('Southern Glazer\'s Wine and Spirits', 58, 700), it_('of Louisiana', 58, 688), it_('939 W. Pont Des Mouton Rd', 58, 675), it_('3/14/25', 241, 681), it_('5/16/25', 293, 681), it_('48', 377, 681), it_('Lafayette, LA 70507', 58, 662)]
  it('splits the name from the address in the one column, and reads a page that has no header with the first page\'s columns', () => {
    const rows = parseLouisianaItems([page1, page2])
    expect(rows.map((r) => r.employer)).toEqual(['Dr. Reddy’s Laboratories', 'General Dynamics Information Technology', 'Southern Glazer\'s Wine and Spirits of Louisiana'])
    expect(rows[0]).toMatchObject({ employees: 107, address: '8800 Line Ave Shreveport, LA 71106' })
    expect(rows[1].address).toBe('2251 Lakeshore Drive New Orleans')
    expect(rows[2]).toMatchObject({ employees: 48, address: '939 W. Pont Des Mouton Rd Lafayette, LA 70507' })
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

// Positions copied from https://detr.nv.gov/content/media/WARN_and_Non_WARN_Master_w_Logo.pdf (saved from a browser).
describe('Nevada WARN PDF', () => {
  const header = [it_('Received', 44, 669), it_('Effective Date', 83, 669), it_('Type', 142, 669), it_('Employer', 282, 669), it_('City', 405, 669), it_('County', 455, 669),
    it_('Notification', 503, 669), it_('Date', 50, 660), it_('(Layoff,', 138, 660), it_('Affected', 174, 660), it_('(WARN, Non-', 500, 660), it_('Closure)', 137, 651), it_('Total', 180, 651), it_('WARN)', 509, 651)]
  const row = (y: number, received: string, effective: string, type: string, n: string, employer: string, city: string, county: string, note: string) =>
    [it_(received, 43, y), it_(effective, 99, y), it_(type, 133, y), it_(n, 197, y), it_(employer, 207, y), it_(city, 388, y), it_(county, 436, y), it_(note, 498, y)]
  it('keeps only WARN rows, reads fixed columns, and leaves the header lines out', () => {
    const rows = parseNevadaItems([[...header,
      ...row(642, '1/8/2026', '3/10/2026', 'Layoff', '3', 'SMBC Manubank', 'Remote', 'Remote', 'Non-WARN'),
      ...row(632, '1/22/2026', '3/15/2026', 'Layoff', '1', 'Spirit Airlines', 'Las Vegas', 'Clark', 'WARN'),
      ...row(531, '5/4/2026', '5/2/2026', 'Closure', '999', 'Spirit Airlines', 'Las Vegas/Reno', 'Clark/Washoe', 'WARN')]])
    expect(rows).toHaveLength(2)
    expect(rows[1]).toMatchObject({ state: 'NV', employer: 'Spirit Airlines', employees: 999, layoffType: 'Closure', county: 'Clark/Washoe', address: 'Las Vegas/Reno' })
    expect(rows[1].noticeDate?.toISOString().slice(0, 10)).toBe('2026-05-04')
    expect(rows[0].layoffType).toBe('Layoff')
  })
})

describe('Mississippi quarterly PDFs', () => {
  it('lists the newest five once each, across both naming styles', async () => {
    const { resolveMississippiPdfs } = await import('@/lib/warn/states')
    const html = ['/media/1/warn-py2026-qtr-1-jul-sep-2026.pdf', '/media/2/warn-py2025-qtr-4-apr-jun-2026.pdf', '/media/3/warn-py2025-qtr-3-jan-mar-2026.pdf', '/media/3/warn-py2025-qtr-3-jan-mar-2026.pdf',
      '/media/4/warn-py2025-qtr-2-oct-dec-2025.pdf', '/media/5/warn-py2025-qtr-1-jul-sep-2025.pdf', '/media/6/warn-py2024-q4-warn-apr2025-jun2025.pdf'].map((h) => `<a href="${h}">x</a>`).join('')
    expect(resolveMississippiPdfs(html)).toEqual([1, 2, 3, 4, 5].map((n) => `https://mdes.ms.gov/media/${n}/${['warn-py2026-qtr-1-jul-sep-2026', 'warn-py2025-qtr-4-apr-jun-2026', 'warn-py2025-qtr-3-jan-mar-2026', 'warn-py2025-qtr-2-oct-dec-2025', 'warn-py2025-qtr-1-jul-sep-2025'][n - 1]}.pdf`))
  })
})

describe('Minnesota list lines', () => {
  it('reads "Employer - date" lines, with 2- and 4-digit years, and skips revisions and other text', () => {
    const rows = parseMinnesotaList(['Pearson\'s Candy Company (Revision 2) - 10/20/2026', '3M Company - 10/19/2026', 'Pearson\'s Candy Company - 7/30/2026', 'Estee Lauder Companies, Inc. - 2/24/26', 'Not a notice', 'Chartwells - St Cloud State University - 4/24/2026'].join('\n'))
    expect(rows.map((r) => r.employer)).toEqual(['3M Company', 'Pearson\'s Candy Company', 'Estee Lauder Companies, Inc.', 'Chartwells - St Cloud State University'])
    expect(rows.map((r) => r.noticeDate?.toISOString().slice(0, 10))).toEqual(['2026-10-19', '2026-07-30', '2026-02-24', '2026-04-24'])
    expect(rows.every((r) => r.state === 'MN' && r.employees === null)).toBe(true)
  })
})

describe('Hawaii current WARN list', () => {
  const a = (slug: string, text: string) => `<a href="https://labor.hawaii.gov/wdd/warn-notices/warn-notice-${slug}/">${text}</a>`
  it('takes the employer and date from each link, drops the parenthetical reason, and ignores other links', () => {
    const html = [
      a('ben-bridge', 'Ben Bridge Jeweler, Inc. (Rolex Boutique Closing/Transition to Bucherer Store) &#8211; October 15, 2026'),
      a('hawaiian', 'Hawaiian Airlines – Non-Union Workforce Reduction (Alaska Air Group, Inc. merger) &#8211; October 2, 2026'),
      a('laie', 'Laie Water Company, Inc. &#8211; September 25, 2026'),
      '<a href="/wdd/about/">About WARN</a>',
    ].join('')
    const rows = parseHawaiiWarn(html)
    expect(rows.map((r) => r.employer)).toEqual(['Ben Bridge Jeweler, Inc.', 'Hawaiian Airlines – Non-Union Workforce Reduction', 'Laie Water Company, Inc.'])
    expect(rows.map((r) => r.noticeDate?.toISOString().slice(0, 10))).toEqual(['2026-10-15', '2026-10-02', '2026-09-25'])
    expect(rows.every((r) => r.state === 'HI')).toBe(true)
  })
})
