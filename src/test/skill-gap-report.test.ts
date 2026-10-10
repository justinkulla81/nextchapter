import { describe, it, expect } from 'vitest'
import { addSkillGapActionItem, mergeSkillGapIntoGapAnalysis, skillGapPromptSection, significantMissing } from '@/lib/jobs/skill-gap-report'
import type { AggregatedSkillGap } from '@/lib/jobs/job-skill-gap'

const agg: AggregatedSkillGap = {
  jobsConsidered: 30,
  jobsWithSkillData: 12,
  missing: [
    { term: 'snowflake', jobs: 7 },
    { term: 'sox', jobs: 4 },
    { term: 'airflow', jobs: 2 },
    { term: 'dbt', jobs: 1 },
  ],
  have: [{ term: 'python', jobs: 9 }],
}

describe('significantMissing', () => {
  it('keeps only skills several employers ask for, capped at three', () => {
    expect(significantMissing(agg).map((m) => m.term)).toEqual(['snowflake', 'sox', 'airflow'])
    expect(significantMissing({ ...agg, missing: [{ term: 'dbt', jobs: 1 }] })).toEqual([])
  })
})

describe('skillGapPromptSection', () => {
  it('states the computed facts and forbids inventing others', () => {
    const t = skillGapPromptSection(agg)
    expect(t).toContain('snowflake (7 of 12 employers)')
    expect(t).toMatch(/do not invent other skill gaps/)
  })
  it('says plainly when there is nothing to base a claim on', () => {
    expect(skillGapPromptSection(null)).toMatch(/not available/)
    expect(skillGapPromptSection({ ...agg, jobsWithSkillData: 0 })).toMatch(/not available/)
  })
})

describe('mergeSkillGapIntoGapAnalysis', () => {
  const base = { targetRole: 'Director of Data', gaps: [{ area: 'Executive presence', why: 'x', remediation: 'y', remediationType: 'other' as const }] }

  it('puts the computed skill gaps first, with real counts', () => {
    const out = mergeSkillGapIntoGapAnalysis(base, agg)
    expect(out.gaps.length).toBe(4)
    expect(out.gaps[0].area).toBe('Skill: Snowflake')
    expect(out.gaps[0].why).toContain('7 of the 12 employers')
    expect(out.gaps[0].remediationType).toBe('upskilling')
    expect(out.gaps.at(-1)!.area).toBe('Executive presence')
  })

  it('does not repeat a skill the report already names', () => {
    const withSox = { ...base, gaps: [{ area: 'SOX compliance experience', why: 'regulated roles', remediation: 'r', remediationType: 'upskilling' as const }] }
    const out = mergeSkillGapIntoGapAnalysis(withSox, agg)
    expect(out.gaps.filter((g) => /sox/i.test(g.area)).length).toBe(1)
  })

  it('leaves the analysis untouched with no data', () => {
    expect(mergeSkillGapIntoGapAnalysis(base, null)).toBe(base)
  })
})

describe('addSkillGapActionItem', () => {
  const plan = [
    { day: 1, items: [{ text: 'Update LinkedIn' }] },
    { day: 2, items: [{ text: 'Send 3 messages' }] },
    { day: 3, items: [] },
  ]
  it('adds one concrete item on day 2, naming the skills', () => {
    const out = addSkillGapActionItem(plan, agg)
    expect(out[1].items.length).toBe(2)
    expect(out[1].items[1].text).toMatch(/Snowflake, Sox and Airflow/i)
    expect((out[1].items[1] as { actionType?: string }).actionType).toBe('RESUME_UPDATE')
    expect(out[0].items.length).toBe(1)
  })
  it('does nothing without a significant gap', () => {
    expect(addSkillGapActionItem(plan, { ...agg, missing: [] })).toBe(plan)
  })
})
