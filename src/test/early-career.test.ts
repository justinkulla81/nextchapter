import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/prisma', () => ({ prisma: {} }))

import yearsParity from './fixtures/early-career-parity.json'
import { boardLevelWindowWhere, levelOnlyFilter } from '@/lib/jobs/board-shortlist'
import {
  CAREER_STAGES,
  UNKNOWN_STAGE_WINDOW,
  earlyCareerInEmails,
  memberCareerStage,
  memberStageWindow,
  rungsInWindow,
  stagesInWindow,
  type StageMember,
} from '@/lib/jobs/career-stage'
import { screenImportedJob } from '@/lib/jobs/import-screen'
import { classifyTitleRung, levelsInGroup, refineLevelByYears, seniorityGroupOf, SENIORITY_GROUPS, yearsStage } from '@/lib/jobs/job-seniority'
import { levelStep } from '@/lib/jobs/job-fit-bucket'
import { emailSafeJobs } from '@/lib/jobs/mid-level'

const rung = (title: string) => classifyTitleRung(title).rung

describe('early-career rungs', () => {
  it('matches ncrawl (Python) on the years-refinement parity cases', () => {
    const mismatches = (yearsParity as [string, string, string][])
      .map(([title, text, expected]) => ({ title, expected, got: refineLevelByYears(title, classifyTitleRung(title), text).rung }))
      .filter((m) => m.got !== m.expected)
    expect(mismatches).toEqual([])
  })

  it('places entry-level (0-2 yrs) professional titles on ENTRY_IC', () => {
    for (const t of ['Software Engineer I', 'Associate Software Engineer', 'Junior Financial Analyst', 'Staff Accountant', 'Audit Associate',
      'Investment Banking Analyst', 'Software Engineer, New Grad', 'Finance Rotational Program', 'Associate Product Manager', 'Program Analyst (GS-07)']) {
      expect(rung(t), t).toBe('ENTRY_IC')
    }
  })

  it('places early-career (2-5 yrs) titles on EARLY_IC', () => {
    for (const t of ['Software Engineer II', 'Financial Analyst II', 'Compliance Specialist II', 'Associate, Marketing', 'Program Analyst (GS-09)']) {
      expect(rung(t), t).toBe('EARLY_IC')
    }
  })

  it('keeps internships, students, temporary, hourly and clerical work out', () => {
    for (const t of ['Software Engineering Intern', 'Co-op Engineer', 'Apprentice Electrician', 'Student Assistant', 'Administrative Assistant',
      'Customer Service Representative', 'Graduate Research Assistant', 'Help Desk Analyst I', 'Summer Associate', 'Marketing Coordinator']) {
      expect(classifyTitleRung(t).rank, t).toBe(0)
    }
  })

  it('never moves a senior title down', () => {
    expect(rung('Senior Financial Analyst')).toBe('SENIOR_IC')
    expect(rung('Staff Hardware QA Engineer')).toBe('SENIOR_IC')
    expect(rung('Associate Director')).toBe('SR_MANAGER')
    expect(rung('Systems Engineer Senior I')).toBe('MID_IC')
  })

  it('refines unmarked titles by the years the posting asks for, never above mid-level', () => {
    const mid = classifyTitleRung('Financial Analyst')
    expect(refineLevelByYears('Financial Analyst', mid, '0-2 years of experience in accounting').rung).toBe('ENTRY_IC')
    expect(refineLevelByYears('Financial Analyst', mid, 'Requires 3+ years of experience').rung).toBe('EARLY_IC')
    expect(refineLevelByYears('Financial Analyst', mid, '10+ years of experience').rung).toBe('MID_IC')
    expect(refineLevelByYears('Financial Analyst', mid, null).rung).toBe('MID_IC')
    // A level marker in the title wins over the text.
    expect(refineLevelByYears('Software Engineer II', classifyTitleRung('Software Engineer II'), '0-2 years of experience').rung).toBe('EARLY_IC')
    // Senior titles are never refined.
    expect(refineLevelByYears('Senior Financial Analyst', classifyTitleRung('Senior Financial Analyst'), '1+ years of experience').rung).toBe('SENIOR_IC')
    expect(yearsStage('a 2-year contract')).toBeNull()
  })

  it('imports early-career jobs at the entry floor, refined by the description', () => {
    expect(screenImportedJob('Software Engineer I', 'Remote')).toMatchObject({ keep: true, level: 'ENTRY_IC' })
    expect(screenImportedJob('Data Analyst', 'Austin, TX', { description: 'You have 2-4 years of experience with SQL.' }))
      .toMatchObject({ keep: true, level: 'EARLY_IC' })
    expect(screenImportedJob('Software Engineering Intern', 'Remote').keep).toBe(false)
  })

  it('has Entry level and Early career seniority groups', () => {
    const keys = SENIORITY_GROUPS.map((g) => g.key)
    expect(keys).toContain('ENTRY_LEVEL')
    expect(keys).toContain('EARLY_CAREER')
    expect(seniorityGroupOf('ENTRY_IC')).toBe('ENTRY_LEVEL')
    expect(levelsInGroup('EARLY_CAREER')).toEqual(['EARLY_IC'])
  })
})

describe('member career stage and the ±1 window', () => {
  const window = (m: StageMember) => stagesInWindow(memberStageWindow(m))

  it('computes the stage from level, years, title and level score', () => {
    expect(memberCareerStage({ highestLevelReached: 'IC', yearsExperience: 1 })).toBe('ENTRY')
    expect(memberCareerStage({ highestLevelReached: 'IC', yearsExperience: 3 })).toBe('EARLY')
    expect(memberCareerStage({ highestLevelReached: 'IC', yearsExperience: 6 })).toBe('MID')
    expect(memberCareerStage({ highestLevelReached: 'IC', yearsExperience: 12 })).toBe('SENIOR_IC_MGR')
    expect(memberCareerStage({ highestLevelReached: 'IC', resumeLatestJobTitle: 'Software Engineer II' })).toBe('EARLY')
    expect(memberCareerStage({ highestLevelReached: 'IC' })).toBe('MID')
    expect(memberCareerStage({ highestLevelReached: 'Manager', resumeLatestJobTitle: 'Senior Manager, Finance' })).toBe('SENIOR_MANAGER')
    expect(memberCareerStage({ highestLevelReached: 'Director', yearsExperience: 3 })).toBe('DIRECTOR')
    expect(memberCareerStage({ highestLevelReached: 'C-Suite' })).toBe('EXECUTIVE')
    expect(memberCareerStage({ resumeLatestJobTitle: 'Junior Financial Analyst' })).toBe('ENTRY')
    expect(memberCareerStage({ yearsExperience: 4 })).toBe('EARLY')
    expect(memberCareerStage({ levelRankScore: 72 })).toBe('VP')
    expect(memberCareerStage({})).toBeNull()
  })

  it('shows the member stage, one up and one down', () => {
    expect(window({ highestLevelReached: 'IC', yearsExperience: 0 })).toEqual(['ENTRY', 'EARLY'])
    expect(window({ highestLevelReached: 'IC', yearsExperience: 3 })).toEqual(['ENTRY', 'EARLY', 'MID'])
    expect(window({ highestLevelReached: 'IC', yearsExperience: 6 })).toEqual(['EARLY', 'MID', 'SENIOR_IC_MGR'])
    expect(window({ highestLevelReached: 'Director' })).toEqual(['SENIOR_MANAGER', 'DIRECTOR', 'VP'])
    expect(window({ highestLevelReached: 'C-Suite' })).toEqual(['VP', 'EXECUTIVE'])
  })

  it('lets a member changing careers see one more stage down', () => {
    expect(window({ highestLevelReached: 'Manager', isPivoting: true })).toEqual(['EARLY', 'MID', 'SENIOR_IC_MGR', 'SENIOR_MANAGER'])
    expect(window({ highestLevelReached: 'Director', isPivoting: true })).toEqual(['SENIOR_IC_MGR', 'SENIOR_MANAGER', 'DIRECTOR', 'VP'])
  })

  it('never shows entry or early-career jobs to directors and VPs', () => {
    for (const m of [{ highestLevelReached: 'Director' }, { highestLevelReached: 'VP' }, { highestLevelReached: 'VP', isPivoting: true }, { highestLevelReached: 'C-Suite' }]) {
      const rungs = rungsInWindow(memberStageWindow(m))
      expect(rungs, JSON.stringify(m)).not.toContain('ENTRY_IC')
      expect(rungs, JSON.stringify(m)).not.toContain('EARLY_IC')
      const keep = levelOnlyFilter(boardLevelWindowWhere({}, { window: memberStageWindow(m), includeMidLevel: true, includeEarlyCareer: true }))!
      expect(keep({ level: 'ENTRY_IC' })).toBe(false)
      expect(keep({ level: 'EARLY_IC' })).toBe(false)
    }
  })

  it('never shows director jobs to entry-level members', () => {
    for (const m of [{ highestLevelReached: 'IC', yearsExperience: 1 }, { highestLevelReached: 'IC', yearsExperience: 1, isPivoting: true }]) {
      const keep = levelOnlyFilter(boardLevelWindowWhere({}, { window: memberStageWindow(m), includeMidLevel: true, includeEarlyCareer: true }))!
      expect(keep({ level: 'ENTRY_IC' })).toBe(true)
      for (const level of ['DIRECTOR', 'HEAD', 'VP', 'C_SUITE', 'MANAGER', 'MID_IC']) expect(keep({ level }), level).toBe(false)
      expect(keep({ level: null })).toBe(true) // employer-posted jobs carry no level
    }
  })

  it('keeps members of unknown stage on mid-level and up', () => {
    expect(memberStageWindow({})).toEqual(UNKNOWN_STAGE_WINDOW)
    expect(stagesInWindow(UNKNOWN_STAGE_WINDOW)[0]).toBe('MID')
    expect(CAREER_STAGES).toHaveLength(8)
  })

  it('scores level fit for early-career members against early-career jobs', () => {
    const entry = { highestLevelReached: 'IC', levelRankScore: null, yearsExperience: 1 }
    expect(levelStep(entry, { title: 'Software Engineer I', targetLevel: null, level: 'ENTRY_IC' })).toBe('same')
    expect(levelStep(entry, { title: 'Director of Finance', targetLevel: null, level: 'DIRECTOR' })).toBe('big_up')
    const ic = { highestLevelReached: 'IC', levelRankScore: null }
    expect(levelStep(ic, { title: 'Senior Software Engineer', targetLevel: null, level: 'SENIOR_IC' })).toBe('same')
  })
})

describe('emails leave early-career jobs out unless EARLY_CAREER_IN_EMAILS is on', () => {
  const jobs = [{ id: 'e', level: 'ENTRY_IC' }, { id: 'y', level: 'EARLY_IC' }, { id: 'm', level: 'MANAGER' }, { id: 'n', level: null }]

  it('filters results', () => {
    expect(earlyCareerInEmails({})).toBe(false)
    expect(earlyCareerInEmails({ EARLY_CAREER_IN_EMAILS: '1' })).toBe(false)
    expect(emailSafeJobs(jobs, {}).map((j) => j.id)).toEqual(['m', 'n'])
    expect(emailSafeJobs(jobs, { EARLY_CAREER_IN_EMAILS: 'true' }).map((j) => j.id)).toEqual(['e', 'y', 'm', 'n'])
  })

  it('leaves them out of the query by default', () => {
    const keep = levelOnlyFilter(boardLevelWindowWhere({}))!
    expect(keep({ level: 'ENTRY_IC' })).toBe(false)
    expect(keep({ level: 'EARLY_IC' })).toBe(false)
    expect(keep({ level: 'DIRECTOR' })).toBe(true)
  })

  it('every email job path asks for early-career jobs only behind the flag', () => {
    for (const file of ['src/lib/jobs/fresh-job-alerts.ts', 'src/lib/job-search-daily/build.ts', 'src/lib/coach/weekly-digest.ts']) {
      const src = readFileSync(file, 'utf8')
      expect(src, file).toContain('includeEarlyCareer: earlyCareerInEmails()')
      expect(src, file).toContain('emailSafeJobs(')
    }
  })
})
