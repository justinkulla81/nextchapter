import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/prisma', () => ({ prisma: {} }))

import parity from './fixtures/level-calibration-parity.json'
import { calibrateLevel, classifyTitleRung, levelForPosting, normalizeCompanyForLevel } from '@/lib/jobs/job-seniority'
import { flexRungRange, isMegaCapEmployer, jobLevelFlex, NO_FLEX } from '@/lib/jobs/level-flex'
import { levelStep } from '@/lib/jobs/job-fit-bucket'
import { screenImportedJob } from '@/lib/jobs/import-screen'
import { calibratedLevelDistanceToRange } from '@/lib/scoring/level-rank'
import {
  careerHighPointLine,
  deriveCareerHighPoint,
  memberPeakWindow,
  peakForMatching,
  readCareerHighPointStore,
  type CareerHighPoint,
} from '@/lib/profile/career-high-point'
import { readSearchExpansion } from '@/lib/profile/search-expansion'

const lvl = (title: string, company?: string, description: string | null = null) => levelForPosting(title, description, { companyName: company }).rung

describe('employer-aware level calibration — parity with ncrawl', () => {
  it('reproduces the Python verdict on every calibration parity case', () => {
    const mismatches = (parity as [string, string | null, string, string][])
      .map(([title, text, company, expected]) => ({ title, company, expected, got: lvl(title, company, text) }))
      .filter((m) => m.got !== m.expected)
    expect(mismatches).toEqual([])
  })

  // The import screen (every automated source, nightly) must store the same level as the
  // crawler: before 2026-10-24 it skipped the years step on MANAGER titles, so an IC-style
  // "Treasury Relationship Manager" asking 3-5 years stayed MANAGER / SENIOR_IC on the board.
  it('the import screen stores the Python verdict on every calibration parity case', () => {
    const mismatches = (parity as [string, string | null, string, string][])
      .map(([title, text, company, expected]) => ({ title, text, expected, v: screenImportedJob(title, 'Remote', { description: text, companyName: company }) }))
      .filter((m) => m.v.keep && m.v.level !== m.expected)
      .map(({ title, text, expected, v }) => ({ title, text, expected, got: v.keep ? v.level : null }))
    expect(mismatches).toEqual([])
  })

  it('import screen: IC-style managers asking 5 years or fewer are mid-level; people managers stay MANAGER', () => {
    const imp = (title: string, description: string, companyName?: string) => {
      const v = screenImportedJob(title, 'Charlotte, NC', { description, companyName })
      return v.keep ? v.level : v.reason
    }
    // The years step now runs on MANAGER titles (R2-R4 allowlists, minimum 5 years or fewer).
    expect(imp('Treasury Relationship Manager', 'Requires 3-5 years of experience in treasury management sales.', 'Regions Bank')).toBe('MID_IC')
    expect(imp('Relationship Manager', '3+ years of commercial lending experience.', 'PNC')).toBe('MID_IC')
    expect(imp('Grants Manager', 'Minimum 3 years of grants administration experience.')).toBe('MID_IC')
    expect(imp('Clinical Trial Manager', "Bachelor's degree and 4 years of clinical research experience.")).toBe('MID_IC')
    expect(imp('Senior Relationship Manager', '5+ years of wealth management experience.', 'Fifth Third Bank')).toBe('MID_IC')
    // Near misses: a real people manager asking 5 years or fewer keeps MANAGER (PEOPLE_MANAGER_DESC veto).
    expect(imp('Senior Relationship Manager', '5+ years of experience; supervise 4 relationship associates (direct reports).', 'Fifth Third Bank')).toBe('MANAGER')
    expect(imp('Clinical Trial Manager', "Bachelor's degree and 5 years of clinical research experience. Supervise 3 direct reports (CRAs).")).toBe('MANAGER')
    expect(imp('Relationship Manager', '3+ years of experience. You will manage a team of 5 analysts and lead hiring.', 'PNC')).toBe('MANAGER')
    expect(imp('Treasury Relationship Manager', '4+ years of treasury sales experience. You will lead a team of 4 treasury officers as their people manager.', 'Regions Bank')).toBe('MANAGER')
    expect(imp('Clinical Trial Manager', "Bachelor's degree and 3 years of experience. Oversee a team of CRAs.")).toBe('MANAGER')
    // More than 5 years, or a title the allowlist vetoes ("Manager, ..."), skips the years step.
    expect(imp('Treasury Relationship Manager', 'Requires 8+ years of experience in treasury management sales.', 'Regions Bank')).toBe('SENIOR_IC')
    expect(imp('Relationship Manager, Business Banking', '3+ years of business banking experience.', 'Truist')).toBe('SENIOR_IC')
    // No description: nothing to read, the title's own rung stands.
    expect(imp('Treasury Relationship Manager', '', 'Regions Bank')).toBe(lvl('Treasury Relationship Manager', 'Regions Bank'))
  })

  it('normalizes employer names the way ncrawl does', () => {
    expect(normalizeCompanyForLevel('The Bank of New York Mellon')).toBe('bank of new york mellon')
    expect(normalizeCompanyForLevel('JPMorgan Chase & Co.')).toBe('jpmorgan chase and')
    expect(normalizeCompanyForLevel('Goldman Sachs Group, Inc.')).toBe('goldman sachs')
  })
})

describe('industry ladders', () => {
  it('bank grades: AVP mid, VP senior IC, Director / ED / SVP senior manager, MD director', () => {
    expect(lvl('Vice President, Credit Risk', 'Morgan Stanley')).toBe('SENIOR_IC')
    expect(lvl('Assistant Vice President, Operations', 'Citi')).toBe('MID_IC')
    expect(lvl('Executive Director, Technology', 'J.P. Morgan')).toBe('SR_MANAGER')
    expect(lvl('Senior Vice President, Risk', 'Citigroup')).toBe('SR_MANAGER')
    expect(lvl('Managing Director, Leveraged Finance', 'Goldman Sachs')).toBe('DIRECTOR')
  })

  it('near miss: "Vice President" at a bank vs at Google, and a VP title naming the job', () => {
    expect(lvl('Vice President', 'Deutsche Bank')).toBe('SENIOR_IC')
    expect(lvl('Vice President', 'Google')).toBe('VP')
    expect(lvl('Vice President of Finance', 'YMCA of the USA')).toBe('VP')
    expect(lvl('Chief Risk Officer', 'Morgan Stanley')).toBe('C_SUITE')
    expect(lvl('Head of Equity Research', 'Goldman Sachs')).toBe('HEAD')
  })

  it('near miss: "Associate" at a bank vs "Associate Professor"', () => {
    expect(lvl('Associate Professor of Finance', 'University of Chicago')).toBe(lvl('Associate Professor of Finance'))
    expect(lvl('Associate', 'Morgan Stanley')).toBe(lvl('Associate'))
  })

  it('consulting and Big 4: Senior Consultant mid-level, Principal a partner at an accounting firm', () => {
    expect(lvl('Senior Consultant, Risk Advisory', 'Deloitte')).toBe('MID_IC')
    expect(lvl('Senior Consultant', 'Acme Software')).toBe('SENIOR_IC')
    expect(lvl('Principal', 'Deloitte')).toBe('PARTNER')
    expect(lvl('Principal', 'Bain & Company')).toBe('PRINCIPAL')
    expect(lvl('Audit Senior', 'EY')).toBe('MID_IC')
  })

  it('near miss: "Director" at Deloitte vs at a nonprofit (neither ladder moves it)', () => {
    expect(lvl('Director', 'Deloitte')).toBe('DIRECTOR')
    expect(lvl('Director of Programs', 'Local Food Bank')).toBe('DIRECTOR')
  })
})

describe('IC-style managers, mid-level "Senior" titles, quota sales directors', () => {
  it('IC-style managers are senior IC unless the posting talks about a team', () => {
    expect(lvl('Sourcing Manager - HR Categories', 'RTX')).toBe('SENIOR_IC')
    expect(lvl('Strategic Autonomy Capture Manager, PACOM', 'Shield AI')).toBe('SENIOR_IC')
    expect(lvl('Regional Channel Manager - East', 'Glia', 'You will lead a team of four channel reps.')).toBe('MANAGER')
    expect(lvl('Engineering Manager', 'Acme')).toBe('MANAGER')
    expect(lvl('PMO Manager', 'Acme')).toBe('MANAGER')
  })

  it('mid-level "Senior" titles are MID_IC unless 7+ years are asked', () => {
    expect(lvl('Senior Accountant', 'Century Group')).toBe('MID_IC')
    expect(lvl('Senior Accountant', 'Century Group', 'Requires 8+ years of accounting experience.')).toBe('SENIOR_IC')
    expect(lvl('Staff Financial Analyst')).toBe('MID_IC')
    expect(lvl('Mechanical Engineer III')).toBe('MID_IC')
    expect(lvl('Staff Software Engineer', 'Stripe')).toBe('SENIOR_IC')
    expect(lvl('Senior Associate Attorney', 'Smith & Jones LLP')).toBe('SENIOR_IC')
  })

  it('quota sales directors are senior IC unless the posting shows a team', () => {
    expect(lvl('Director of Strategic Accounts - Education', 'Tanium')).toBe('SENIOR_IC')
    expect(lvl('Business Development Director', 'Davita')).toBe('SENIOR_IC')
    expect(lvl('Account Director', 'Acme', 'Build and lead a team of account managers.')).toBe('DIRECTOR')
    expect(lvl('Director of Sales', 'Acme')).toBe('DIRECTOR')
    expect(lvl('Director of Development', 'Local Food Bank')).toBe('DIRECTOR')
  })

  it('the import screen stores the calibrated level', () => {
    const v = screenImportedJob('Vice President, Credit Risk', 'New York, NY', { companyName: 'Morgan Stanley' })
    expect(v.keep && v.level).toBe('SENIOR_IC')
    const g = screenImportedJob('Vice President, Engineering', 'Mountain View, CA', { companyName: 'Google' })
    expect(g.keep && g.level).toBe('VP')
  })

  it('calibrateLevel names the rule it applied', () => {
    expect(calibrateLevel('Vice President', classifyTitleRung('Vice President'), null, 'BNY').rule).toBe('bank_ladder')
    expect(calibrateLevel('Vice President', classifyTitleRung('Vice President'), null, 'Microsoft').rule).toBeNull()
  })
})

describe('level flex', () => {
  it('size never moves a stored level: a CEO at a 20-person startup and at a Fortune 500 are both C_SUITE', () => {
    expect(lvl('Chief Executive Officer', 'Tiny Startup Inc')).toBe('C_SUITE')
    expect(lvl('Chief Executive Officer', 'Walmart')).toBe('C_SUITE')
  })

  it('down flex by employer scale: tiny non-startup 2, small non-startup 1, small startup 1, unknown and mega 0', () => {
    const ceo = { title: 'Chief Executive Officer', level: 'C_SUITE' }
    expect(jobLevelFlex({ ...ceo, companySizeBand: 'SMALL' }).down).toBe(2)
    expect(jobLevelFlex({ ...ceo, companySizeBand: 'SMALL_MID' }).down).toBe(1)
    expect(jobLevelFlex({ ...ceo, companySizeBand: 'SMALL', sourceCategory: 'vc_portfolio' }).down).toBe(1)
    expect(jobLevelFlex({ ...ceo, sourceCategory: 'venture' }).down).toBe(0)
    expect(jobLevelFlex({ ...ceo, companySizeBand: null }).down).toBe(0)
    expect(jobLevelFlex({ ...ceo, companyName: 'Walmart', companySizeBand: 'MEGA' }).down).toBe(0)
    expect(jobLevelFlex({ ...ceo, companySizeBand: 'MID' }).down).toBe(0)
  })

  it('mega-caps: VP and above is never down-ranked', () => {
    expect(isMegaCapEmployer('Google')).toBe(true)
    expect(isMegaCapEmployer('Alphabet Inc.')).toBe(true)
    expect(isMegaCapEmployer('Acme Software')).toBe(false)
    // Even a wrong small band never flexes a mega-cap down.
    expect(jobLevelFlex({ title: 'Vice President', level: 'VP', companyName: 'Google', companySizeBand: 'SMALL' }).down).toBe(0)
  })

  it('up flex for the deliberately lower readings', () => {
    expect(jobLevelFlex({ title: 'Sourcing Manager - HR Categories', level: 'SENIOR_IC' }).up).toBe(1)
    expect(jobLevelFlex({ title: 'Senior Accountant', level: 'MID_IC' }).up).toBe(1)
    expect(jobLevelFlex({ title: 'Business Development Director', level: 'SENIOR_IC' }).up).toBe(2)
    expect(jobLevelFlex({ title: 'Engineering Manager', level: 'MANAGER' }).up).toBe(0)
    expect(flexRungRange('SENIOR_IC', { up: 2, down: 0, scale: null })).toEqual({ low: 'SENIOR_IC', high: 'SR_MANAGER' })
    expect(flexRungRange('VP', { up: 0, down: 2, scale: 'tiny' })).toEqual({ low: 'SR_MANAGER', high: 'VP' })
    expect(flexRungRange('VP', NO_FLEX)).toEqual({ low: 'VP', high: 'VP' })
  })

  it('distance to a flexed range is 0 inside it', () => {
    expect(calibratedLevelDistanceToRange(55, 47, 70)).toBe(0)
    expect(calibratedLevelDistanceToRange(40, 55, 70)).toBe(1)
    expect(calibratedLevelDistanceToRange(null, 40, 40)).toBe(2)
  })
})

const member = (over: Record<string, unknown> = {}) => ({ highestLevelReached: 'Director', levelRankScore: null, yearsExperience: 18, ...over })
const peakJson = (p: Partial<CareerHighPoint>) => ({ careerHighPoint: { derived: { level: 'VP', sizeBand: null, startup: false, source: 'derived', at: '', ...p } } })

describe('fit: small-employer flex', () => {
  it('a 30-person (non-startup) firm\'s VP role fits Director and Senior Manager candidates', () => {
    const vp = { title: 'Vice President, Operations', targetLevel: null, level: 'VP', companySizeBand: 'SMALL' as const }
    expect(levelStep(member(), vp)).toBe('same')
    expect(levelStep(member({ highestLevelReached: 'Manager' }), vp)).toBe('same')
    expect(levelStep(member(), { ...vp, companySizeBand: null })).toBe('up')
  })

  it('a small startup\'s VP flexes one level only', () => {
    const vp = { title: 'Vice President, Operations', targetLevel: null, level: 'VP', companySizeBand: 'SMALL' as const, sourceCategory: 'vc_portfolio' }
    expect(levelStep(member(), vp)).toBe('same')
    expect(levelStep(member({ highestLevelReached: 'Manager' }), vp)).toBe('up')
  })

  it('non-startup small business titles flex down; a mega-cap VP does not', () => {
    const director = { title: 'Director of Operations', targetLevel: null, level: 'DIRECTOR', companySizeBand: 'MICRO' as const }
    expect(levelStep(member({ highestLevelReached: 'Manager' }), director)).toBe('same')
    expect(levelStep(member(), { title: 'Vice President', targetLevel: null, level: 'VP', companyName: 'Google', companySizeBand: 'MEGA' as const })).toBe('up')
  })

  it('a mid-level "Senior" title still fits a Manager-level member (up flex)', () => {
    expect(levelStep(member({ highestLevelReached: 'Manager' }), { title: 'Senior Accountant', targetLevel: null, level: 'MID_IC' })).toBe('same')
    expect(levelStep(member({ highestLevelReached: 'Manager' }), { title: 'Accountant', targetLevel: null, level: 'MID_IC' })).toBe('down')
  })
})

describe('fit: career high point', () => {
  it('Whitman / Schmidt: a big-company VP fits a startup CEO role', () => {
    const vpAtScale = member({ highestLevelReached: 'VP', searchExpansion: peakJson({ sizeBand: 'LARGE' }) })
    const startupCeo = { title: 'Chief Executive Officer', targetLevel: null, level: 'C_SUITE', sourceCategory: 'venture' }
    expect(levelStep(vpAtScale, startupCeo)).toBe('same')
    expect(levelStep(member({ highestLevelReached: 'VP' }), startupCeo)).toBe('up')
    // A 100-person startup's CEO (known size) fits the big-company VP through the job's own flex too.
    expect(levelStep(member({ highestLevelReached: 'VP' }), { ...startupCeo, companySizeBand: 'SMALL_MID' as const })).toBe('same')
  })

  it('a big-company VP also fits Director roles at big companies', () => {
    const vpAtScale = member({ highestLevelReached: 'VP', searchExpansion: peakJson({ sizeBand: 'ENTERPRISE' }) })
    const bigDirector = { title: 'Director of Operations', targetLevel: null, level: 'DIRECTOR', companySizeBand: 'LARGE' as const }
    expect(levelStep(vpAtScale, bigDirector)).toBe('same')
    expect(levelStep(member({ highestLevelReached: 'VP' }), bigDirector)).toBe('down')
  })

  it('a tiny-firm VP matches a Director role at scale, and startup VP roles, but VP at scale is a step up', () => {
    const tinyVp = member({ highestLevelReached: 'VP', searchExpansion: peakJson({ sizeBand: 'SMALL' }) })
    expect(levelStep(tinyVp, { title: 'Director of Operations', targetLevel: null, level: 'DIRECTOR', companySizeBand: 'LARGE' as const })).toBe('same')
    expect(levelStep(tinyVp, { title: 'Vice President, Operations', targetLevel: null, level: 'VP', companySizeBand: 'LARGE' as const })).toBe('up')
    expect(levelStep(tinyVp, { title: 'Vice President, Operations', targetLevel: null, level: 'VP', sourceCategory: 'venture' })).toBe('same')
  })

  it('a startup peak is not discounted for its headcount', () => {
    const startupVp = member({ highestLevelReached: 'VP', searchExpansion: peakJson({ sizeBand: 'SMALL', startup: true }) })
    expect(levelStep(startupVp, { title: 'Vice President, Operations', targetLevel: null, level: 'VP', companySizeBand: 'LARGE' as const })).toBe('same')
  })

  it('a derived point counts only at the stated level; the member\'s correction always counts', () => {
    const store = readCareerHighPointStore(peakJson({ sizeBand: 'LARGE' }).careerHighPoint)
    expect(peakForMatching(store, 'VP')?.sizeBand).toBe('LARGE')
    expect(peakForMatching(store, 'Director')).toBeNull()
    const corrected = readCareerHighPointStore({ ...peakJson({}).careerHighPoint, member: { level: 'C-Suite', sizeBand: 'SMALL', startup: true, source: 'member', at: '' } })
    expect(peakForMatching(corrected, 'VP')?.level).toBe('C-Suite')
  })

  it('reads, labels and derives the point', () => {
    expect(careerHighPointLine({ level: 'VP', sizeBand: 'LARGE', startup: false, source: 'derived', at: '' })).toBe('VP at a 5,000-20,000 person company')
    expect(careerHighPointLine({ level: 'VP', sizeBand: 'SMALL', startup: true, source: 'member', at: '' })).toBe('VP at a startup (11-50 people)')
    expect(careerHighPointLine({ level: 'Director', sizeBand: null, startup: false, source: 'derived', at: '' })).toBe('Director')
    const d = deriveCareerHighPoint([
      { level: 'Director', companyName: 'Acme', title: 'Director', startDate: new Date('2015-01-01'), sizeBand: 'MID', startup: false },
      { level: 'VP', companyName: 'Tiny', title: 'VP Sales', startDate: new Date('2019-01-01'), sizeBand: 'SMALL', startup: false },
      { level: 'VP', companyName: 'BigCo', title: 'VP Ops', startDate: new Date('2012-01-01'), sizeBand: 'LARGE', startup: false },
    ])
    expect(d?.companyName).toBe('BigCo')
    expect(memberPeakWindow({ lo: 55, hi: 70 }, 70, 'tiny', 'large', 15)).toEqual({ lo: 48, hi: 55 })
    expect(memberPeakWindow({ lo: 55, hi: 70 }, 70, 'small', 'mid', 15)).toEqual({ lo: 55, hi: 70 })
    expect(memberPeakWindow({ lo: 70, hi: 85 }, 70, 'large', 'startup', 15)).toEqual({ lo: 70, hi: 85 })
  })

  it('searchExpansion keeps the career high point through a read', () => {
    const exp = readSearchExpansion({ remote: true, ...peakJson({ sizeBand: 'MEGA' }) })
    expect(exp.careerHighPoint?.derived?.sizeBand).toBe('MEGA')
    expect(readSearchExpansion({ remote: true }).careerHighPoint).toBeUndefined()
  })
})
