import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/prisma', () => ({ prisma: {} }))

import { computeBoardListingFitBucket, computeFitAssessment, postingFunctions } from '@/lib/jobs/job-fit-bucket'
import { correctedJobFunction, inferFunctionFromTitle } from '@/lib/jobs/infer-job-function'
import { functionLabelForTitle } from '@/lib/jobs/job-functions'
import { notOpenToUsResidents } from '@/lib/jobs/foreign-remote'
import { displayJobTitle } from '@/lib/jobs/display-title'
import { flagsFromTags, parseRequirementFlags, requirementTagsFor, checkRequirement } from '@/lib/jobs/requirements'

// The four problems real postings showed on Find a job (2026-11-17), each pinned to a real title or text.

type Candidate = Parameters<typeof computeBoardListingFitBucket>[0]
type Posting = Parameters<typeof computeBoardListingFitBucket>[1]

const financeDirector = (over: Partial<Candidate> = {}): Candidate => ({
  primaryFunction: 'Finance', secondaryFunction: null, highestLevelReached: 'Director', levelRankScore: null, remotePreference: 'hybrid',
  currentCity: 'Columbus', currentState: 'OH', openToRelocation: false, targetCompMin: null, compFlexible: false, targetRoleType: null,
  resumeKeywords: ['budgeting', 'forecasting', 'gaap', 'excel'], yearsExperience: 15, industryContext: 'Healthcare', secondaryIndustryContext: null,
  targetIndustries: [], hasJD: false, hasMD: false, hasDO: false, targetCompanySize: null, priorityMaxComp: null, priorityWorkLife: null,
  priorityBrandName: null, priorityMission: null, ...over,
})
const job = (over: Partial<Posting> = {}): Posting => ({
  title: 'Director of Finance', description: null, targetFunction: 'Finance', targetLevel: null, targetRemotePolicy: null, targetLocation: null,
  location: 'Columbus, OH', salaryMin: null, salaryMax: null, level: 'DIRECTOR', ...over,
})

describe('1. a Finance label that only names the industry', () => {
  it('reads "Director of Sales, Financial Services" as Sales', () => {
    expect(correctedJobFunction('Finance', 'Senior Director of Sales, Financial Services')).toBe('Sales')
    expect(postingFunctions({ title: 'Senior Director of Sales, Financial Services', targetFunction: 'Finance' })).toEqual(['Sales'])
    expect(inferFunctionFromTitle('Director of Sales')).toBe('Sales')
  })
  it('keeps real finance work and a finance department called Financial Services', () => {
    for (const t of ['Director of Financial Services', 'Director, Financial Services Accounting', 'Director Investor Relations', 'Director IT Finance']) {
      expect(correctedJobFunction('Finance', t)).toBe('Finance')
    }
  })
  it('stores the corrected label at import', () => {
    expect(functionLabelForTitle('finance', 'Senior Director of Sales, Financial Services')).toBe('Sales')
    expect(functionLabelForTitle('finance', 'Director of Finance')).toBe('Finance')
  })
  it('no longer scores the sales job as a fit in the finance member’s own function', () => {
    const a = computeFitAssessment(financeDirector(), job({ title: 'Senior Director of Sales, Financial Services', location: 'Remote', targetRemotePolicy: 'remote' }))
    expect(a.functionFit).not.toBe('own')
  })
})

describe('2. jobs for people outside the US', () => {
  const HIRE_LATAM = 'Location: Remote from Latin America Position Type: Full-time Salary: $3,500 - $4,500 USD monthly salary'
  it('reads explicit phrasing only', () => {
    expect(notOpenToUsResidents(HIRE_LATAM)).toBe(true)
    expect(notOpenToUsResidents('Candidates must be located in Mexico')).toBe(true)
    expect(notOpenToUsResidents('We have offices in Europe and the US. Remote in the US.')).toBe(false)
    expect(notOpenToUsResidents('Remote - United States')).toBe(false)
  })
  it('is never a good fit for a member in the US, from the text or from the import tag', () => {
    const base = { title: 'Remote Director of Finance & Controller (U.S. Multifamily Real Estate)', location: 'New York, NY', targetRemotePolicy: 'remote' }
    expect(computeFitAssessment(financeDirector(), job({ ...base, description: HIRE_LATAM })).place).toBe('no')
    expect(computeFitAssessment(financeDirector(), job({ ...base, requirementTags: 'outside_us' } as Partial<Posting>)).place).toBe('no')
    expect(['strong', 'good']).not.toContain(computeBoardListingFitBucket(financeDirector(), job({ ...base, description: HIRE_LATAM })))
  })
  it('round-trips as a requirement and blocks every member', () => {
    const flags = parseRequirementFlags([{ flag: 'outside_us' }])
    expect(requirementTagsFor(flags)).toBe('outside_us')
    expect(flagsFromTags('onsite,outside_us').map((f) => f.flag)).toContain('outside_us')
    const member = { clearanceLevel: null, clearanceActive: null, clearancePolygraph: null, licensesHeld: [], licensesAnsweredAt: null, workAuthorization: 'us_citizen', maxTravelPct: null, openToRelocation: true, relocationAsked: true, remotePreference: 'remote', currentState: 'OH' }
    expect(checkRequirement({ flag: 'outside_us' }, member).status).toBe('blocker')
  })
})

describe('3. titles without requisition numbers and location tails', () => {
  it('cleans what job systems add', () => {
    expect(displayJobTitle('Director Growth & Distribution - Optum Financial Provider Products 2385787 | Eden Prairie, Minnesota | Remote')).toBe('Director Growth & Distribution - Optum Financial Provider Products')
    expect(displayJobTitle('VP, Finance | Req #123456')).toBe('VP, Finance')
    expect(displayJobTitle('Controller (JR-104233)')).toBe('Controller')
    expect(displayJobTitle('Senior Financial Analyst - Remote')).toBe('Senior Financial Analyst')
  })
  it('leaves real titles alone', () => {
    for (const t of ['Software Engineer II', 'Director of Operations, 2nd Shift', 'Head of Sales | EMEA', 'Director, FP&A | Corporate Finance']) {
      expect(displayJobTitle(t)).toBe(t)
    }
  })
})

describe('4. Strong needs a reason specific to the member', () => {
  const generic = 'Lead the finance team. Partner with leadership on planning and reporting.'
  it('function, level and place alone make a Good fit, not Strong', () => {
    expect(computeBoardListingFitBucket(financeDirector(), job({ title: 'Director Investor Relations', description: generic }))).toBe('good')
  })
  it('two of their skills, their industry or the role they named make it Strong', () => {
    expect(computeBoardListingFitBucket(financeDirector(), job({ description: `${generic} Owns budgeting and forecasting.` }))).toBe('strong')
    expect(computeBoardListingFitBucket(financeDirector(), job({ description: `${generic} A regional healthcare system.` }))).toBe('strong')
    expect(computeBoardListingFitBucket(financeDirector({ targetRoleType: 'Director of Finance' }), job({ description: generic }))).toBe('strong')
  })
  it('ranking from rows without a description is unchanged', () => {
    expect(computeBoardListingFitBucket(financeDirector(), job({ title: 'Director Investor Relations', description: null }))).toBe('strong')
  })
})

describe('2b. what is not a job for people outside the US', () => {
  it('a region named with the US, and monthly stipends', () => {
    expect(notOpenToUsResidents('We welcome US and Canada-based candidates')).toBe(false)
    expect(notOpenToUsResidents('This role is remote in Europe or the US')).toBe(false)
    expect(notOpenToUsResidents('Benefits: $75 USD/month home office stipend')).toBe(false)
    expect(notOpenToUsResidents('Car allowance of $1,100 USD monthly')).toBe(false)
    expect(notOpenToUsResidents('Pay: $5,250-7,500 USD/month (contract)')).toBe(true)
    expect(notOpenToUsResidents('Remote (Philippines)')).toBe(true)
    expect(notOpenToUsResidents('LATAM-based professionals only')).toBe(true)
  })
})
