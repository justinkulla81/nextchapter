import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'

vi.mock('@/lib/prisma', () => ({ prisma: {} }))
vi.mock('@/lib/jobs/ghost-risk-data', () => ({ getClosedPostingCounts: async () => new Map() }))

import {
  computeBoardListingFitBucket,
  computeFitAssessment,
  isVeryStrongBoardFit,
  levelStep,
  STRONG_FIT_THRESHOLD,
} from '@/lib/jobs/job-fit-bucket'
import { legacyComputeBoardListingFitBucket, legacyIsVeryStrongBoardFit } from '@/lib/jobs/job-fit-bucket-legacy'
import { boardListingFitBucketFor, emailFitScoringVersion, isVeryStrongBoardFitFor } from '@/lib/jobs/email-fit-scoring'
import { rankBoardRows, type BoardRankRow } from '@/lib/jobs/board-shortlist'
import { FIT_BUCKET_SORT_RANK } from '@/lib/jobs/fit-bucket-types'
import { candidateScaleLevel } from '@/lib/jobs/job-seniority'
import {
  normalizeCandidateProfileFields,
  normalizeFunctionValue,
  normalizeLevelValue,
  normalizeRemotePreferenceValue,
  normalizeTargetRoleTypeValue,
} from '@/lib/constants/candidate-profile-normalize'
import { matchJobToCandidate, type MatchCandidate, type MatchJob } from '@/lib/jobs/job-match'

type Candidate = Parameters<typeof computeBoardListingFitBucket>[0]
type Posting = Parameters<typeof computeBoardListingFitBucket>[1]

const member = (over: Partial<Candidate> = {}): Candidate => ({
  primaryFunction: 'Operations',
  secondaryFunction: null,
  highestLevelReached: 'VP',
  levelRankScore: null,
  remotePreference: 'hybrid',
  currentCity: 'Boston',
  currentState: 'MA',
  openToRelocation: false,
  targetCompMin: null,
  compFlexible: false,
  targetRoleType: null,
  resumeKeywords: [],
  yearsExperience: 20,
  industryContext: null,
  secondaryIndustryContext: null,
  targetIndustries: [],
  hasJD: false,
  hasMD: false,
  hasDO: false,
  targetCompanySize: null,
  priorityMaxComp: null,
  priorityWorkLife: null,
  priorityBrandName: null,
  priorityMission: null,
  ...over,
})

const job = (over: Partial<Posting> = {}): Posting => ({
  title: 'Vice President, Operations',
  description: null,
  targetFunction: null,
  targetLevel: null,
  targetRemotePolicy: null,
  targetLocation: null,
  location: 'Boston, MA',
  salaryMin: null,
  salaryMax: null,
  level: 'VP',
  ...over,
})

describe('fit scoring v2 — senior members reach strong', () => {
  it('a VP of Operations sees a local VP Operations role as strong', () => {
    expect(computeBoardListingFitBucket(member(), job())).toBe('strong')
  })

  it('a VP with a resume full of keywords is no longer capped below strong by a low keyword hit rate', () => {
    const c = member({ resumeKeywords: ['P&L ownership', 'board relations', 'M&A integration', 'six sigma', 'OKRs', 'EBITDA'] })
    expect(computeFitAssessment(c, job()).score).toBeGreaterThanOrEqual(STRONG_FIT_THRESHOLD)
  })

  it('a Director whose history calibrates high (levelRankScore 87) still sees Director roles at their level', () => {
    const c = member({ primaryFunction: 'Finance', highestLevelReached: 'Director', levelRankScore: 87, targetRoleType: 'VP, FP&A' })
    expect(levelStep(c, job({ title: 'Senior Director, FP&A', level: 'DIRECTOR' }))).toBe('same')
    expect(levelStep(c, job({ title: 'Vice President, FP&A', level: 'VP' }))).toBe('same') // widened one step up
    expect(computeBoardListingFitBucket(c, job({ title: 'Vice President, FP&A', level: 'VP' }))).toBe('strong')
  })

  it('a Finance C-suite member targeting CFO matches a Chief Financial Officer posting and can get an alert', () => {
    const c = member({ primaryFunction: 'Finance', highestLevelReached: 'C-Suite', targetRoleType: 'CFO' })
    const p = job({ title: 'Chief Financial Officer', level: 'C_SUITE', location: 'Cambridge, MA' })
    expect(computeBoardListingFitBucket(c, p)).toBe('strong')
    expect(isVeryStrongBoardFit(c, p, candidateScaleLevel('C_SUITE'))).toBe(true)
  })

  it('a step down is labelled Step Down, never On Target or Lateral', () => {
    expect(computeBoardListingFitBucket(member(), job({ title: 'Director of Operations', level: 'DIRECTOR' }))).toBe('below_level')
    expect(computeBoardListingFitBucket(member(), job({ title: 'Operations Manager', level: 'MANAGER' }))).toBe('overqualified')
  })

  it('a job in another state the member is not open to moving to is not a recommendation', () => {
    expect(computeBoardListingFitBucket(member(), job({ location: 'Dallas, TX' }))).not.toMatch(/strong|good/)
    expect(computeBoardListingFitBucket(member(), job({ location: 'Remote (United States)' }))).toBe('strong')
    // Hoboken to New York is a commute, not a move.
    expect(computeFitAssessment(member({ currentCity: 'Hoboken', currentState: 'NJ' }), job({ location: 'New York, NY' })).place).toBe('local')
  })
})

describe('fit scoring v2 — level alignment', () => {
  it('Senior IC and Manager are lateral, not "below"', () => {
    const manager = member({ highestLevelReached: 'Manager' })
    expect(levelStep(manager, job({ title: 'Senior Operations Analyst', level: 'SENIOR_IC' }))).toBe('same')
    expect(levelStep(member({ highestLevelReached: 'IC' }), job({ title: 'Operations Manager', level: 'MANAGER' }))).toBe('up')
    const bucket = computeBoardListingFitBucket(manager, job({ title: 'Senior Operations Analyst', level: 'SENIOR_IC' }))
    expect(bucket).not.toBe('below_level')
    expect(bucket).not.toBe('overqualified')
  })

  it('a store or restaurant General Manager is not an executive fit', () => {
    const exec = member({ primaryFunction: 'Executive Leadership', highestLevelReached: 'C-Suite' })
    for (const title of ['General Manager', 'Restaurant General Manager', 'General Manager - Store #1123']) {
      expect(levelStep(exec, job({ title, level: 'C_SUITE' }))).toBe('big_down')
      expect(computeBoardListingFitBucket(exec, job({ title, level: 'C_SUITE' }))).toBe('overqualified')
    }
    expect(levelStep(member({ highestLevelReached: 'VP' }), job({ title: 'General Manager, Payments Business Unit', level: 'C_SUITE' }))).toBe('same')
  })
})

describe('fit scoring v2 — the targetRoleType cap', () => {
  const productDirector = member({ primaryFunction: 'Product', highestLevelReached: 'Director', targetRoleType: 'Director of Product', remotePreference: 'remote', currentCity: null, currentState: null })

  it('a one-word target ("Director of Product") earns title credit for a matching title', () => {
    const p = job({ title: 'Director, Product Management', level: 'DIRECTOR', location: 'Remote' })
    expect(computeFitAssessment(productDirector, p).titleBonus).toBeGreaterThan(0)
    expect(computeBoardListingFitBucket(productDirector, p)).toBe('strong')
  })

  it("…but not for a different function's title that shares the word", () => {
    const p = job({ title: 'Director, Product Marketing', level: 'DIRECTOR', location: 'Remote' })
    expect(computeFitAssessment(productDirector, p).titleBonus).toBe(0)
  })

  it('a title with nothing in common with a named target is lateral (good), not capped below good', () => {
    const c = member({ targetRoleType: 'VP Supply Chain' })
    const a = computeFitAssessment(c, job({ title: 'Vice President, Business Operations' }))
    expect(a.cappedBy).toBe('target_role')
    expect(a.score).toBe(STRONG_FIT_THRESHOLD - 1)
    expect(computeBoardListingFitBucket(c, job({ title: 'Vice President, Business Operations' }))).toBe('good')
  })

  it('"VP Marketing" does not match every Vice President title through the word "president"', () => {
    const c = member({ primaryFunction: 'Marketing', targetRoleType: 'VP Marketing' })
    expect(computeFitAssessment(c, job({ title: 'Vice President of Sales' })).titleBonus).toBe(0)
  })
})

describe('all-caps profile values', () => {
  it('normalises codes to the canonical option values', () => {
    expect(normalizeFunctionValue('PRODUCT_MANAGEMENT')).toBe('Product')
    expect(normalizeFunctionValue('DATA_AND_ANALYTICS')).toBe('Data & Analytics')
    expect(normalizeFunctionValue('Finance')).toBe('Finance')
    expect(normalizeLevelValue('DIRECTOR')).toBe('Director')
    expect(normalizeLevelValue('C_SUITE')).toBe('C-Suite')
    expect(normalizeLevelValue('INDIVIDUAL_CONTRIBUTOR')).toBe('IC')
    expect(normalizeRemotePreferenceValue('REMOTE')).toBe('remote')
    expect(normalizeRemotePreferenceValue('ON_SITE')).toBe('onsite')
    expect(normalizeTargetRoleTypeValue('INDIVIDUAL_CONTRIBUTOR')).toBeNull()
    expect(normalizeTargetRoleTypeValue('VP, FP&A')).toBe('VP, FP&A')
    expect(normalizeFunctionValue('Something else')).toBe('Something else') // never guessed
  })

  it('returns the same object when nothing changes', () => {
    const c = member()
    expect(normalizeCandidateProfileFields(c)).toBe(c)
  })

  it('a profile stored as codes scores exactly like the canonical one', () => {
    const coded = member({ primaryFunction: 'OPERATIONS', highestLevelReached: 'VP', remotePreference: 'HYBRID' })
    for (const p of [job(), job({ title: 'Director of Operations', level: 'DIRECTOR' }), job({ location: 'Remote' })]) {
      expect(computeFitAssessment(coded, p)).toEqual(computeFitAssessment(member(), p))
      expect(legacyComputeBoardListingFitBucket(coded, p)).toBe(legacyComputeBoardListingFitBucket(member(), p))
    }
  })

  it('the job match no longer crashes on an unrecognised company stage', () => {
    const c = { targetCompanyStage: 'GROWTH', targetCompanySize: null, priorityMission: null, priorityWorkLife: null, priorityJobSecurity: null, priorityBrandName: null, equityImportant: false } as unknown as MatchCandidate
    const j = { title: 'VP Product', description: 'A Series B startup building payments.', skills: [], location: null, level: null, industry: null } as unknown as MatchJob
    expect(() => matchJobToCandidate({ ...emptyMatchCandidate, ...c }, { ...emptyMatchJob, ...j })).not.toThrow()
  })
})

// ── Email safety: with FIT_SCORING_V2_FOR_EMAILS off, the emails pick exactly
// what the pre-v2 code picked. The snapshot was generated from the pre-v2
// job-fit-bucket.ts (commit adfda4df) over 260 live board postings.
interface Snapshot {
  candidates: (Candidate & { key: string })[]
  postings: (Posting & { id: string; companyName: string | null; createdAt: string; postedAt: string | null; audienceTier: string; source: string; sourceCategory: string | null; sourceCount: number | null })[]
  expected: Record<string, Record<string, { bucket: string; veryStrong: boolean }>>
}
const snapshot: Snapshot = JSON.parse(readFileSync(path.join(__dirname, 'fixtures/fit-scoring-legacy-snapshot.json'), 'utf8'))
// The one member stored as raw codes reads correctly now — the deliberate,
// documented change (the old code gave them nothing at all).
const UNCHANGED = snapshot.candidates.filter((c) => c.key !== 'all-caps-codes')

describe('email path unchanged with FIT_SCORING_V2_FOR_EMAILS off', () => {
  const prev = process.env.FIT_SCORING_V2_FOR_EMAILS
  beforeEach(() => {
    delete process.env.FIT_SCORING_V2_FOR_EMAILS
  })
  afterEach(() => {
    if (prev === undefined) delete process.env.FIT_SCORING_V2_FOR_EMAILS
    else process.env.FIT_SCORING_V2_FOR_EMAILS = prev
  })

  it('defaults to the legacy scorer; only "true" switches', () => {
    expect(emailFitScoringVersion()).toBe('legacy')
    process.env.FIT_SCORING_V2_FOR_EMAILS = 'false'
    expect(emailFitScoringVersion()).toBe('legacy')
    process.env.FIT_SCORING_V2_FOR_EMAILS = 'true'
    expect(emailFitScoringVersion()).toBe('v2')
  })

  it('the fixture exercises strong and very-strong cases', () => {
    const all = UNCHANGED.flatMap((c) => Object.values(snapshot.expected[c.key]))
    expect(all.filter((e) => e.bucket === 'strong').length).toBeGreaterThan(100)
    expect(all.filter((e) => e.veryStrong).length).toBeGreaterThan(20)
  })

  it('bucket and very-strong verdicts match the pre-v2 code for every member x posting', () => {
    const version = emailFitScoringVersion()
    let mismatches = 0
    for (const c of UNCHANGED) {
      for (const p of snapshot.postings) {
        const want = snapshot.expected[c.key][p.id]
        if (boardListingFitBucketFor(version, c, p) !== want.bucket) mismatches++
        if (isVeryStrongBoardFitFor(version, c, p, candidateScaleLevel(p.level)) !== want.veryStrong) mismatches++
        if (legacyIsVeryStrongBoardFit(c, p, candidateScaleLevel(p.level)) !== want.veryStrong) mismatches++
      }
    }
    expect(mismatches).toBe(0)
  })

  it('the email shortlist ranking uses the pre-v2 buckets', () => {
    // One company per row, so per-company caps and title de-duplication don't reorder.
    const rows = snapshot.postings.map((p) => ({ ...p, companyName: p.id, createdAt: new Date(p.createdAt), postedAt: p.postedAt ? new Date(p.postedAt) : null })) as unknown as BoardRankRow[]
    for (const c of UNCHANGED) {
      const ranked = rankBoardRows(rows, { candidate: c, isCandidatePlus: true, size: rows.length, fitScoring: emailFitScoringVersion() })
      // Ranking is on light rows (no description); the snapshot buckets used
      // descriptions, so compare against the legacy scorer on the same rows.
      const legacyRanks = ranked.openIds.map((id) => FIT_BUCKET_SORT_RANK[legacyComputeBoardListingFitBucket(c, { ...rows.find((r) => r.id === id)!, description: null })])
      expect(legacyRanks).toEqual([...legacyRanks].sort((a, b) => a - b))
      expect(ranked.openIds.length).toBe(rows.length)
    }
  })

  it('switching the flag on moves the emails to v2', () => {
    process.env.FIT_SCORING_V2_FOR_EMAILS = 'true'
    const c = UNCHANGED.find((m) => m.key === 'cfo-boston')!
    const p = job({ title: 'Chief Financial Officer', level: 'C_SUITE', location: 'Cambridge, MA' })
    expect(isVeryStrongBoardFitFor(emailFitScoringVersion(), c, p, 'C-Suite')).toBe(isVeryStrongBoardFit(c, p, 'C-Suite'))
  })
})

const emptyMatchCandidate: MatchCandidate = {
  resumeKeywords: [], confirmedSkillsHave: [], certifications: [], yearsExperience: null, hasJD: false, hasMD: false, hasDO: false,
  isPeopleManager: null, teamSizeManaged: null, targetCompanySize: null, targetCompanyStage: null, priorityMission: null,
  priorityWorkLife: null, priorityJobSecurity: null, priorityBrandName: null, equityImportant: false, targetCompMin: null,
  compFlexible: false, lastSalary: null, targetRoleType: null, targetFunction: null, primaryFunction: null, secondaryFunction: null,
  targetIndustries: [], industryContext: null, isPivoting: false, highestLevelReached: null, levelRankScore: null,
  willingToStartLower: false, remotePreference: null, currentCity: null, currentState: null, openToRelocation: false,
  travelWillingness: false, interimConsultingInterest: false,
}
const emptyMatchJob: MatchJob = {
  title: '', description: null, skills: [], location: null, level: null, industry: null, salaryMin: null, salaryMax: null,
  marketPayLow: null, marketPayMid: null, marketPayHigh: null, targetFunction: null, targetLevel: null, targetRemotePolicy: null,
}
