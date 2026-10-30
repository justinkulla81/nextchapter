import { describe, expect, it } from 'vitest'
import { extractTerms, jobMatchInputError, matchResumeToJob, stem, tokenize } from '@/lib/tools/resume-job-match'

const JOB = `Senior Financial Analyst
About us
We are a growing company with a great culture and excellent benefits for all employees.
Responsibilities
Build the annual budget and quarterly forecasting models in Excel and SQL.
Partner with finance leaders on variance analysis and financial reporting.
Requirements
5+ years of financial analysis experience.
Advanced Excel and SQL; Tableau dashboards for financial reporting.
Strong forecasting and budgeting skills, CPA preferred.
Benefits
Health insurance and a 401k match.`

const MATCHING = `Jane Doe, Financial Analyst. I built annual budgets and ran quarterly forecasting models in Excel and SQL for a 400-person company. I produced financial reporting packages, variance analysis for finance leaders, and Tableau dashboards that cut month-end close by two days. CPA. Managed budgeting for three business units and led forecasting reviews with the CFO. Over five years of financial analysis experience across SaaS and retail. Delivered a 12 percent cost saving through vendor consolidation and presented results to the board each quarter.`

const WEAK = `Marcus Lee, Retail Associate. Helped customers find products, stocked shelves, operated the cash register, trained new hires on store procedures and handled returns. Opened and closed the store, balanced the till at end of shift, and kept the sales floor clean and organized. Received a customer service award in 2024 for resolving a difficult complaint calmly. Comfortable working weekends and holidays and learning new systems quickly. Reliable and friendly with a strong record of attendance.`

describe('job match', () => {
  it('tokenizes skill names whole', () => {
    expect(tokenize('Experience with C++, C#, Node.js and CI/CD.')).toEqual(expect.arrayContaining(['c++', 'c#', 'node.js', 'ci/cd']))
  })

  it('stems plurals and verb endings to one form', () => {
    expect(stem('managing')).toBe(stem('manages'))
    expect(stem('budgets')).toBe(stem('budget'))
    expect(stem('c++')).toBe('c++')
  })

  it('pulls the posting\'s skills and requirements, not its boilerplate', () => {
    const terms = extractTerms(JOB).map((t) => t.term)
    expect(terms).toEqual(expect.arrayContaining(['excel', 'sql', 'forecasting']))
    expect(terms).not.toContain('benefits')
    expect(terms).not.toContain('company')
    const excel = extractTerms(JOB).find((t) => t.term === 'excel')
    expect(excel?.skill).toBe(true)
    expect(excel?.required).toBe(true)
  })

  it('scores a matching résumé far above an unrelated one', () => {
    const good = matchResumeToJob(MATCHING, JOB)
    const weak = matchResumeToJob(WEAK, JOB)
    expect(good.score).toBeGreaterThanOrEqual(75)
    expect(weak.score).toBeLessThanOrEqual(25)
    expect(good.score).toBeGreaterThan(weak.score + 40)
    expect(weak.missing.map((t) => t.term)).toEqual(expect.arrayContaining(['excel', 'sql']))
    expect(weak.tips.join(' ')).toContain('"excel"')
  })

  it('is deterministic', () => {
    expect(matchResumeToJob(MATCHING, JOB)).toEqual(matchResumeToJob(MATCHING, JOB))
  })

  it('reads the first line as the title and checks the résumé for it', () => {
    const r = matchResumeToJob(WEAK, JOB)
    expect(r.titleLine).toBe('Senior Financial Analyst')
    expect(r.titleInResume).toBe(false)
  })

  it('rejects texts that are too short or too long', () => {
    expect(jobMatchInputError('short', JOB)).toMatch(/résumé/)
    expect(jobMatchInputError(MATCHING, 'too short')).toMatch(/job posting/)
    expect(jobMatchInputError(MATCHING, JOB)).toBeNull()
    expect(jobMatchInputError('x'.repeat(30_001), JOB)).toMatch(/up to 30,000/)
  })

  it('handles empty extraction without dividing by zero', () => {
    const r = matchResumeToJob(MATCHING, 'the and of to a in is it')
    expect(r.score).toBe(0)
    expect(r.compared).toBe(0)
  })
})
