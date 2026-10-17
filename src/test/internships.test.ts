import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'

// Owner rule: internships only appear in Higher Ed portals — never on the
// member board, its emails/alerts (cut from the same shared board), pivots,
// company counts or surfaced jobs; and in a portal only for that college.

const lightRowsStore: { rows: Record<string, unknown>[] } = { rows: [] }
vi.mock('server-only', () => ({}))
vi.mock('@/lib/jobs/ghost-risk-data', () => ({ getClosedPostingCounts: async () => new Map() }))
vi.mock('@/lib/jobs/board-light-rows', async (orig) => ({
  ...(await orig<typeof import('@/lib/jobs/board-light-rows')>()),
  // The core board (level notIn early rungs) and the early-career board (level in them).
  findLightRowsPage: async (where: unknown, afterId: string | null, take: number) => {
    const early = JSON.stringify(where).includes('"level":{"in"')
    return lightRowsStore.rows
      .filter((r) => (r.level === 'ENTRY_IC' || r.level === 'EARLY_IC') === early && (afterId === null || (r.id as string) > afterId))
      .sort((a, b) => ((a.id as string) < (b.id as string) ? -1 : 1))
      .slice(0, take)
  },
}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    exclusiveJobPosting: {
      findMany: async ({ where }: { where: { id: { in: string[] } } }) => lightRowsStore.rows.filter((r) => where.id.in.includes(r.id as string)),
    },
  },
}))

import { classifyWorkType, defaultWorkTypes, isInternshipJob, isWorkType, memberWorkType, parseWorkTypesParam, WORK_TYPES } from '@/lib/jobs/work-type'
import { liveBoardWhere, loadBoardShortlist } from '@/lib/jobs/board-shortlist'
import { mirrorCanAnswer } from '@/lib/jobs/board-light-rows'
import { ALL_STAGES_WINDOW } from '@/lib/jobs/career-stage'
import { computeBoardListingFitBucket } from '@/lib/jobs/job-fit-bucket'
import { internshipDeadline, internshipField, internshipTerm, screenInternship } from '@/lib/internships/fields'
import { prepareInternship } from '@/lib/internships/import'
import { notInternshipWhere } from '@/lib/internships/exclude'
import { tabsFor, ALL_TOKENS, type AccessToken } from '@/lib/higher-ed/workspaces'
import { modulesFrom } from '@/lib/higher-ed/modules'

describe('internship work type', () => {
  it('classifies internships as their own type, not contract', () => {
    expect(classifyWorkType({ title: 'Summer 2027 Finance Intern' })).toBe('internship')
    expect(classifyWorkType({ title: 'Software Engineering Internship' })).toBe('internship')
    expect(classifyWorkType({ title: 'Engineering Co-op Student (Spring 2027)' })).toBe('internship')
    expect(classifyWorkType({ title: 'Business Analyst', employmentType: 'internship' })).toBe('internship')
    // The crawler saying full_time doesn't hide an intern title.
    expect(classifyWorkType({ title: 'Marketing Intern', employmentType: 'full_time' })).toBe('internship')
  })
  it('never mistakes real jobs for internships', () => {
    for (const title of ['Internal Audit Manager', 'International Tax Director', 'Internship Program Manager', 'Coordinator, Internships and Co-ops', 'Co-op Marketing Manager', 'Director of Internal Medicine', 'Contract Specialist'])
      expect(isInternshipJob({ title }), title).toBe(false)
    expect(classifyWorkType({ title: 'Senior Software Engineer (Contract)' })).toBe('contract')
  })
  it('is never a member board type: not selectable, not saved, not a default', () => {
    expect(WORK_TYPES).not.toContain('internship')
    expect(isWorkType('internship')).toBe(false)
    expect(parseWorkTypesParam('internship')).toBeNull()
    expect(defaultWorkTypes({ jobBoardWorkTypes: ['internship'] })).toEqual(['full_time'])
    expect(memberWorkType({ title: 'Data Science Intern' })).toBeNull()
  })
  it('students get full-time (entry-level) jobs by default, not internships or contract', () => {
    expect(defaultWorkTypes({ journey: 'STUDENT_NEW_GRAD' })).toEqual(['full_time'])
  })
})

describe('member board, emails and alerts drop internships', () => {
  it('liveBoardWhere keeps crawler-typed internships out and stays answerable by the light-row copy', () => {
    const where = liveBoardWhere({ level: 'ENTRY_IC' })
    expect(where.AND).toEqual([notInternshipWhere(), { level: 'ENTRY_IC' }])
    expect(mirrorCanAnswer(where)).toBe(true)
    // A NULL employment type is kept (NOT IN alone would drop every untyped job).
    expect(notInternshipWhere()).toEqual({ OR: [{ employmentType: null }, { employmentType: { notIn: ['internship', 'co_op', 'coop'] } }] })
  })

  it('the shared board (board page, Job Search Daily, fresh-job alerts, coach digest) never ranks or counts an internship', async () => {
    const snapshot = JSON.parse(readFileSync(path.join(__dirname, 'fixtures/fit-scoring-legacy-snapshot.json'), 'utf8')) as {
      candidates: Parameters<typeof computeBoardListingFitBucket>[0][]
    }
    const now = new Date()
    const row = (id: string, title: string, employmentType: string | null = null) => ({
      id, title, companyName: `Co ${id}`, audienceTier: 'ALL_CANDIDATES', source: 'ats_feed', targetFunction: null, targetLevel: null,
      targetRemotePolicy: null, targetLocation: null, location: 'Boston, MA', level: 'ENTRY_IC', sourceCategory: null, postedAt: now,
      sourceCount: null, salaryMin: null, salaryMax: null, createdAt: now, employmentType,
    })
    lightRowsStore.rows = [
      row('a', 'Financial Analyst'),
      row('b', 'Summer Finance Intern'),
      row('c', 'Data Analyst', 'internship'),
      row('d', 'Software Engineering Co-op Student'),
      row('e', 'Internal Audit Associate'),
    ]
    const board = await loadBoardShortlist({
      candidate: snapshot.candidates[0],
      isCandidatePlus: true,
      size: 50,
      stageWindow: ALL_STAGES_WINDOW,
      includeMidLevel: true,
      includeEarlyCareer: true,
      workTypes: [...WORK_TYPES],
    })
    const ids = board.open.map((p) => p.id).sort()
    expect(ids).toEqual(['a', 'e'])
    expect(board.openTotal).toBe(2)
    expect(Object.values(board.countByWorkType).reduce((a, b) => a + b, 0)).toBe(2)
    expect(Object.keys(board.countByWorkType)).not.toContain('internship')
  })
})

describe('internship screen (crawler stream and import)', () => {
  it('keeps professional internships with their field', () => {
    expect(screenInternship({ title: 'Investment Banking Summer Analyst Intern' })).toEqual({ keep: true, field: 'finance' })
    expect(screenInternship({ title: 'Software Engineer Intern' })).toEqual({ keep: true, field: 'software' })
    expect(screenInternship({ title: 'Mechanical Engineering Co-op' })).toEqual({ keep: true, field: 'engineering' })
    expect(screenInternship({ title: 'Public Policy Intern' })).toEqual({ keep: true, field: 'policy' })
    expect(screenInternship({ title: 'UX Design Intern' })).toEqual({ keep: true, field: 'design' })
    expect(screenInternship({ title: 'Healthcare Administration Intern' })).toEqual({ keep: true, field: 'healthcare' })
    expect(internshipField('Intern', 'Corporate Finance')).toBe('finance')
  })
  it('drops frontline, clinical, staff, unpaid and fieldless postings', () => {
    expect(screenInternship({ title: 'Retail Store Intern' }).keep).toBe(false)
    expect(screenInternship({ title: 'Pharmacy Intern' }).keep).toBe(false)
    expect(screenInternship({ title: 'Internship Program Coordinator' }).keep).toBe(false)
    expect(screenInternship({ title: 'Unpaid Marketing Intern' }).keep).toBe(false)
    expect(screenInternship({ title: 'Marketing Intern', description: 'This is an unpaid internship.' }).keep).toBe(false)
    expect(screenInternship({ title: 'Marketing Intern', description: 'This is an unpaid internship for academic credit.' }).keep).toBe(true)
    expect(screenInternship({ title: 'Intern' }).keep).toBe(false)
    expect(screenInternship({ title: 'Co-op Marketing Manager' }).keep).toBe(false)
    expect(screenInternship({ title: 'Student Trainee (Accounting) (GS-4)' })).toEqual({ keep: true, field: 'finance' })
    expect(screenInternship({ title: 'Summer Analyst, Investment Banking', employmentType: 'internship' })).toEqual({ keep: true, field: 'finance' })
    expect(screenInternship({ title: 'Senior Financial Analyst' }).keep).toBe(false)
  })
  it('reads term, year and deadline', () => {
    expect(internshipTerm('Summer 2027 Data Science Intern')).toEqual({ term: 'summer', year: 2027 })
    expect(internshipTerm('Engineering Co-op (Fall)')).toEqual({ term: 'co_op', year: null })
    expect(internshipTerm('Finance Intern', 'Join us this fall 2026 for a 12-week program')).toEqual({ term: 'fall', year: 2026 })
    expect(internshipDeadline('Application deadline: March 1, 2027.')?.toISOString().slice(0, 10)).toBe('2027-03-01')
    expect(internshipDeadline('Apply by 2/15/2027')?.toISOString().slice(0, 10)).toBe('2027-02-15')
    expect(internshipDeadline('No deadline mentioned')).toBeNull()
  })
  it('prepares US internships for import and turns away the rest', () => {
    const h = {
      cleanLocation: (l: string | null | undefined) => l?.trim() || null,
      isNonUs: (l: string | null) => /London|Toronto/.test(l ?? ''),
      statesOf: (l: string | null) => ({ states: /, ([A-Z]{2})\b/.exec(l ?? '')?.slice(1) ?? [], isRemote: /remote/i.test(l ?? '') }),
    }
    const ok = prepareInternship({ title: 'Summer 2027 Finance Intern', companyName: 'Acme', url: 'https://x/1', location: 'Chicago, IL', salaryMin: 25, salaryMax: 30, payPeriod: 'hour' }, h)
    expect(ok.keep && ok.row).toMatchObject({ field: 'finance', term: 'summer', termYear: 2027, locationState: 'IL', remote: false, payPeriod: 'hour' })
    expect(prepareInternship({ title: 'Finance Intern', companyName: 'Acme', url: 'https://x/2', location: 'London, UK' }, h)).toMatchObject({ keep: false, reason: 'outside the US' })
    expect(prepareInternship({ title: 'Warehouse Intern', companyName: 'Acme', url: 'https://x/3' }, h).keep).toBe(false)
    expect(prepareInternship({ title: 'Data Intern', companyName: 'Acme', url: 'https://x/4', location: 'Remote - US' }, h)).toMatchObject({ keep: true, row: { remote: true } })
  })
})

describe('Higher Ed portal: the only place internships appear', () => {
  const tok = (...t: AccessToken[]) => new Set<AccessToken>(t)
  it('students and alumni of a college see an Internships tab', () => {
    expect(tabsFor(tok('MEMBER'), 'candidate').map((t) => t.key)).toContain('internships')
  })
  it('career services staff see it; other staff and employers do not', () => {
    expect(tabsFor(tok('CAREER_SERVICES'), 'career').map((t) => t.key)).toContain('internships')
    expect(tabsFor(tok('INSTITUTION_ADMIN'), 'career').map((t) => t.key)).toContain('internships')
    expect(tabsFor(tok('EMPLOYER'), 'employer').map((t) => t.key)).not.toContain('internships')
    expect(tabsFor(tok('ALUMNI_RELATIONS'), 'alumni').map((t) => t.key)).not.toContain('internships')
  })
  it('a college can switch it off for its members, and workforce customers never have it', () => {
    expect(tabsFor(tok('MEMBER'), 'candidate', modulesFrom({ modules: { internships: false } })).map((t) => t.key)).not.toContain('internships')
    expect(tabsFor(ALL_TOKENS, 'candidate', undefined, 'workforce').map((t) => t.key)).not.toContain('internships')
  })
})

describe('internship rows are scoped to one college', () => {
  it('a portal lists shared internships and its own, never another college’s', async () => {
    const { liveInternshipWhere } = await import('@/lib/internships/data')
    const where = liveInternshipWhere('inst_a', new Date('2026-10-15T00:00:00Z'))
    expect(where.archivedAt).toBeNull()
    expect(where.AND).toContainEqual({ OR: [{ institutionId: null }, { institutionId: 'inst_a' }] })
    expect(JSON.stringify(where)).not.toContain('inst_b')
  })
})
