import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/prisma', () => ({ prisma: {} }))

import { ALL_TOKENS, orgKindOf, workspacesFor } from '@/lib/higher-ed/workspaces'
import { cityState, isInArea, milesBetween, type LocalArea } from '@/lib/workforce/local'
import { keptShare, splitByPlace, small } from '@/lib/workforce/hub'

describe('workspaces by kind of customer', () => {
  it('a college keeps the alumni workspaces and no Program', () => {
    const ws = workspacesFor(ALL_TOKENS, 'INSTITUTION', {}, 'college')
    expect(ws).toContain('alumni')
    expect(ws).not.toContain('hub')
  })
  it('a workforce customer gets Program, not alumni or development', () => {
    const ws = workspacesFor(ALL_TOKENS, 'INSTITUTION', { wioa: true }, orgKindOf('ECONOMIC_DEVELOPMENT'))
    expect(ws).toEqual(expect.arrayContaining(['candidate', 'hub', 'execed', 'admin', 'workforce']))
    expect(ws).not.toContain('alumni')
    expect(ws).not.toContain('development')
    expect(ws).not.toContain('teaching')
  })
})

describe('stay local', () => {
  const louisville = { lat: 38.2247, lon: -85.7406 }
  it('measures miles', () => {
    expect(milesBetween(louisville, { lat: 38.3324, lon: -85.6961 })).toBeLessThan(10) // Jeffersonville, IN
    expect(milesBetween(louisville, { lat: 39.1031, lon: -84.512 })).toBeGreaterThan(80) // Cincinnati
  })
  it('reads city and state from job locations', () => {
    expect(cityState('Louisville, Kentucky, United States')).toEqual({ city: 'Louisville', state: 'KY' })
    expect(cityState('Jeffersonville, IN')).toEqual({ city: 'Jeffersonville', state: 'IN' })
    expect(cityState('Remote, US')).toBeNull()
  })
  const area: LocalArea = { label: 'the Louisville region', radiusMiles: 40, anchor: louisville, keys: new Set(['KY|louisville', 'IN|jeffersonville']) }
  it('matches places across the state line', () => {
    expect(isInArea(area, 'Jeffersonville', 'IN')).toBe(true)
    expect(isInArea(area, 'Louisville', 'CO')).toBe(false)
  })
  it('counts remote as kept and suppresses small groups', () => {
    const rows = [
      { workCity: 'Louisville', workState: 'KY', workRemote: false },
      { workCity: 'Jeffersonville', workState: 'IN', workRemote: false },
      { workCity: null, workState: null, workRemote: true },
      { workCity: 'Nashville', workState: 'TN', workRemote: false },
      { workCity: 'Louisville', workState: 'KY', workRemote: false },
      { workCity: null, workState: null, workRemote: null },
    ]
    const s = splitByPlace(rows, area)
    expect(s).toEqual({ total: 6, local: 3, remote: 1, elsewhere: 1, unknown: 1 })
    expect(keptShare(s)).toBeCloseTo(0.8)
    expect(keptShare({ total: 3, local: 2, remote: 0, elsewhere: 1, unknown: 0 })).toBeNull()
    expect(small(3)).toBe('<5')
    expect(small(0)).toBe('0')
    expect(small(12)).toBe('12')
  })
})
