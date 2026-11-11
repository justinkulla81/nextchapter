import { describe, expect, it } from 'vitest'
import { classifyWorkforceStaff as c, isWorkforceSystemOrg } from '../lib/crm/workforce-staff'

describe('classifyWorkforceStaff', () => {
  it('reads role and level from the title', () => {
    expect(c('Executive Director')).toEqual({ role: 'leadership', level: 'senior' })
    expect(c('Rapid Response Coordinator')).toEqual({ role: 'rapid_response', level: 'mid' })
    expect(c('Director of Rapid Response')).toEqual({ role: 'rapid_response', level: 'senior' })
    expect(c('Business Services Manager')).toEqual({ role: 'business_services', level: 'mid' })
    expect(c('Senior Program Manager')).toEqual({ role: 'program', level: 'senior' })
    expect(c('Assistant Director, Operations')).toEqual({ role: 'operations', level: 'senior' })
    expect(c('Associate Director of Economic Development').level).toBe('senior')
    expect(c('Administrative Assistant')).toEqual({ role: 'operations', level: 'junior' })
  })
  it('keeps volunteer board members off the staff list', () => {
    expect(c('Board Chair').role).toBe('board_member')
    expect(c('Chairman').role).toBe('board_member')
    expect(c('Board Member, Business Representative').role).toBe('board_member')
  })
  it('handles a missing title', () => {
    expect(c(null)).toEqual({ role: 'other', level: 'unknown' })
  })
})

describe('isWorkforceSystemOrg', () => {
  it('matches boards, job centers and state agencies, not colleges or staffing firms', () => {
    expect(isWorkforceSystemOrg('Ocean County Workforce Development Board')).toBe(true)
    expect(isWorkforceSystemOrg('Texas Workforce Commission')).toBe(true)
    expect(isWorkforceSystemOrg('American Job Center of Fresno')).toBe(true)
    expect(isWorkforceSystemOrg('Salt Lake Community College Workforce Institute')).toBe(false)
    expect(isWorkforceSystemOrg('Acme Workforce Staffing')).toBe(false)
    expect(isWorkforceSystemOrg('Region 5 Workforce Board, Inc.')).toBe(true)
  })
})
