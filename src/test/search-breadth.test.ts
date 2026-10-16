import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/prisma', () => ({ prisma: {} }))
vi.mock('@/lib/jobs/ghost-risk-data', () => ({ getClosedPostingCounts: async () => new Map() }))

import {
  boardBreadthFor,
  classifyJob,
  defaultBreadth,
  emailBreadthFor,
  isSeniorMember,
  matchReason,
  matchReasonSentence,
  memberFunctions,
  parseBreadth,
  passesSkillsThreshold,
  pivotTargetIndex,
  SKILLS_THRESHOLD,
  type JobBreadthFacts,
  type MemberBreadthVector,
} from '@/lib/jobs/search-breadth'
import { buildSimilarityRows, type OnetFileOccupation } from '@/lib/careers/occupation-similarity'
import { rankBoardRows, type BoardRankRow } from '@/lib/jobs/board-shortlist'
import type { BreadthPlacement } from '@/lib/jobs/search-breadth-server'

describe('breadth defaults', () => {
  it('senior members (Manager and up, or ~8+ years) default to Narrow', () => {
    expect(defaultBreadth({ highestLevelReached: 'Director', yearsExperience: 12 })).toBe('narrow')
    expect(defaultBreadth({ highestLevelReached: 'Manager' })).toBe('narrow')
    expect(defaultBreadth({ highestLevelReached: 'C-Suite' })).toBe('narrow')
    expect(defaultBreadth({ highestLevelReached: 'IC', yearsExperience: 9 })).toBe('narrow')
    expect(isSeniorMember({ highestLevelReached: 'VP' })).toBe(true)
  })

  it('junior members (Entry / Early / Mid, or under ~5 years) default to Wide', () => {
    expect(defaultBreadth({ highestLevelReached: 'IC', yearsExperience: 1 })).toBe('wide')
    expect(defaultBreadth({ highestLevelReached: 'IC', yearsExperience: 4 })).toBe('wide')
    expect(defaultBreadth({ highestLevelReached: 'IC', yearsExperience: 6 })).toBe('wide')
    expect(defaultBreadth({ yearsExperience: 3 })).toBe('wide')
  })

  it('a member we cannot place is treated as senior', () => {
    expect(defaultBreadth({})).toBe('narrow')
  })

  it('the URL beats the saved choice, which beats the default', () => {
    const junior = { highestLevelReached: 'IC', yearsExperience: 2 }
    expect(boardBreadthFor(junior)).toBe('wide')
    expect(boardBreadthFor({ ...junior, boardBreadth: 'narrow' })).toBe('narrow')
    expect(boardBreadthFor({ ...junior, boardBreadth: 'narrow' }, 'wide')).toBe('wide')
    expect(boardBreadthFor({ ...junior, boardBreadth: 'narrow' }, 'nonsense')).toBe('narrow')
    expect(parseBreadth(['wide'])).toBe('wide')
    expect(parseBreadth(undefined)).toBeNull()
  })

  it('emails use Narrow unless the member chose Wide, whatever their stage', () => {
    expect(emailBreadthFor({ highestLevelReached: 'IC', yearsExperience: 1 })).toBe('narrow')
    expect(emailBreadthFor({ highestLevelReached: 'IC', yearsExperience: 1, boardBreadth: 'wide' })).toBe('wide')
    expect(emailBreadthFor({ highestLevelReached: 'VP', boardBreadth: 'narrow' })).toBe('narrow')
  })
})

describe('skills-adjacent thresholds', () => {
  it('Narrow keeps only near-twins', () => {
    expect(passesSkillsThreshold({ score: 0.9, related: false }, 'narrow')).toBe(true)
    expect(passesSkillsThreshold({ score: SKILLS_THRESHOLD.narrow.related - 0.01, related: true }, 'narrow')).toBe(false)
  })

  it('Wide takes the next ring, with a higher bar for pairs O*NET does not relate', () => {
    expect(passesSkillsThreshold({ score: 0.75, related: true }, 'wide')).toBe(true)
    expect(passesSkillsThreshold({ score: 0.75, related: false }, 'wide')).toBe(false)
    expect(passesSkillsThreshold({ score: 0.81, related: false }, 'wide')).toBe(true)
    expect(passesSkillsThreshold({ score: 0.7, related: true }, 'wide')).toBe(false)
  })

  it('every score Narrow keeps, Wide keeps too', () => {
    for (let s = 0.5; s <= 1; s += 0.01) {
      for (const related of [true, false]) {
        if (passesSkillsThreshold({ score: s, related }, 'narrow')) expect(passesSkillsThreshold({ score: s, related }, 'wide')).toBe(true)
      }
    }
  })
})

function member(over: Partial<MemberBreadthVector> = {}): MemberBreadthVector {
  const pivotTargets = over.pivotTargets ?? new Map([['people_operations', 'People operations'], ['business_development', 'Business development']])
  return {
    functions: memberFunctions(['Human Resources', 'General']),
    targetFunction: null,
    targetFunctionLabel: null,
    sourceRole: 'recruiter',
    sourceLabel: 'Recruiter',
    pivotTargets,
    pivotTargetsByFunction: pivotTargetIndex([
      ['people_operations', 'Human Resources'],
      ['business_development', 'Sales'],
    ]),
    soc: '13-1071.00',
    similar: new Map([
      ['13-1075.00', { score: 0.9, related: true, title: 'Labor Relations Specialists', shared: ['Personnel and human resources', 'Negotiation'] }],
      ['11-9199.02', { score: 0.74, related: false, title: 'Compliance Managers', shared: ['Administration and management'] }],
      ['43-6011.00', { score: 0.81, related: false, title: 'Executive Secretaries', shared: ['Administrative'] }],
    ]),
    functionLabel: 'Human Resources',
    industries: new Set(['Technology & Software']),
    ...over,
  }
}

function job(over: Partial<JobBreadthFacts> & { title?: string } = {}): JobBreadthFacts {
  const title = (over.title ?? '').toLowerCase()
  return {
    titleFunction: '',
    targetFunction: null,
    soc: null,
    pivotRole: (roles) => {
      for (const r of roles) if ((r === 'business_development' && /business development/.test(title)) || (r === 'people_operations' && /people operations/.test(title))) return r
      return null
    },
    ...over,
  }
}

describe('classifyJob', () => {
  const m = member()

  it('own function or own occupation is "field", at either breadth', () => {
    expect(classifyJob(m, job({ titleFunction: 'human resources' }), 'narrow')).toEqual({ kind: 'field' })
    expect(classifyJob(m, job({ soc: '13-1071.00' }), 'narrow')).toEqual({ kind: 'field' })
    expect(classifyJob(m, job({ targetFunction: 'Human Resources' }), 'narrow')).toEqual({ kind: 'field' })
  })

  it('"General" is not a function anyone matches on', () => {
    expect(classifyJob(m, job({ titleFunction: 'general' }), 'wide')).toBeNull()
  })

  it('a pivot-map path is a pivot, tested only against targets in the job title\'s function', () => {
    expect(classifyJob(m, job({ titleFunction: 'sales', title: 'VP Business Development' }), 'narrow')).toEqual({ kind: 'pivot', pivot: 'business_development' })
    // Unknown function: every target is tried.
    expect(classifyJob(m, job({ titleFunction: '', title: 'Head of Business Development' }), 'narrow')).toEqual({ kind: 'pivot', pivot: 'business_development' })
    // A finance title is never tested against the sales target.
    expect(classifyJob(m, job({ titleFunction: 'finance', title: 'Business Development Finance Lead' }), 'wide')).toBeNull()
  })

  it('the function they want to move into is a pivot', () => {
    const mt = member({ targetFunction: 'marketing', targetFunctionLabel: 'Marketing' })
    expect(classifyJob(mt, job({ titleFunction: 'marketing' }), 'narrow')).toEqual({ kind: 'pivot', pivot: 'fn:marketing' })
  })

  it('skills matches depend on breadth', () => {
    expect(classifyJob(m, job({ soc: '13-1075.00' }), 'narrow')).toMatchObject({ kind: 'skills', score: 0.9 })
    expect(classifyJob(m, job({ soc: '43-6011.00' }), 'narrow')).toBeNull()
    expect(classifyJob(m, job({ soc: '43-6011.00' }), 'wide')).toMatchObject({ kind: 'skills', score: 0.81 })
    // Unrelated and under the Wide bar for unrelated pairs.
    expect(classifyJob(m, job({ soc: '11-9199.02' }), 'wide')).toBeNull()
    expect(classifyJob(m, job({ soc: '99-9999.00' }), 'wide')).toBeNull()
  })
})

describe('reason labels', () => {
  const m = member()
  const has = (s: string) => ['scheduling', 'vendor coordination', 'workday'].includes(s.toLowerCase())

  it('"Your field", and the industry pivot when the job is in another industry', () => {
    expect(matchReason(m, { kind: 'field' }, { soc: null }, has).label).toBe('Your field')
    expect(matchReason(m, { kind: 'field' }, { soc: null, industryBucket: 'Technology & Software' }, has).label).toBe('Your field')
    expect(matchReason(m, { kind: 'field' }, { soc: null, industryBucket: 'Healthcare' }, has)).toEqual({ kind: 'industry_pivot', label: 'Pivot: Human Resources in Healthcare' })
    // Nothing known about the member's industry: no claim of a new one.
    expect(matchReason(member({ industries: new Set() }), { kind: 'field' }, { soc: null, industryBucket: 'Healthcare' }, has).label).toBe('Your field')
  })

  it('"Pivot: <from> → <to>"', () => {
    expect(matchReason(m, { kind: 'pivot', pivot: 'business_development' }, { soc: null }, has).label).toBe('Pivot: Recruiter → Business development')
    const mt = member({ targetFunction: 'marketing', targetFunctionLabel: 'Marketing' })
    expect(matchReason(mt, { kind: 'pivot', pivot: 'fn:marketing' }, { soc: null }, has).label).toBe('Pivot: Human Resources → Marketing')
  })

  it('"Skills match: …" names the posting\'s skills the member has, else what the occupations share', () => {
    const fromPosting = matchReason(m, { kind: 'skills', score: 0.9 }, { soc: '13-1075.00' }, has, ['Scheduling', 'Python', 'Vendor coordination'])
    expect(fromPosting.label).toBe('Skills match: scheduling, vendor coordination')
    expect(fromPosting.sharedSkills).toEqual(['Scheduling', 'Vendor coordination'])
    const fromOnet = matchReason(m, { kind: 'skills', score: 0.9 }, { soc: '13-1075.00' }, has, ['Python'])
    expect(fromOnet.label).toBe('Skills match: personnel and human resources, negotiation')
    expect(matchReason(m, { kind: 'skills' }, { soc: null }, has).label).toBe('Skills match')
  })

  it('every reason reads as a sentence', () => {
    expect(matchReasonSentence({ kind: 'field', label: 'Your field' })).toMatch(/your field/)
    expect(matchReasonSentence({ kind: 'skills', label: 'Skills match: workday', sharedSkills: ['Workday'] })).toBe('Shown because it uses skills you have: workday.')
  })
})

describe('occupation similarity', () => {
  const sv = (hi: string[]) =>
    Object.fromEntries(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'].map((k) => [k, hi.includes(k) ? 4.5 : 2]))
  const occ: Record<string, OnetFileOccupation> = {
    '1': { title: 'Project Scheduler', skillVector: sv(['A', 'B', 'C']), knowledge: [{ name: 'Administration and Management', importance: 4 }], related: [{ code: '2', tier: 'Primary-Short', index: 1 }] },
    '2': { title: 'Project Coordinator', skillVector: sv(['A', 'B', 'D']), knowledge: [{ name: 'Administration and Management', importance: 4 }] },
    '3': { title: 'Welder', skillVector: sv(['J', 'K', 'L']), knowledge: [] },
    '4': { title: 'All Other', related: [{ code: '1', tier: 'Primary-Long', index: 1 }] },
    '5': { title: 'Chef', skillVector: sv(['G', 'H', 'I']), knowledge: [] },
    '6': { title: 'Pilot', skillVector: sv(['E', 'F', 'G']), knowledge: [] },
    '7': { title: 'Nurse', skillVector: sv(['H', 'K', 'E']), knowledge: [] },
  }
  const rows = buildSimilarityRows(occ)
  const get = (a: string, b: string) => rows.find((r) => r.socCode === a && r.similarSocCode === b)

  it('alike occupations score high, related pairs are lifted, unlike ones are left out', () => {
    expect(get('1', '2')!.score).toBeGreaterThan(0.6)
    expect(get('1', '2')!.related).toBe(true)
    // Related works both ways.
    expect(get('2', '1')!.related).toBe(true)
    expect(get('1', '3')).toBeUndefined()
  })

  it('an occupation with no ratings is placed by its related list alone', () => {
    expect(get('4', '1')).toMatchObject({ score: 0.74, related: true })
  })

  it('names what the two share', () => {
    expect(get('1', '2')!.sharedSkills[0]).toBe('Administration and management')
  })
})

describe('board ranking with breadth', () => {
  const now = new Date('2026-10-16T12:00:00Z')
  const row = (id: string, title: string): BoardRankRow => ({
    id,
    title,
    companyName: `Co ${id}`,
    audienceTier: 'OPEN',
    source: 'ncrawl',
    targetFunction: null,
    targetLevel: null,
    targetRemotePolicy: null,
    targetLocation: null,
    location: 'Remote',
    level: 'DIRECTOR',
    sourceCategory: null,
    postedAt: now,
    sourceCount: 1,
    salaryMin: null,
    salaryMax: null,
    createdAt: now,
    employmentType: null,
  }) as BoardRankRow
  const rows = [row('a', 'Director of Sales'), row('b', 'HR Director'), row('c', 'Director, Labor Relations'), row('d', 'Director of Nursing')]
  const placement: Record<string, BreadthPlacement | null> = {
    a: { rank: 1, inNarrow: true, cls: { kind: 'pivot', pivot: 'x' } },
    b: { rank: 0, inNarrow: true, cls: { kind: 'field' } },
    c: { rank: 2, inNarrow: false, cls: { kind: 'skills', score: 0.8 } },
    d: null,
  }
  const candidate = { highestLevelReached: 'Director', primaryFunction: 'Human Resources' } as Parameters<typeof rankBoardRows>[1]['candidate']
  const base = { candidate, isCandidatePlus: true, now, place: (p: BoardRankRow) => placement[p.id] }

  it('Narrow drops skills matches under its bar and unrelated jobs; counts both breadths', () => {
    const r = rankBoardRows(rows, { ...base, breadth: 'narrow' })
    expect(r.openIds).toEqual(['b', 'a'])
    expect(r.narrowTotal).toBe(2)
    expect(r.wideTotal).toBe(3)
  })

  it('Wide ranks field, then pivots, then skills matches', () => {
    expect(rankBoardRows(rows, { ...base, breadth: 'wide' }).openIds).toEqual(['b', 'a', 'c'])
  })

  it('a search keeps unmatched jobs, ranked last', () => {
    expect(rankBoardRows(rows, { ...base, breadth: 'narrow', breadthKeepUnmatched: true }).openIds).toEqual(['b', 'a', 'c', 'd'])
  })

  it('no breadth: the board as before', () => {
    const r = rankBoardRows(rows, { candidate, isCandidatePlus: true, now })
    expect(r.openTotal).toBe(4)
  })
})
