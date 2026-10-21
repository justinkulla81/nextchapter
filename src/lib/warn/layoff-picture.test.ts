import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/workforce/places', () => ({ STATE_NAMES: { OH: 'Ohio', FL: 'Florida', TX: 'Texas', NY: 'New York' } }))

import { industryFromSicDescription, jobBoardIndustryFor, placeFromHeadlines, talkingPoints, type LocalPicture } from './layoff-picture'

describe('placeFromHeadlines', () => {
  it('reads "City, ST" and "City, State"', () => {
    expect(placeFromHeadlines(['Acme to cut 300 jobs in Dayton, OH'])).toEqual({ city: 'Dayton', state: 'OH' })
    expect(placeFromHeadlines(['Layoffs hit Jacksonville, Florida plant'])).toEqual({ city: 'Jacksonville', state: 'FL' })
    expect(placeFromHeadlines(['No place here', 'Warehouse in Fort Worth, Texas closing'])).toEqual({ city: 'Fort Worth', state: 'TX' })
  })
  it('ignores things that are not a place', () => {
    expect(placeFromHeadlines(['Acme lays off 300 workers'])).toBeNull()
    expect(placeFromHeadlines(['Acme, Inc. cuts staff'])).toBeNull()
    expect(placeFromHeadlines(['Said Smith, Jr. on Tuesday'])).toBeNull()
  })
})

describe('jobBoardIndustryFor', () => {
  it('maps the CRM industry labels onto the job board keys', () => {
    expect(jobBoardIndustryFor('Retail & E-commerce')).toBe('consumer')
    expect(jobBoardIndustryFor('Insurance')).toBe('financial_services')
    expect(jobBoardIndustryFor('Pharmaceuticals & Biotech')).toBe('life_sciences')
    expect(jobBoardIndustryFor('Other')).toBeNull()
    expect(jobBoardIndustryFor(null)).toBeNull()
  })
})

const picture = (o: Partial<LocalPicture> = {}): LocalPicture => ({
  employer: 'Kroger', employees: 3000, state: 'OH', county: null, industryKey: 'consumer', openInState: 14286, openInIndustry: 2100, openSeniorInState: 5534,
  topIndustries: [{ key: 'technology', openings: 2500 }, { key: 'healthcare', openings: 1900 }, { key: 'financial_services', openings: 1500 }],
  unemploymentRate: 3.3, areaLabel: 'Ohio', layoffs12mo: 8883, layoffEvents12mo: 120, ...o,
})

describe('talkingPoints', () => {
  it('gives each partner the openings, the industries hiring and what to do with them', () => {
    const rr = talkingPoints(picture(), 'rapid_response')!
    expect(rr).toContain('3,000 jobs in consumer, retail and hospitality')
    expect(rr).toContain('14,286 open white-collar roles in OH')
    expect(rr).toContain('2,100 of them in consumer')
    expect(rr).toContain('technology (2,500)')
    expect(talkingPoints(picture(), 'workforce_board')).toMatch(/Ohio unemployment is 3\.3%.*Retraining/)
    expect(talkingPoints(picture(), 'job_centers')).toContain('Walk-in help')
    expect(talkingPoints(picture(), 'economic_development')).toMatch(/Industries like it in OH: 2,100 open roles, 15% of the state's openings/)
  })
  it('says nothing without a state, and drops figures it does not have', () => {
    expect(talkingPoints(picture({ state: null }), 'rapid_response')).toBeNull()
    const bare = talkingPoints(picture({ openInState: null, openInIndustry: null, topIndustries: [], unemploymentRate: null, layoffs12mo: null, industryKey: null }), 'workforce_board')!
    expect(bare).not.toMatch(/undefined|null|NaN/)
    expect(bare).toContain('Kroger is cutting 3,000 jobs.')
  })
})

describe('industryFromSicDescription', () => {
  it('places the SEC descriptions of real layoff employers', () => {
    expect(industryFromSicDescription('Railroads, Line-Haul Operating')).toBe('Transportation & Logistics')
    expect(industryFromSicDescription('Retail-Grocery Stores')).toBe('Retail & E-commerce')
    expect(industryFromSicDescription('Services-Prepackaged Software')).toBe('Technology & Software')
    expect(industryFromSicDescription('Pharmaceutical Preparations')).toBe('Pharmaceuticals & Biotech')
    expect(industryFromSicDescription('Electric Services')).toBe('Energy & Utilities')
  })
  it('returns null rather than guess', () => {
    expect(industryFromSicDescription('Blank Checks')).toBeNull()
    expect(industryFromSicDescription(null)).toBeNull()
  })
})
