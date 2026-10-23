import { describe, expect, it } from 'vitest'
import { PORTAL_TYPES, PORTAL_TYPE_ORDER, portalTypeLabel } from '@/lib/partners/portal-types'
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
  it('uses sentence case and never says who pays', () => {
    for (const t of PORTAL_TYPE_ORDER) expect(PORTAL_TYPES[t].label).not.toMatch(/b2b|paying|free/i)
  })
})
