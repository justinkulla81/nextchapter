import { describe, expect, it } from 'vitest'
import { adjacentSubFunctions, hasSubFunctions, SUB_FUNCTIONS, subFunctionFor } from '@/lib/jobs/sub-functions'

describe('sub-functions (allowlists only)', () => {
  const cases: [string, string, string | null][] = [
    ['Director, Supply Chain', 'Operations', 'ops_supply_chain'],
    ['Senior Purchasing Manager', 'Operations', 'ops_supply_chain'],
    ['Facilities & Maintenance Manager', 'Operations', 'ops_facilities'],
    ['Revenue Operations Manager', 'Operations', 'ops_revenue'],
    ['Plant Manager', 'Operations', 'ops_manufacturing'],
    ['Contact Center Operations Manager', 'Operations', 'ops_customer'],
    ['Director of Operations', 'Operations', 'ops_business'],
    ['Senior Program Manager', 'Operations', 'ops_projects'],
    ['Senior Site Reliability Engineer', 'Engineering', 'eng_infrastructure'],
    ['Staff Software Engineer', 'Engineering', 'eng_software'],
    ['Mechanical Test Engineer II', 'Engineering', 'eng_hardware'],
    ['QA Engineer', 'Engineering', 'eng_qa'],
    ['Director - Global FP&A', 'Finance', 'fin_fpa'],
    ['Accounting Manager', 'Finance', 'fin_accounting'],
    ['Vice President, Finance', 'Finance', 'fin_leadership'],
    ['Senior Recruiter', 'Human Resources', 'hr_talent_acquisition'],
    ['Senior HR Business Partner', 'Human Resources', 'hr_partner'],
    ['Compensation Analyst', 'people', 'hr_comp_benefits'],
    ['Business Development Representative', 'Sales', 'sales_development'],
    ['Account Executive, Mid-Market', 'Sales', 'sales_new_business'],
    ['Regional Sales Director', 'Sales', 'sales_leadership'],
  ]
  for (const [title, fn, want] of cases) {
    it(`${title} (${fn}) → ${want}`, () => expect(subFunctionFor({ title, fn })).toBe(want))
  }

  it('nothing on the lists → null, never the nearest bucket', () => {
    expect(subFunctionFor({ title: 'Operations Associate II', fn: 'Operations' })).toBeNull()
    expect(subFunctionFor({ title: 'Engineer', fn: 'Engineering' })).toBeNull()
  })

  it('only within the job\'s own function', () => {
    expect(subFunctionFor({ title: 'Supply Chain Analyst', fn: 'Marketing' })).toBeNull()
    expect(subFunctionFor({ title: 'Supply Chain Analyst', fn: null })).toBeNull()
    expect(hasSubFunctions('Operations')).toBe(true)
    expect(hasSubFunctions('Legal')).toBe(false)
  })

  it('an allowlisted O*NET code places a title the patterns miss', () => {
    expect(subFunctionFor({ title: 'Team Lead', fn: 'Operations', soc: '11-3013.00' })).toBe('ops_facilities')
    // A code from another function's list doesn't.
    expect(subFunctionFor({ title: 'Team Lead', fn: 'Finance', soc: '11-3013.00' })).toBeNull()
  })

  it('adjacency is hand-listed, same function only, and symmetric', () => {
    expect(adjacentSubFunctions('ops_supply_chain', 'ops_facilities')).toBe(true)
    expect(adjacentSubFunctions('ops_facilities', 'ops_supply_chain')).toBe(true)
    expect(adjacentSubFunctions('ops_supply_chain', 'ops_revenue')).toBe(false)
    expect(adjacentSubFunctions('ops_supply_chain', 'fin_fpa')).toBe(false)
  })

  it('every adjacency points at a sub-function of the same function', () => {
    const byKey = new Map(SUB_FUNCTIONS.map((s) => [s.key, s]))
    for (const s of SUB_FUNCTIONS) for (const a of s.adjacent) expect(byKey.get(a)?.fn).toBe(s.fn)
    expect(new Set(SUB_FUNCTIONS.map((s) => s.key)).size).toBe(SUB_FUNCTIONS.length)
  })
})
