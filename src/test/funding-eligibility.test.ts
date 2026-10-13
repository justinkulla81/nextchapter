import { describe, expect, it } from 'vitest'
import { plainText } from '@/lib/funding-opportunities/grants-gov'
import { inStateScope, statesFromText, classifyGrant, classifySetAside, kindsForCustomerType, kindsForOrg, isWorkforceBoardOrStateAgency, matchesOrgKinds, applicantKindsFromGrant } from '@/lib/funding-opportunities/eligibility'

describe('classifyGrant', () => {
  it('open to for-profits or unrestricted is direct', () => {
    expect(classifyGrant(['22'], '').eligibility).toBe('DIRECT')
    expect(classifyGrant(['99'], '').eligibility).toBe('DIRECT')
    expect(classifyGrant(['25'], 'Small businesses are eligible to apply.').eligibility).toBe('DIRECT')
  })
  it('only colleges and nonprofits is via partner, naming who', () => {
    const r = classifyGrant(['06', '12'], '')
    expect(r.eligibility).toBe('VIA_PARTNER')
    expect(r.partnerKinds).toEqual(expect.arrayContaining(['HIGHER_ED', 'NONPROFIT']))
    expect(r.note).toMatch(/vendor or subrecipient/)
  })
  it('reads free text when the code is just "Others" (the Dislocated Worker Grant case)', () => {
    const r = classifyGrant(['25'], 'Disaster Recovery DWGs: 1. State workforce agencies administering WIOA formula funds; 2. Outlying areas; or 3. Indian tribes.')
    expect(r.eligibility).toBe('VIA_PARTNER')
    expect(r.kinds).toEqual(expect.arrayContaining(['STATE_GOV', 'TRIBAL']))
  })
  it('honors negation: a for-profit exclusion is not eligibility', () => {
    const r = classifyGrant(['22'], 'For-profit organizations are not eligible. Nonprofit organizations may apply.')
    expect(r.kinds).not.toContain('FOR_PROFIT')
    expect(r.eligibility).toBe('VIA_PARTNER')
  })
  it('drops individuals-only and tribes-only', () => {
    expect(classifyGrant(['21'], '').eligibility).toBe('NOT_ELIGIBLE')
    expect(classifyGrant(['07'], '').eligibility).toBe('NOT_ELIGIBLE')
  })
  it('says unknown rather than guessing when nothing is stated', () => {
    expect(classifyGrant(['25'], 'See the full announcement.').eligibility).toBe('UNKNOWN')
  })
  it('does not read "eligible individuals" (participants) as individual applicants', () => {
    expect(applicantKindsFromGrant(['00'], 'Services for eligible individuals who are dislocated.')).toEqual(['STATE_GOV'])
  })
})

describe('classifySetAside', () => {
  it('open competition and small business are direct', () => {
    expect(classifySetAside(null).eligibility).toBe('DIRECT')
    expect(classifySetAside('SBA').eligibility).toBe('DIRECT')
  })
  it('certifications we do not hold are not eligible', () => {
    const r = classifySetAside('8A', 'Competitive 8(a)')
    expect(r.eligibility).toBe('NOT_ELIGIBLE')
    expect(r.note).toMatch(/8\(a\)/)
    expect(classifySetAside('SDVOSBC').eligibility).toBe('NOT_ELIGIBLE')
  })
})

describe('matching', () => {
  const opp = { eligibility: 'VIA_PARTNER' as const, kinds: ['STATE_GOV' as const, 'NONPROFIT' as const] }
  it('maps org types and deck types to applicant kinds', () => {
    expect(kindsForOrg({ orgTypes: ['UNIVERSITY'], name: 'State University' })).toEqual(['HIGHER_ED'])
    expect(kindsForOrg({ orgTypes: ['GOVERNMENT'], name: 'San Diego Workforce Development Board' })).toEqual(['STATE_GOV', 'LOCAL_GOV'])
    expect(kindsForOrg({ orgTypes: ['EMPLOYER'], name: 'Acme' })).toEqual([])
    expect(kindsForCustomerType('HIGHER_ED')).toEqual(['HIGHER_ED'])
  })
  it('matches only organizations of an eligible kind', () => {
    expect(matchesOrgKinds(opp, kindsForOrg({ orgTypes: ['NONPROFIT'], name: 'A Nonprofit' }))).toBe(true)
    expect(matchesOrgKinds(opp, kindsForOrg({ orgTypes: ['UNIVERSITY'], name: 'State University' }))).toBe(false)
  })
  it('lets unrestricted notices fit any customer, and never matches not-eligible', () => {
    expect(matchesOrgKinds({ eligibility: 'DIRECT', kinds: ['UNRESTRICTED'] }, ['HIGHER_ED'])).toBe(true)
    expect(matchesOrgKinds({ eligibility: 'NOT_ELIGIBLE', kinds: ['HIGHER_ED'] }, ['HIGHER_ED'])).toBe(false)
  })
})

describe('plainText', () => {
  it('turns Grants.gov entities into text the rules can read', () => {
    expect(plainText('for&#8208;profit and&nbsp;nonprofit <b>entities</b>')).toBe('for-profit and nonprofit  entities ')
    expect(classifyGrant([], plainText('for&#8208;profit organizations are not eligible.')).kinds).not.toContain('FOR_PROFIT')
  })
})

describe('workforce boards and state agencies only', () => {
  it('trusts the board directory, even for a city that runs its board', () => {
    expect(isWorkforceBoardOrStateAgency('City of Shreveport', true)).toBe(true)
    expect(isWorkforceBoardOrStateAgency('City of Shreveport', false)).toBe(false)
  })
  it('catches boards and state agencies the directory does not list', () => {
    for (const n of ['Nevadaworks', 'WorkSource Atlanta Board', 'EmployIndy', 'Mississippi Department of Employment Security', 'State of Ohio Office of Workforce Transformation', 'LWIA 7'])
      expect(isWorkforceBoardOrStateAgency(n, false)).toBe(true)
  })
  it('leaves out government bodies that are not grantees for workforce grants', () => {
    for (const n of ['Federal Reserve Banks', 'International Monetary Fund', 'National Governors Association (NGA)', 'U.S. Census Bureau', 'National Science Foundation', 'NIST'])
      expect(kindsForOrg({ orgTypes: ['GOVERNMENT'], name: n })).toEqual([])
  })
})

describe('state scope', () => {
  it('reads a restriction to a state from the eligibility prose', () => {
    expect(statesFromText('Applicants must be located in the State of Ohio.')).toEqual(['OH'])
    expect(statesFromText('Open to nonprofits based in New Mexico and organizations serving West Virginia.')).toEqual(['NM', 'WV'])
    expect(statesFromText('Eligibility is limited to applicants in Texas.')).toEqual(['TX'])
  })
  it('does not treat a mentioned state as a restriction', () => {
    expect(statesFromText('Past awards include a project in Texas and one in Ohio.')).toEqual([])
    expect(statesFromText('State workforce agencies administering WIOA formula funds.')).toEqual([])
    expect(statesFromText('Organizations located in Ohio are not eligible.')).toEqual([])
  })
  it('keeps nationwide grants for everyone and restricted ones for their states only', () => {
    expect(inStateScope([], null)).toBe(true)
    expect(inStateScope(['OH'], 'OH')).toBe(true)
    expect(inStateScope(['OH'], 'ca')).toBe(false)
    expect(inStateScope(['OH'], 'NATIONAL')).toBe(false)
    expect(inStateScope(['OH'], null)).toBe(false)
  })
})
