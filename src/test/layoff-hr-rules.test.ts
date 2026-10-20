import { describe, expect, it } from 'vitest'
import { hrTeamKind, isUsWideTitle } from '@/lib/warn/layoff-hr-rules'

describe('layoff HR rules', () => {
  it('skips country and regional titles', () => {
    expect(isUsWideTitle('HR Director, EMEA')).toBe(false)
    expect(isUsWideTitle('Vice President, Human Resources')).toBe(true)
  })
  it('classifies the HR people who buy or run a transition', () => {
    expect(hrTeamKind('Director of Total Rewards')).toBe('total_rewards')
    expect(hrTeamKind('Employee Relations Manager')).toBe('employee_relations')
    expect(hrTeamKind('Head of Talent Acquisition')).toBe('talent_acquisition')
    expect(hrTeamKind('Payroll Manager')).toBeNull()
    expect(hrTeamKind('Chief Financial Officer')).toBeNull()
  })
})
