import { describe, it, expect } from 'vitest'
import {
  planResumePrefill,
  withoutPrefill,
  detectClearance,
  detectWorkAuthorization,
  detectLicenses,
  detectHomeLocation,
  type PrefillCurrent,
} from '@/lib/resume/resume-prefill'

const blank: PrefillCurrent = {
  currentCity: null,
  currentState: null,
  yearsExperience: null,
  resumeLatestJobTitle: null,
  primaryFunction: null,
  industryContext: null,
  highestEducationLevel: null,
  resumeKeywords: [],
  licensesHeld: [],
  clearanceLevel: null,
  workAuthorization: null,
  resumePrefilledFields: [],
  licensesAnsweredAt: null,
}

describe('planResumePrefill', () => {
  it('fills blank fields and marks them', () => {
    const r = planResumePrefill(blank, { currentCity: 'Denver', currentState: 'CO', yearsExperience: 18, clearanceLevel: 'secret' })
    expect(r.data).toEqual({ currentCity: 'Denver', currentState: 'CO', yearsExperience: 18, clearanceLevel: 'secret' })
    expect(r.filled).toEqual(['currentCity', 'currentState', 'yearsExperience', 'clearanceLevel'])
    expect(r.resumePrefilledFields.sort()).toEqual(['clearanceLevel', 'currentCity', 'currentState', 'yearsExperience'])
  })

  it('never overwrites what the member entered themselves', () => {
    const r = planResumePrefill({ ...blank, currentCity: 'Boulder', clearanceLevel: 'none' }, { currentCity: 'Denver', clearanceLevel: 'secret' })
    expect(r.data).toEqual({})
    expect(r.filled).toEqual([])
  })

  it('replaces an earlier résumé value the member has not confirmed', () => {
    const r = planResumePrefill({ ...blank, currentCity: 'Denver', resumePrefilledFields: ['currentCity'] }, { currentCity: 'Austin' })
    expect(r.data).toEqual({ currentCity: 'Austin' })
  })

  it('skips empty résumé values and unchanged ones', () => {
    const r = planResumePrefill({ ...blank, currentCity: 'Denver', resumePrefilledFields: ['currentCity'] }, { currentCity: 'Denver', currentState: '', resumeKeywords: [] })
    expect(r.filled).toEqual([])
  })

  it('leaves an answered licenses question alone, even when the answer was none', () => {
    const r = planResumePrefill({ ...blank, licensesAnsweredAt: new Date() }, { licensesHeld: ['pmp'] })
    expect(r.data).toEqual({})
  })

  it('confirming a section clears only that section’s marks', () => {
    expect(withoutPrefill(['currentCity', 'currentState', 'yearsExperience'], 'basics')).toEqual(['yearsExperience'])
  })
})

describe('detectClearance', () => {
  it('reads held clearances, highest first', () => {
    expect(detectClearance('Active TS/SCI with full-scope polygraph')).toBe('ts_sci')
    expect(detectClearance('Clearance: Top Secret')).toBe('top_secret')
    expect(detectClearance('Holds an active Secret clearance.')).toBe('secret')
    expect(detectClearance('Public Trust clearance (DHS)')).toBe('public_trust')
  })
  it('ignores clearances the member could obtain, and unrelated "secret"', () => {
    expect(detectClearance('Able to obtain a Secret clearance')).toBeNull()
    expect(detectClearance('Eligible for TS/SCI')).toBeNull()
    expect(detectClearance("Victoria's Secret, merchandising lead")).toBeNull()
  })
})

describe('detectWorkAuthorization', () => {
  it('reads explicit statements only', () => {
    expect(detectWorkAuthorization('U.S. Citizen | Seattle, WA')).toBe('us_citizen')
    expect(detectWorkAuthorization('Languages & Citizenship: Fluent in English, US & Brazilian Citizen')).toBe('us_citizen')
    expect(detectWorkAuthorization('Dual Brazilian and US citizen')).toBe('us_citizen')
    expect(detectWorkAuthorization('Citizenship: United States')).toBe('us_citizen')
    expect(detectWorkAuthorization('Green card holder')).toBe('permanent_resident')
    expect(detectWorkAuthorization('Authorized to work in the US without sponsorship')).toBe('work_authorized_no_sponsorship')
    expect(detectWorkAuthorization('Will require visa sponsorship')).toBe('need_sponsorship')
  })
  it('does not read an employer or a mention as a status', () => {
    expect(detectWorkAuthorization('Analyst, U.S. Citizenship and Immigration Services')).toBeNull()
    expect(detectWorkAuthorization('Managed H-1B sponsorship programs for 200 engineers')).toBeNull()
    expect(detectWorkAuthorization('Digital sponsorships grew 52% in 2024')).toBeNull()
  })
})

describe('detectLicenses', () => {
  it('maps certifications and plain statements to license keys', () => {
    expect(detectLicenses(['PMP', 'CPA (Illinois)', 'Six Sigma Black Belt'], '')).toEqual(['cpa', 'pmp'])
    expect(detectLicenses([], 'Licensed Professional Engineer in Texas; FINRA Series 7 and Series 66')).toEqual(['pe', 'series_7', 'series_66'])
  })
  it('does not read a CPA firm as a CPA license', () => {
    expect(detectLicenses([], 'Senior Associate at a regional CPA firm')).toEqual([])
  })
})

describe('detectHomeLocation', () => {
  it('reads city and state from the contact header', () => {
    expect(detectHomeLocation('Jane Doe\nSeattle, WA 98101 | jane@x.com\nSUMMARY ...')).toEqual({ city: 'Seattle', state: 'WA' })
    expect(detectHomeLocation('Jane Doe | Austin, Texas | 512-555-0100\nEXPERIENCE')).toEqual({ city: 'Austin', state: 'TX' })
  })
  it('ignores job locations below the header', () => {
    expect(detectHomeLocation('Jane Doe | jane@x.com\nEXPERIENCE\nAcme Corp, Denver, CO')).toBeNull()
  })
})
