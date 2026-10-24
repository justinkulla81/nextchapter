import { describe, expect, it } from 'vitest'
import { awardIsWorkforce, bidFitsUs } from '@/lib/bids/relevance'
import { extractBids } from '@/lib/bids/parse'

describe('bidFitsUs', () => {
  it('keeps workforce and technology bids', () => {
    expect(bidFitsUs('RFP: One-Stop Operator for Mid-Maryland Workforce Services')).toBe(true)
    expect(bidFitsUs('RFI: AI Training Providers')).toBe(true)
    expect(bidFitsUs('Website Design, Development and Implementation - RFP (#26-501)')).toBe(true)
  })
  it('drops facilities and back-office bids', () => {
    expect(bidFitsUs('2026-030 IFB Courthouse Roof-Phase 2')).toBe(false)
    expect(bidFitsUs('Request for Proposals – SNOW AND ICE REMOVAL SERVICES')).toBe(false)
    expect(bidFitsUs('RFQ for Financial Audit and Tax Services')).toBe(false)
  })
})

describe('awardIsWorkforce', () => {
  it('flags Labor Department money and employment wording', () => {
    expect(awardIsWorkforce({ agency: 'Department of Labor', description: 'bridge' })).toBe(true)
    expect(awardIsWorkforce({ agency: 'Department of Education', description: 'TO MOVE SCSEP PARTICIPANTS INTO UNSUBSIDIZED EMPLOYMENT' })).toBe(true)
    expect(awardIsWorkforce({ agency: 'Department of the Treasury', description: 'IRS MASTERFILE TAX PROCESSING' })).toBe(false)
  })
})

describe('page furniture is not a bid', () => {
  const NOW = new Date('2026-10-24T12:00:00Z')
  const html = `<h2>Bids</h2><ul>
    <li>Closing Date Bid Number (Ascending) Bid Number (Descending)</li>
    <li>Q25: The cover page on the proposal</li>
    <li>(503) 400-5504 - Application Open Date: Friday, October 16, 2026, at 8:00 AM</li>
    <li>RFP / RFQ - Eastern Connecticut Workforce Investment Board</li>
    <li>SUGGESTED READING BEFORE RESPONDING TO AN RFP OR RFQ</li>
    <li>RFP 2026-004: WIOA Out-of-School Youth Service Provision</li></ul>`
  it('keeps only the real bid', () => {
    const bids = extractBids(html, 'https://wdb.example/rfp', 'X-1', NOW)
    expect(bids.map((b) => b.title)).toEqual(['RFP 2026-004: WIOA Out-of-School Youth Service Provision'])
  })
  it('does not turn the South Central question-deadline line into a bid', async () => {
    const { readFileSync } = await import('node:fs')
    const bids = extractBids(readFileSync('src/test/fixtures/scwdb-rfp.html', 'utf8'), 'https://southcentralworkforce.com/request-for-proposals', 'KY-243', NOW)
    expect(bids.some((b) => /questions in writing/i.test(b.title))).toBe(false)
    expect(bids).toHaveLength(2)
  })
})
