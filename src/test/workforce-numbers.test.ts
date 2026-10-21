import { describe, expect, it } from 'vitest'
import { buildWorkforceTiles, floorCount, type WorkforceRaw } from '@/lib/marketing/workforce-numbers-format'

const RAW: WorkforceRaw = {
  jobs: {
    live: 526_992,
    checked24h: 178_818,
    aiSkill: 40_538,
    government: 13_871,
    nonprofit: 18_323,
    academia: 15_334,
    flagged: 52_124,
    clearance: 15_042,
    employers: 61_761,
    occupations: 723,
    industries: 17,
    functions: 21,
    states: 51,
    places: 12_732,
  },
  taxonomy: {
    skills: 4_675,
    occupationsMapped: 920,
    similarityPairs: 30_067,
    courses: 93,
    aiCourses: 40,
    certifications: 24,
    jobCenters: 2_113,
    jobCenterStates: 51,
  },
  aiPremiumPct: 19.5,
  pivots: { pivotPaths: 258, pivotRoles: 91 },
  journeys: 11,
}

const keys = (raw: WorkforceRaw) => buildWorkforceTiles(raw).flatMap((g) => g.tiles.map((t) => t.key))
const tile = (raw: WorkforceRaw, key: string) => buildWorkforceTiles(raw).flatMap((g) => g.tiles).find((t) => t.key === key)

describe('floorCount', () => {
  it('never shows more than the real count', () => {
    expect(floorCount(93)).toBe('93')
    expect(floorCount(258)).toBe('250+')
    expect(floorCount(250)).toBe('250')
    expect(floorCount(40_538)).toBe('40,500+')
    expect(floorCount(526_992)).toBe('526,000+')
    expect(floorCount(4_675)).toBe('4,600+')
  })
})

describe('buildWorkforceTiles', () => {
  it('shows every tile when everything loads', () => {
    expect(keys(RAW)).toHaveLength(16)
    expect(tile(RAW, 'live_jobs')?.value).toBe('526,000+')
    expect(tile(RAW, 'ai_pay_premium')?.value).toBe('19%')
    expect(tile(RAW, 'states')?.value).toBe('50 + DC')
    expect(tile(RAW, 'public_mission')?.value).toBe('47,500+')
  })

  it('hides tiles whose numbers failed to load, instead of showing 0', () => {
    const out = keys({ ...RAW, jobs: null, aiPremiumPct: null })
    expect(out).not.toContain('live_jobs')
    expect(out).not.toContain('ai_skill_jobs')
    expect(out).not.toContain('ai_pay_premium')
    expect(out).toContain('skills')
    expect(out).toContain('pivot_paths')
    expect(buildWorkforceTiles({ jobs: null, taxonomy: null, aiPremiumPct: null, pivots: null, journeys: null })).toEqual([])
  })

  it('drops a zero count', () => {
    expect(keys({ ...RAW, jobs: { ...RAW.jobs!, checked24h: 0 } })).not.toContain('checked_24h')
  })
})
