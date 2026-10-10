// SEC "likely openings": 8-K Item 5.02 role parsing, Form D filtering, and
// candidate ranking — fixture text modeled on real filings.
import { describe, it, expect, vi } from 'vitest'
vi.mock('server-only', () => ({}))
vi.mock('@/lib/prisma', () => ({ prisma: {} }))
import { htmlToText, extractItem502, readItem502, execSignalsFrom, isNonOperating8kFiler } from '@/lib/likely-openings/parse-8k'
import { parseFormDXml, judgeFormD, formatAmount, looksLikeVehicleName } from '@/lib/likely-openings/parse-form-d'
import { companyKey } from '@/lib/likely-openings/roles'
import { scoreLikelyOpening } from '@/lib/likely-openings/for-candidate'

const COVER = `<p>Check the appropriate box below if the Form 8-K filing is intended to satisfy... Item 5.02 Departure of Directors</p>`
const SIGNATURE = `<p>SIGNATURE</p><p>Pursuant to the requirements of the Securities Exchange Act of 1934... By: /s/ Andre Maciel, Executive Vice President &amp; Chief Financial Officer</p>`

function read(body: string) {
  const section = extractItem502(htmlToText(`${COVER}<p>Item 5.02. Departure of Directors or Certain Officers; Election of Directors; Appointment of Certain Officers; Compensatory Arrangements of Certain Officers.</p>${body}<p>Item 9.01 Financial Statements and Exhibits.</p>${SIGNATURE}`))
  expect(section).not.toBeNull()
  return readItem502(section!)
}

describe('8-K Item 5.02 parsing', () => {
  it('reads a plain resignation as an opening, and ignores the signature block', () => {
    const r = read(`<p>On October 2, 2026, Angel S. Willis, Executive Vice President, Global General Counsel and Corporate Affairs Officer, notified The Kraft Heinz Company (the &#8220;Company&#8221;) that she has decided to resign from her position with the Company, effective October 20, 2026, to pursue other opportunities.</p>`)
    expect(r.openings).toEqual(['GC'])
    expect(r.appointed).toEqual([])
  })

  it('treats an interim appointment as the role still being open', () => {
    const r = read(`<p>Retirement of Chief Financial Officer</p><p>On October 5, 2026, K. Christopher Farkas, Executive Vice President and Chief Financial Officer of Curtiss-Wright Corporation (the "Company"), informed the Company that he will be retiring effective at calendar year-end. Mr. Farkas joined the Company over 17 years ago and has served as Chief Financial Officer since May 2020. The Company has commenced a search for Mr. Farkas' replacement.</p><p>Appointment of Interim Chief Financial Officer</p><p>The Board of Directors of the Company has appointed Gary A. Ogilby, Senior Vice President and Corporate Controller of the Company, to serve as the Company's Interim Chief Financial Officer, effective as of October 6, 2026. Mr. Ogilby will continue to serve as principal accounting officer of the Company during his tenure as Interim Chief Financial Officer.</p>`)
    expect(r.openings).toEqual(['CFO'])
    expect(r.interim).toEqual(['CFO'])
    expect(r.appointed).toEqual([])
    expect(r.searchUnderway).toBe(true)
  })

  it('a departure with a named permanent successor is an appointment, not an opening', () => {
    const r = read(`<p>On October 1, 2026, John Smith informed the Board that he will retire as Chief Executive Officer effective December 31, 2026. On the same date, the Board appointed Jane Roe, age 52, as Chief Executive Officer, effective January 1, 2027.</p>`)
    expect(r.openings).toEqual([])
    expect(r.appointed).toEqual(['CEO'])
    const signals = execSignalsFrom('Acme', r)
    expect(signals).toHaveLength(1)
    expect(signals[0].signalType).toBe('EXEC_APPOINTMENT')
    expect(signals[0].summary).toMatch(/rebuild the leadership team/)
  })

  it('a promotion opens the seat the person leaves', () => {
    const r = read(`<p>On September 30, 2026, the Board approved the appointment of Warren Stone, the Company's current Chief Operating Officer, as Chief Executive Officer of the Company.</p>`)
    expect(r.appointed).toEqual(['CEO'])
    expect(r.openings).toEqual(['COO'])
  })

  it('ignores director-only changes, biographies and compensation terms', () => {
    const r = read(`<p>On October 5, 2026, the Board appointed Charles Bell to serve as a director of the Company. Mr. Bell, age 68, previously served as Chief Technology Officer at Microsoft from 2015 to 2021.</p><p>Under his employment agreement, upon a termination without cause, the Chief Executive Officer will be entitled to severance equal to 12 months of base salary.</p><p>As previously disclosed, Arturo Rodriguez resigned as Chief Financial Officer in July 2026.</p>`)
    expect(r.openings).toEqual([])
    expect(r.appointed).toEqual([])
  })

  it('does not read "Vice President" as President, or "advisor to the CEO" as the CEO', () => {
    const r = read(`<p>On October 1, 2026, Richard Harbison, Executive Vice President, Refining, notified the Company that he will retire and will serve as Senior Advisor to the Chief Executive Officer until then.</p>`)
    expect(r.openings).toEqual([])
  })

  it('writes a plain-language departure summary', () => {
    const [signal] = execSignalsFrom('Portillo’s', { openings: ['CHRO'], appointed: [], interim: [], searchUnderway: false })
    expect(signal.summary).toBe('Portillo’s\'s Chief People Officer is leaving. A search for a replacement usually follows.')
  })

  it('skips funds, BDCs and blank-check filers', () => {
    expect(isNonOperating8kFiler('Ares Core Infrastructure Fund', [], ['814-01811'])).toBe(true)
    expect(isNonOperating8kFiler('VanEck Solana ETF', ['6221'], [])).toBe(true)
    expect(isNonOperating8kFiler("Portillo's Inc.", ['5812'], ['001-40951'])).toBe(false)
  })
})

function formD(over: Partial<Record<string, string>> = {}) {
  const v = {
    name: 'Luminal AI, Inc.', entityType: 'Corporation', industry: 'Computers', amendment: 'false',
    offered: '29163244', sold: '29163244', exemption: '06b', fundInfo: '', ...over,
  }
  return `<?xml version="1.0"?><edgarSubmission><submissionType>D</submissionType>
  <primaryIssuer><cik>0002159178</cik><entityName>${v.name}</entityName><issuerAddress><city>SAN FRANCISCO</city><stateOrCountry>CA</stateOrCountry></issuerAddress><entityType>${v.entityType}</entityType></primaryIssuer>
  <offeringData><industryGroup><industryGroupType>${v.industry}</industryGroupType>${v.fundInfo}</industryGroup>
  <federalExemptionsExclusions><item>${v.exemption}</item></federalExemptionsExclusions>
  <typeOfFiling><newOrAmendment><isAmendment>${v.amendment}</isAmendment></newOrAmendment></typeOfFiling>
  <offeringSalesAmounts><totalOfferingAmount>${v.offered}</totalOfferingAmount><totalAmountSold>${v.sold}</totalAmountSold></offeringSalesAmounts>
  </offeringData></edgarSubmission>`
}

describe('Form D filtering', () => {
  it('parses the issuer and amounts', () => {
    const f = parseFormDXml(formD())!
    expect(f.cik).toBe('2159178')
    expect(f.entityName).toBe('Luminal AI, Inc.')
    expect(f.totalAmountSold).toBe(29163244)
    expect(f.city).toBe('SAN FRANCISCO')
  })

  it('keeps a $10M+ new raise at an operating company', () => {
    expect(judgeFormD(parseFormDXml(formD())!)).toEqual({ keep: true, amount: 29163244, closed: true })
  })

  it('counts a big open round that has started selling', () => {
    expect(judgeFormD(parseFormDXml(formD({ offered: '50000000', sold: '4000000' }))!)).toEqual({ keep: true, amount: 50000000, closed: false })
    expect(judgeFormD(parseFormDXml(formD({ offered: 'Indefinite', sold: '4000000' }))!).keep).toBe(false)
  })

  it('drops small raises, amendments, funds, real estate, LPs and SPV names', () => {
    const reason = (over: Partial<Record<string, string>>) => {
      const v = judgeFormD(parseFormDXml(formD(over))!)
      return v.keep ? 'kept' : v.reason
    }
    expect(reason({ sold: '2500000', offered: '5000000' })).toBe('below threshold')
    expect(reason({ amendment: 'true' })).toBe('amendment')
    expect(reason({ industry: 'Pooled Investment Fund', fundInfo: '<investmentFundInfo><investmentFundType>Venture Capital Fund</investmentFundType></investmentFundInfo>' })).toBe('pooled fund')
    expect(reason({ exemption: '3C.7' })).toBe('investment company exemption')
    expect(reason({ industry: 'Residential' })).toBe('industry: Residential')
    expect(reason({ industry: 'Commercial Banking' })).toBe('kept')
    expect(reason({ entityType: 'Limited Partnership' })).toBe('limited partnership')
    expect(reason({ name: 'Kidsy I, a series of Capitalize Investments LLC' })).toBe('investment vehicle name')
    expect(reason({ name: '1330 Conn Investors LLC' })).toBe('investment vehicle name')
  })

  it('spots vehicle names before fetching the XML', () => {
    expect(looksLikeVehicleName('BIQ Venture Series I, LP')).toBe(true)
    expect(looksLikeVehicleName('Empire Skyline Fund II, LLC')).toBe(true)
    expect(looksLikeVehicleName('Luminal AI, Inc.')).toBe(false)
    expect(looksLikeVehicleName('HiredMD, Inc.')).toBe(false)
  })

  it('formats amounts', () => {
    expect(formatAmount(29_163_244)).toBe('$29.2M')
    expect(formatAmount(150_000_000)).toBe('$150M')
    expect(formatAmount(1_200_000_000)).toBe('$1.2B')
  })
})

describe('company key', () => {
  it('joins SEC filer names to typed names', () => {
    expect(companyKey('Tenable Holdings, Inc.')).toBe(companyKey('Tenable'))
    expect(companyKey('AGCO CORP /DE')).toBe(companyKey('AGCO'))
    expect(companyKey('BANK OF AMERICA CORP /DE/')).toBe(companyKey('Bank of America'))
    expect(companyKey('Kraft Heinz Co')).toBe(companyKey('Kraft Heinz'))
  })
})

describe('candidate ranking', () => {
  const now = new Date('2026-10-09T12:00:00Z')
  const base = { filingDate: new Date('2026-10-05T12:00:00Z'), amountRaised: null, companyRelation: null }
  const financeVp = { id: 'c1', primaryFunction: 'Finance', highestLevelReached: 'VP' }

  it('ranks a watched company above a better role fit elsewhere', () => {
    const watched = scoreLikelyOpening({ ...base, signalType: 'EXEC_DEPARTURE', roles: ['CMO'], companyRelation: 'watched' }, financeVp, now)
    const fit = scoreLikelyOpening({ ...base, signalType: 'EXEC_DEPARTURE', roles: ['CFO'] }, financeVp, now)
    expect(watched.score).toBeGreaterThan(fit.score)
    expect(watched.reason).toBe('On your Company Tracker')
  })

  it('scores function fit above a mismatched role', () => {
    const cfo = scoreLikelyOpening({ ...base, signalType: 'EXEC_DEPARTURE', roles: ['CFO'] }, financeVp, now)
    const gc = scoreLikelyOpening({ ...base, signalType: 'EXEC_DEPARTURE', roles: ['GC'] }, financeVp, now)
    expect(cfo.functionFit).toBe(true)
    expect(cfo.reason).toBe('Fits your finance background')
    expect(cfo.score).toBeGreaterThan(gc.score)
  })

  it('favors funding rounds over C-suite departures for a manager', () => {
    const manager = { id: 'c2', primaryFunction: 'Marketing', highestLevelReached: 'Manager' }
    const raise = scoreLikelyOpening({ ...base, signalType: 'FUNDING_RAISE', roles: [], amountRaised: 40_000_000 }, manager, now)
    const departure = scoreLikelyOpening({ ...base, signalType: 'EXEC_DEPARTURE', roles: ['CFO'] }, manager, now)
    expect(raise.score).toBeGreaterThan(departure.score)
  })
})
