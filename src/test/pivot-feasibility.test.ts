import { describe, expect, it } from 'vitest'
import { assessPivot, isSearchable, pivotTier } from '@/lib/journey/feasibility'
import { PRIMARY_FUNCTION_OPTIONS } from '@/lib/constants/onboarding'
import { buildTarget, isCommitted, pivotOf, pivotPlanItems, primaryPivot, searchableTargets } from '@/lib/journey/pivot'

const now = new Date('2026-10-16T12:00:00Z')

describe('can a controller become a designer?', () => {
  it('not by changing employers: finance to design is a rebuild that needs a commitment and a step down', () => {
    const a = assessPivot('Finance', 'Design')
    expect(a.tier).toBe('REBUILD')
    expect(a.needsCommitment).toBe(true)
    expect(a.stepDown).toBe(true)
    expect(a.education?.FORMAL.length).toBeGreaterThan(0)
    expect(a.education?.INFORMAL.length).toBeGreaterThan(0)
  })
  it('finance to operations or analytics is a natural or bridged move', () => {
    expect(pivotTier('Finance', 'Operations')).toBe('ADJACENT')
    expect(pivotTier('Finance', 'Data & Analytics')).toBe('ADJACENT')
    expect(pivotTier('Finance', 'Product')).toBe('BRIDGE')
  })
  it('law needs a license, executive is a level', () => {
    expect(pivotTier('Finance', 'Legal')).toBe('LICENSED')
    expect(pivotTier('Finance', 'Executive Leadership')).toBe('LEVEL_GATED')
  })
  it('every pair has an answer and same is same', () => {
    for (const a of PRIMARY_FUNCTION_OPTIONS) for (const b of PRIMARY_FUNCTION_OPTIONS) expect(pivotTier(a, b)).toBeTruthy()
    expect(pivotTier('Sales', 'Sales')).toBe('SAME')
  })
  it('seniority adds a step down to a bridged move', () => {
    expect(assessPivot('Finance', 'Product', { seniorLevel: true }).stepDown).toBe(true)
    expect(assessPivot('Finance', 'Product').stepDown).toBe(false)
  })
})

describe('commitment decides what we search for', () => {
  it('a natural move is searchable at once; a rebuild only once committed', () => {
    expect(isSearchable('ADJACENT', false)).toBe(true)
    expect(isSearchable('REBUILD', false)).toBe(false)
    expect(isSearchable('REBUILD', true)).toBe(true)
    expect(isSearchable('LEVEL_GATED', true)).toBe(false)
  })
  it('a commitment needs a route, hours, and the member saying yes', () => {
    expect(isCommitted(buildTarget('Finance', 'Design', { route: 'FORMAL', hoursPerWeek: 5, commit: true }, now))).toBe(true)
    expect(isCommitted(buildTarget('Finance', 'Design', { route: 'FORMAL', hoursPerWeek: 5, commit: false }, now))).toBe(false)
    expect(isCommitted(buildTarget('Finance', 'Design', { route: 'FORMAL', commit: true }, now))).toBe(false)
    expect(isCommitted(buildTarget('Finance', 'Design', { route: 'WHATEVER', hoursPerWeek: 5, commit: true }, now))).toBe(false)
    expect(isCommitted(buildTarget('Finance', 'Design', { route: 'FORMAL', hoursPerWeek: 99, commit: true }, now))).toBe(false)
  })
  it('is remembered in journeyDetails and drives the target and the plan', () => {
    const t = buildTarget('Finance', 'Design', { route: 'INFORMAL', hoursPerWeek: 5, commit: true }, now)
    const open = buildTarget('Finance', 'Operations', {}, now)
    const maybe = buildTarget('Finance', 'Engineering', { route: 'FORMAL' }, now)
    const details = { pivot: { targets: [open, t, maybe], updatedAt: now.toISOString() }, other: 1 }
    const p = pivotOf(details)!
    expect(searchableTargets(p).map((x) => x.function)).toEqual(['Operations', 'Design'])
    expect(primaryPivot(p)?.function).toBe('Design')
    // Find a week where the monthly nudge is on, and one where it is off.
    const week = 7 * 86_400_000
    let on = now
    while (Math.floor(on.getTime() / week) % 4 !== 0) on = new Date(on.getTime() + week)
    const off = new Date(on.getTime() + week)
    const text = pivotPlanItems(p, off).map((i) => i.text).join(' | ')
    // A committed change and a natural move are carried by their learning paths, not by the pivot nudges.
    expect(text).not.toMatch(/Design|Operations/)
    // A change they have not committed to is not planned for, only questioned, and only now and then.
    expect(text).not.toMatch(/Engineering plan/)
    expect(pivotPlanItems(p, on).map((i) => i.text).join('|')).toMatch(/open to Engineering/)
    expect(pivotPlanItems(p, off).map((i) => i.text).join('|')).not.toMatch(/open to Engineering/)
  })
  it('reads nothing from a profile with no pivot', () => {
    expect(pivotOf(null)).toBeNull()
    expect(pivotOf({})).toBeNull()
    expect(pivotPlanItems(null)).toEqual([])
  })
})
