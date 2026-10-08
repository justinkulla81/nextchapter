import { describe, expect, it } from 'vitest'
import { classifyTitleRung, screenJobTitle, seniorityGroupOf } from '@/lib/jobs/job-seniority'
import parity from './fixtures/job-seniority-parity.json'

describe('job seniority', () => {
  it('matches ncrawl (Python) on every parity title', () => {
    const mismatches = (parity as [string, string, number][])
      .map(([title, rung, rank]) => ({ title, expected: `${rung} ${rank}`, got: classifyTitleRung(title) }))
      .filter((m) => `${m.got.rung} ${m.got.rank}` !== m.expected)
    expect(mismatches).toEqual([])
  })

  it('keeps manager-and-up and senior individual roles', () => {
    for (const title of ['Senior Software Engineer', 'Product Manager', 'Director of Finance', 'Senior Financial Analyst', 'Assistant Vice President, Credit Risk']) {
      expect(screenJobTitle(title).keep, title).toBe(true)
    }
  })

  it('screens out entry-level and frontline work', () => {
    for (const title of ['Software Engineer II', 'Store Manager', 'Truck Driver', 'Marketing Coordinator', 'Cashier', 'Software Engineer, Intern']) {
      expect(screenJobTitle(title).keep, title).toBe(false)
    }
  })

  it('groups rungs for display', () => {
    expect(seniorityGroupOf('C_SUITE')).toBe('EXECUTIVE')
    expect(seniorityGroupOf('HEAD')).toBe('VP')
    expect(seniorityGroupOf('SENIOR_IC')).toBe('SENIOR_IC')
    expect(seniorityGroupOf('OTHER')).toBeNull()
    expect(seniorityGroupOf(null)).toBeNull()
  })
})
