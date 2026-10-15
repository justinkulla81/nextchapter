import { describe, expect, it } from 'vitest'
import { matchJobToCandidate, jobArrangement, toMatchJob, type MatchJob } from '@/lib/jobs/job-match'
import type { MatchCandidate } from '@/lib/jobs/job-match'

const blank: MatchCandidate = {
  resumeKeywords: [],
  confirmedSkillsHave: [],
  certifications: [],
  yearsExperience: null,
  hasJD: false,
  hasMD: false,
  hasDO: false,
  isPeopleManager: null,
  teamSizeManaged: null,
  targetCompanySize: null,
  targetCompanyStage: null,
  priorityMission: null,
  priorityWorkLife: null,
  priorityJobSecurity: null,
  priorityBrandName: null,
  equityImportant: false,
  targetCompMin: null,
  compFlexible: false,
  lastSalary: null,
  targetRoleType: null,
  targetFunction: null,
  primaryFunction: null,
  secondaryFunction: null,
  targetIndustries: [],
  industryContext: null,
  isPivoting: false,
  highestLevelReached: null,
  levelRankScore: null,
  willingToStartLower: false,
  remotePreference: null,
  currentCity: null,
  currentState: null,
  openToRelocation: false,
  travelWillingness: false,
  interimConsultingInterest: false,
}

const opsDirector: MatchCandidate = {
  ...blank,
  resumeKeywords: ['operations', 'budgeting', 'procurement', 'lean', 'supply chain'],
  yearsExperience: 15,
  isPeopleManager: true,
  teamSizeManaged: 12,
  targetCompMin: 160_000,
  targetRoleType: 'Director of Operations',
  primaryFunction: 'Operations',
  targetIndustries: ['Healthcare'],
  highestLevelReached: 'Director',
  remotePreference: 'remote',
  currentCity: 'Austin',
  currentState: 'TX',
  priorityWorkLife: 1,
  targetCompanyStage: 'enterprise',
}

const job = (over: Partial<MatchJob>): MatchJob => ({
  title: 'Director of Operations',
  description: null,
  skills: [],
  location: null,
  level: 'DIRECTOR',
  industry: null,
  salaryMin: null,
  salaryMax: null,
  marketPayLow: null,
  marketPayMid: null,
  marketPayHigh: null,
  targetFunction: null,
  targetLevel: null,
  targetRemotePolicy: null,
  ...over,
})

describe('matchJobToCandidate', () => {
  it('a remote healthcare ops director role that pays enough is a strong match', () => {
    const m = matchJobToCandidate(
      opsDirector,
      job({
        location: 'Remote, US',
        industry: 'healthcare',
        salaryMin: 170_000,
        salaryMax: 210_000,
        skills: ['operations', 'budgeting', 'procurement'],
        description: 'Fully remote. 10+ years of operations experience. Publicly traded health system; work-life balance matters here.',
      })
    )
    expect(m.dimensions.skills.status).toBe('strong')
    expect(m.dimensions.salary.status).toBe('strong')
    expect(m.dimensions.goals.status).toBe('strong')
    expect(m.dimensions.workStyle.status).toBe('strong')
    expect(m.overall).toBe('strong')
  })

  it('onsite in another state, below the pay floor, missing skills: names each gap specifically', () => {
    const m = matchJobToCandidate(
      opsDirector,
      job({
        location: 'Chicago, IL',
        salaryMin: 110_000,
        salaryMax: 130_000,
        skills: ['six sigma', 'erp', 'sap', 'operations'],
        description: 'This role is on-site in our Chicago plant. Fast-paced environment; nights and weekends as needed. Manage a team of 40.',
      })
    )
    expect(m.dimensions.workStyle.status).toBe('gap')
    expect(m.dimensions.salary.status).toBe('gap')
    expect(m.gaps.length).toBeGreaterThanOrEqual(2)
    expect(m.gaps.length).toBeLessThanOrEqual(4)
    expect(m.gaps.join(' ')).toMatch(/Chicago, IL/)
    expect(m.gaps.join(' ')).toMatch(/\$130k.*\$160k/)
    expect(m.gaps.join(' ')).toMatch(/six sigma/)
    expect(['weak', 'mixed']).toContain(m.overall)
  })

  it('a member with no profile data gets unknowns and prompts, never invented gaps', () => {
    const m = matchJobToCandidate(blank, job({ location: 'Denver, CO', salaryMin: 150_000, salaryMax: 180_000 }))
    for (const d of Object.values(m.dimensions)) expect(d.status).toBe('unknown')
    expect(m.overall).toBe('unknown')
    expect(m.overallScore).toBeNull()
    expect(m.dimensions.culture.profilePrompt?.href).toBe('/dashboard/search-strategy#culture-preferences')
    expect(m.dimensions.skills.profilePrompt?.href).toBe('/dashboard/skills-assessments')
    expect(m.gaps).toHaveLength(1)
    expect(m.gaps[0]).toMatch(/can't judge/)
  })

  it('labels a market estimate as an estimate when no pay is posted', () => {
    const m = matchJobToCandidate(opsDirector, job({ marketPayLow: 120_000, marketPayMid: 135_000, marketPayHigh: 150_000 }))
    expect(m.dimensions.salary.evidence[0]).toMatch(/our estimate/)
    expect(m.dimensions.salary.status).not.toBe('strong')
    expect(m.gaps.join(' ')).toMatch(/Our estimate/)
  })

  it('a required license the member lacks caps the match and is the first gap', () => {
    const m = matchJobToCandidate(opsDirector, job({ title: 'Senior Attorney', description: 'Seeking a licensed attorney.' }))
    expect(m.dimensions.skills.status).toBe('gap')
    expect(m.gaps[0]).toMatch(/law license/)
    expect(m.overall === 'weak' || m.overall === 'mixed').toBe(true)
  })

  it('culture: startup vs an enterprise target, and job security as a top priority', () => {
    const m = matchJobToCandidate(
      { ...opsDirector, priorityJobSecurity: 2 },
      job({ description: 'Join our Series A startup as a founding member of the ops team.' })
    )
    expect(m.dimensions.culture.status).toBe('gap')
    expect(m.gaps.join(' ')).toMatch(/startup/)
  })

  it('culture is unknown (not a gap) when the posting gives no signal', () => {
    const m = matchJobToCandidate(opsDirector, job({ description: 'Oversee daily operations.' }))
    expect(m.dimensions.culture.status).toBe('unknown')
    expect(m.dimensions.culture.profilePrompt).toBeUndefined()
  })

  it('goals: a step down is a gap unless the member said they would start lower', () => {
    const down = job({ title: 'Operations Manager', level: 'MANAGER' })
    expect(matchJobToCandidate(opsDirector, down).dimensions.goals.evidence.join(' ')).toMatch(/Below your level/)
    const open = matchJobToCandidate({ ...opsDirector, willingToStartLower: true }, down)
    expect(open.dimensions.goals.evidence.join(' ')).toMatch(/open to that/)
  })

  it('goals: an off-target function is flagged', () => {
    const m = matchJobToCandidate(opsDirector, job({ title: 'Director of Software Engineering' }))
    expect(m.dimensions.goals.status).not.toBe('strong')
  })

  it('working style: relocation counts as partial when the member is open to moving', () => {
    const m = matchJobToCandidate(
      { ...opsDirector, remotePreference: 'flexible', openToRelocation: true },
      job({ location: 'Baltimore, MD', description: 'On-site role.' })
    )
    expect(m.dimensions.workStyle.evidence.join(' ')).toMatch(/open to/)
    expect(m.dimensions.workStyle.status).not.toBe('gap')
  })

  it('confidential jobs: the description is dropped before matching', () => {
    const mj = toMatchJob({
      ...job({ description: 'Acme Corp, the client, is hiring' }),
      description: 'Acme Corp, the client, is hiring',
      disclosure: 'CONFIDENTIAL',
    })
    expect(mj.description).toBeNull()
    const m = matchJobToCandidate(opsDirector, mj)
    expect(JSON.stringify(m)).not.toMatch(/Acme/)
  })
})

describe('jobArrangement', () => {
  it('reads remote, hybrid with days, and on-site', () => {
    expect(jobArrangement(job({ location: 'Remote - US' }))?.arrangement).toBe('remote')
    expect(jobArrangement(job({ description: 'Hybrid: 3 days in the office each week.' }))).toEqual({ arrangement: 'hybrid', detail: '3 days in the office' })
    expect(jobArrangement(job({ description: 'This is an on-site position.' }))?.arrangement).toBe('onsite')
    expect(jobArrangement(job({}))).toBeNull()
  })
})

describe('explain gaps (phase 2, off by default)', () => {
  it('is disabled unless the flag is set, and the prompt never names a confidential client', async () => {
    const { isExplainGapsEnabled, buildExplainGapsPrompt } = await import('@/lib/jobs/explain-gaps')
    expect(isExplainGapsEnabled()).toBe(false)
    const m = matchJobToCandidate(opsDirector, job({ location: 'Chicago, IL' }))
    const prompt = buildExplainGapsPrompt({ title: 'VP Operations', company: null, excerpt: null, match: m })
    expect(prompt).toMatch(/confidential search/)
    expect(prompt).toMatch(/Working style/)
  })
})

describe('pay and arrangement read from posting text', () => {
  it('uses a range stated in the description when no salary is stored', async () => {
    const { payFromText } = await import('@/lib/jobs/job-match')
    expect(payFromText('The general salary range for this full-time position is $95,000 – 135,000.')).toEqual({ low: 95_000, high: 135_000 })
    expect(payFromText('Pay: $120K-$150K')).toEqual({ low: 120_000, high: 150_000 })
    expect(payFromText('$25 - $30 per hour')).toBeNull()
    const m = matchJobToCandidate(opsDirector, job({ description: 'Salary range $95,000 – 135,000.', marketPayLow: 163_000, marketPayHigh: 240_000 }))
    expect(m.dimensions.salary.evidence[0]).toMatch(/^Posted pay \$95k/)
  })
  it('reads "on-site 4 days" as hybrid', () => {
    expect(jobArrangement(job({ description: 'required to be on-site 4 days a week' }))).toEqual({ arrangement: 'hybrid', detail: '4 days in the office' })
  })
})
