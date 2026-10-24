import { describe, expect, it } from 'vitest'
import { PORTAL_TYPES, PORTAL_TYPE_ORDER, employerUseForPath, portalTypeLabel } from '@/lib/partners/portal-types'
import { contrastRatio } from '@/lib/partners/brand'

describe('portal types', () => {
  it('white text passes WCAG AA on every portal color', () => {
    for (const t of PORTAL_TYPE_ORDER) expect(contrastRatio(PORTAL_TYPES[t].chrome, '#ffffff'), t).toBeGreaterThanOrEqual(4.5)
  })
  it('gives every portal its own color', () => {
    const colors = PORTAL_TYPE_ORDER.map((t) => PORTAL_TYPES[t].chrome)
    expect(new Set(colors).size).toBe(colors.length)
  })
  it('labels a portal with its use when it has one', () => {
    expect(portalTypeLabel('employer', 'Outplacement')).toBe('Employer · Outplacement')
    expect(portalTypeLabel('employer')).toBe('Employer')
    expect(portalTypeLabel('recruiter', 'Anything')).toBe('Recruiter')
  })
  it('declares the five separately claimable employer parts', () => {
    expect(PORTAL_TYPES.employer.uses).toEqual(['Outplacement', 'Retention', 'Learning and development', 'Job retraining', 'Hiring'])
    expect(portalTypeLabel('employer', 'Learning and development')).toBe('Employer · Employees · Learning and development')
    expect(portalTypeLabel('employer', 'Job retraining')).toBe('Employer · Employees · Job retraining')
    expect(portalTypeLabel('employer', 'Retention')).toBe('Employer · Employees · Retention')
    expect(portalTypeLabel('employer', 'Hiring')).toBe('Employer · Hiring')
    expect(portalTypeLabel('employer', 'Made up')).toBe('Employer')
  })
  it('picks the employer part from the route', () => {
    expect(employerUseForPath('/employer/growth')).toBe('Retention')
    expect(employerUseForPath('/employer/growth/roles/abc')).toBe('Retention')
    expect(employerUseForPath('/employer/learning')).toBe('Learning and development')
    expect(employerUseForPath('/employer')).toBe('Outplacement')
    expect(employerUseForPath('/employer/roster')).toBe('Outplacement')
    expect(employerUseForPath('/employer/growthy')).toBe('Outplacement')
    expect(employerUseForPath(null)).toBe('Outplacement')
  })
  it('uses sentence case and never says who pays', () => {
    for (const t of PORTAL_TYPE_ORDER) expect(PORTAL_TYPES[t].label).not.toMatch(/b2b|paying|free/i)
  })
})
