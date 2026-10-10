import { describe, it, expect } from 'vitest'
import { jobSkillGap, memberHasSkill, aggregateSkillGaps, type JobSkillGap } from '@/lib/jobs/job-skill-gap'

describe('memberHasSkill', () => {
  it('matches whole words, never loose substrings', () => {
    expect(memberHasSkill('sql', ['SQL', 'excel'])).toBe(true)
    expect(memberHasSkill('financial modeling', ['financial modeling & forecasting'])).toBe(true)
    expect(memberHasSkill('sql', ['mysql'])).toBe(false)
    expect(memberHasSkill('ad', ['advertising'])).toBe(false)
    expect(memberHasSkill('sap', ['a'])).toBe(false)
  })
})

describe('jobSkillGap', () => {
  const memberKeywords = ['python', 'sql', 'stakeholder management']

  it('reads the job\'s own description when it has one', () => {
    const g = jobSkillGap({
      title: 'Data Engineering Manager',
      description: 'You will lead a team using Python, SQL, Snowflake and Airflow to build every data pipeline.',
      memberKeywords,
    })
    expect(g.basis).toBe('posting')
    expect(g.have).toEqual(expect.arrayContaining(['python', 'sql']))
    expect(g.missing).toEqual(expect.arrayContaining(['snowflake', 'airflow']))
    expect(g.coveragePct).toBeGreaterThan(0)
    expect(g.coveragePct).toBeLessThan(100)
  })

  it('claims nothing for a job with no description — it never borrows the employer\'s skills', () => {
    const g = jobSkillGap({ title: 'Director of Sales', description: null, memberKeywords })
    expect(g).toMatchObject({ basis: 'none', requested: [], missing: [], coveragePct: null })
  })

  it('claims nothing when there is nothing to compare', () => {
    const g = jobSkillGap({ title: 'Manager', description: 'Lead the team and manage the budget.', memberKeywords })
    expect(g).toMatchObject({ basis: 'none', requested: [], missing: [], coveragePct: null })
  })
})

describe('aggregateSkillGaps', () => {
  const gap = (missing: string[], have: string[] = []): JobSkillGap => ({
    basis: 'posting', requested: [...missing, ...have], have, missing, coveragePct: 50,
  })

  it('counts each employer once per skill, so a chain cannot dominate', () => {
    const jobs = [
      ...Array.from({ length: 20 }, () => ({ companyKey: 'ulta', gap: gap(['excel']) })),
      { companyKey: 'acme', gap: gap(['sox']) },
      { companyKey: 'globex', gap: gap(['sox']) },
    ]
    const a = aggregateSkillGaps(jobs)
    expect(a.missing[0]).toEqual({ term: 'sox', jobs: 2 })
    expect(a.missing.find((m) => m.term === 'excel')?.jobs).toBe(1)
    expect(a.jobsWithSkillData).toBe(3)
  })

  it('ignores jobs with no skill data', () => {
    const none: JobSkillGap = { basis: 'none', requested: [], have: [], missing: [], coveragePct: null }
    const a = aggregateSkillGaps([{ companyKey: 'x', gap: none }])
    expect(a.jobsWithSkillData).toBe(0)
    expect(a.missing).toEqual([])
  })
})
