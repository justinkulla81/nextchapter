import { describe, expect, it } from 'vitest'
import { classifyFunctions, classifyIndustries, deriveCoverage, industryKeyForNaics, recruiterFit, stateFromLocation } from './coverage'

describe('stateFromLocation', () => {
  it('reads names and abbreviations', () => {
    expect(stateFromLocation('Austin, Texas, United States')).toBe('TX')
    expect(stateFromLocation('Chicago, IL')).toBe('IL')
    expect(stateFromLocation('Greater London')).toBeNull()
  })
})
describe('classify', () => {
  it('tags functions and industries from titles', () => {
    expect(classifyFunctions('Senior Technical Recruiter, software engineering')).toContain('engineering')
    expect(classifyIndustries('Healthcare executive search')).toContain('healthcare')
  })
  it('maps NAICS sectors to job-board keys', () => {
    expect(industryKeyForNaics('Health Care and Social Assistance')).toBe('healthcare')
    expect(industryKeyForNaics('Information')).toBe('technology')
    expect(industryKeyForNaics(null)).toBeNull()
  })
})
describe('deriveCoverage', () => {
  const base = { title: null, location: null, orgName: null, orgIndustry: null, orgState: null, isSearchFirm: false, firmTitles: [] }
  it('tags a search firm with no known state national, an in-house recruiter nothing', () => {
    expect(deriveCoverage({ ...base, orgName: 'Acme Executive Search', isSearchFirm: true }).states).toEqual(['NATIONAL'])
    expect(deriveCoverage({ ...base, orgName: 'CVS Health' }).states).toEqual([])
  })
  it('prefers the person’s own location', () => {
    expect(deriveCoverage({ ...base, location: 'Denver, Colorado', isSearchFirm: true }).states).toEqual(['CO'])
  })
})
describe('recruiterFit', () => {
  const local = { states: ['TX'], industries: ['technology'], functions: [] }
  const national = { states: ['NATIONAL'], industries: ['technology'], functions: [] }
  it('ranks local and industry matches first, drops other states', () => {
    expect(recruiterFit(local, { state: 'TX', industry: 'technology' })).toBeGreaterThan(recruiterFit(national, { state: 'TX', industry: 'technology' }))
    expect(recruiterFit(local, { state: 'CA', industry: 'technology' })).toBe(0)
    expect(recruiterFit(local, { state: 'TX', industry: 'technology' })).toBeGreaterThan(recruiterFit(local, { state: 'TX', industry: 'healthcare' }))
  })
})
