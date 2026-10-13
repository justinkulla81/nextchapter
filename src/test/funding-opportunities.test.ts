import { describe, expect, it } from 'vitest'
import { audienceOf, agencyFromSamPath, isLive, isRelevant, meaningfulDeadline, parseUsDate, titleScore, toLead, type FundingNotice } from '@/lib/funding-opportunities/relevance'
import { noticesFromHits } from '@/lib/funding-opportunities/grants-gov'
import { noticesFromSam } from '@/lib/funding-opportunities/sam-gov'

const NOW = new Date('2026-10-12T12:00:00Z')

const notice = (over: Partial<FundingNotice> = {}): FundingNotice => ({
  source: 'grants.gov', id: 'ETA-1', title: 'Dislocated Worker Grants', kind: 'GRANT',
  agency: 'Employment and Training Administration', agencyType: 'FUNDER_GRANT',
  postedAt: new Date('2026-10-01'), closesAt: new Date('2026-12-01'),
  url: 'https://www.grants.gov/search-results-detail/1', state: null, city: null, matched: ['dislocated worker'], contact: null,
  ...over,
})

describe('titleScore', () => {
  it('scores titles that name the subject', () => {
    expect(titleScore('Outplacement and career transition services')).toBeGreaterThan(5)
    expect(titleScore('National Dislocated Worker Grant Program')).toBeGreaterThan(0)
  })
  it('scores zero for unrelated titles', () => {
    expect(titleScore('Janitorial services, Building 4')).toBe(0)
    expect(titleScore('Fish hatchery maintenance')).toBe(0)
  })
})

describe('isRelevant', () => {
  it('accepts a Labor Department issuer or a subject title', () => {
    expect(isRelevant({ title: 'Annual guidance', agencyCode: 'DOL-ETA' })).toBe(true)
    expect(isRelevant({ title: 'Reemployment services pilot', agencyCode: 'HHS-NIH' })).toBe(true)
  })
  it('rejects guidance letters and planning documents even from Labor', () => {
    expect(isRelevant({ title: 'Training and Employment Guidance Letter (02-26) for FY 2026', agencyCode: 'DOL-ETA' })).toBe(false)
    expect(isRelevant({ title: 'FY2027 State Workforce Agency UI Resource Planning Targets and Guidelines', agencyCode: 'DOL-ETA' })).toBe(false)
  })
  it('keeps the Dislocated Worker Grant program page', () => {
    expect(isRelevant({ title: 'Updated National Dislocated Worker Grant Program Guidance and Application Information', agencyCode: 'DOL-ETA' })).toBe(true)
  })
  it('does not let a bare "workforce development" in from another agency', () => {
    expect(isRelevant({ title: 'Innovative Water Infrastructure Workforce Development Grant', agencyCode: 'EPA' })).toBe(false)
  })
  it('rejects a loose full-text hit from an unrelated agency', () => {
    expect(isRelevant({ title: 'HEAL Initiative: Chronic Pain and OUD', agencyCode: 'HHS-NIH11' })).toBe(false)
  })
})

describe('dates', () => {
  it('parses the US format both APIs use', () => {
    expect(parseUsDate('10/30/2026')?.toISOString().slice(0, 10)).toBe('2026-10-30')
    expect(parseUsDate(undefined)).toBeNull()
  })
  it('drops closed and stale notices, keeps open ones', () => {
    expect(isLive(notice({ closesAt: new Date('2026-09-01') }), NOW, 30)).toBe(false)
    expect(isLive(notice({ postedAt: new Date('2026-06-01'), closesAt: null }), NOW, 30)).toBe(false)
    expect(isLive(notice({ postedAt: new Date('2026-06-01') }), NOW, 30)).toBe(true) // still open
    expect(isLive(notice({ closesAt: null }), NOW, 30)).toBe(true)
  })
  it('treats a close date years out as no deadline', () => {
    expect(meaningfulDeadline({ closesAt: new Date('2028-12-31') }, NOW)).toBeNull()
    expect(meaningfulDeadline({ closesAt: new Date('2026-12-01') }, NOW)?.toISOString().slice(0, 10)).toBe('2026-12-01')
  })
})

describe('agencyFromSamPath', () => {
  it('reads the SAM hierarchy as a department and office', () => {
    expect(agencyFromSamPath('LABOR, DEPARTMENT OF.EMPLOYMENT AND TRAINING ADMINISTRATION.REGION 4')).toBe(
      'Department of Labor — Employment and Training Administration'
    )
  })
  it('falls back when empty', () => {
    expect(agencyFromSamPath('')).toBe('Federal agency')
  })
})

describe('noticesFromHits', () => {
  it('merges a notice found by two keywords and records both', () => {
    const hit = { id: '9', number: 'X-9', title: 'Reemployment Services', agency: 'DOL', openDate: '10/01/2026', closeDate: '11/01/2026', oppStatus: 'posted' }
    const out = noticesFromHits({ reemployment: [hit], 'dislocated worker': [hit] })
    expect(out).toHaveLength(1)
    expect(out[0].matched).toEqual(['reemployment', 'dislocated worker'])
    expect(out[0].url).toBe('https://www.grants.gov/search-results-detail/9')
  })
  it('marks forecasted opportunities', () => {
    const out = noticesFromHits({ a: [{ id: '1', title: 'T', agency: 'A', oppStatus: 'forecasted' }] })
    expect(out[0].kind).toBe('FORECAST')
  })
})

describe('noticesFromSam', () => {
  const opp = {
    noticeId: 'abc', title: 'Outplacement services for separated employees', solicitationNumber: 'W123',
    fullParentPathName: 'DEFENSE, DEPARTMENT OF.DEPT OF THE ARMY', postedDate: '2026-10-05', type: 'Sources Sought',
    responseDeadLine: '2026-11-01T17:00:00-04:00', officeAddress: { city: 'Fort Liberty', state: 'NC' },
    pointOfContact: [{ fullName: 'Pat Contracting', email: 'pat@army.mil', type: 'primary' }],
  }
  it('keeps relevant titles, as an RFI, with the published contact', () => {
    const out = noticesFromSam({ '561311': [opp, { ...opp, noticeId: 'zzz', title: 'Mowing services' }] })
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ kind: 'RFI', agency: 'Department of Defense — Dept of the Army', state: 'NC' })
    expect(out[0].contact?.email).toBe('pat@army.mil')
  })
  it('merges the same notice found under two NAICS codes', () => {
    const out = noticesFromSam({ '561311': [opp], '541612': [opp] })
    expect(out).toHaveLength(1)
    expect([...out[0].matched].sort()).toEqual(['NAICS 541612', 'NAICS 561311'])
  })
})

describe('audience', () => {
  it('tags grants as for customers to win and solicitations as ours to bid', () => {
    expect(audienceOf('GRANT')).toBe('CUSTOMERS')
    expect(audienceOf('FORECAST')).toBe('CUSTOMERS')
    expect(audienceOf('RFP')).toBe('US')
    expect(audienceOf('RFI')).toBe('US')
  })
  it('carries the tag into the CRM note', () => {
    const grant = toLead(notice(), NOW)
    expect(grant.trigger.headline).toMatch(/^\[For customers to win\]/)
    expect(grant.why).toMatch(/Workforce boards, states and nonprofits can apply/)
    const rfp = toLead(notice({ source: 'sam.gov', kind: 'RFP' }), NOW)
    expect(rfp.trigger.headline).toMatch(/^\[For us to bid\]/)
  })
})

describe('SAM.gov as documented', () => {
  const base = { noticeId: 'n1', title: 'Outplacement services', fullParentPathName: 'LABOR, DEPARTMENT OF', postedDate: '2026-10-05 14:30:00' }
  it('keeps solicitations and sources sought, drops award notices', () => {
    const out = noticesFromSam({ '561311': [
      { ...base, noticeId: 'a', type: 'Solicitation', baseType: 'Solicitation' },
      { ...base, noticeId: 'b', type: 'Sources Sought', baseType: 'Sources Sought' },
      { ...base, noticeId: 'c', type: 'Award Notice', baseType: 'Award Notice' },
      { ...base, noticeId: 'd', type: 'Justification', baseType: 'Justification' },
    ] })
    expect(out.map((n) => n.id).sort()).toEqual(['a', 'b'])
  })
  it('reads the documented posted-date format', () => {
    expect(parseUsDate('2026-10-05 14:30:00')?.toISOString().slice(0, 10)).toBe('2026-10-05')
  })
})

describe('toLead', () => {
  it('files informationally: an RFP-kind note, never P0', () => {
    const lead = toLead(notice(), NOW)
    expect(lead.p0).toBe(false)
    expect(lead.trigger.kind).toBe('RFP')
    expect(lead.trigger.deadline?.toISOString().slice(0, 10)).toBe('2026-12-01')
    expect(lead.org.type).toBe('FUNDER_GRANT')
    expect(lead.person).toBeNull()
  })
})

describe('eligibility on the CRM note', () => {
  it('says how we can pursue it in the headline and why in the summary', () => {
    const lead = toLead(notice({ eligibility: 'VIA_PARTNER', eligibilityNote: 'Only state agencies can apply.' }), NOW)
    expect(lead.trigger.headline).toMatch(/^\[For customers to win · via partner\]/)
    expect(lead.trigger.summary).toMatch(/Only state agencies can apply/)
  })
})
