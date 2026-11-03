import { describe, expect, it } from 'vitest'
import { applyClaim, claimOf, removeClaim, type ClaimState } from '@/lib/skills/claim'
import { skillsForPosting } from '@/lib/skills/for-job'
import type { SkillMarket, SkillRow } from '@/lib/skills/market'

const empty: ClaimState = { have: [], build: [], levels: {} }
const row = (slug: string, name: string, n: number): SkillRow => ({ slug, name, n, fresh: 0, exposure: null, exposureN: 0, aiPair: 0, by: { industry: {}, function: {}, state: {}, level: {} } })
const market = (skills: SkillRow[]): SkillMarket => ({ asOf: '2026-11-03', live: 100, withSkills: 80, fresh: 10, totals: { industry: {}, function: {}, state: {}, level: {} }, labels: { industry: {}, function: {}, state: {}, level: {} }, skills })

describe('claiming a skill', () => {
  it('"I have this" adds it once, whatever the case', () => {
    const a = applyClaim(empty, 'Python', 'have')
    expect(a.have).toEqual(['Python'])
    expect(applyClaim(a, 'python', 'have').have).toEqual(['Python'])
  })
  it('"I have this" takes it off the build list', () => {
    const s = applyClaim({ ...empty, build: ['Python', 'SQL'] }, 'python', 'have')
    expect(s.build).toEqual(['SQL'])
  })
  it('"I have this" restores a skill the member had removed', () => {
    const s = applyClaim({ ...empty, levels: { python: { removed: true } } }, 'Python', 'have')
    expect(s.levels.python).toBeUndefined()
    expect(s.have).toEqual(['Python'])
  })
  it('"I want to build this" adds it to the build list, once', () => {
    const a = applyClaim(empty, 'SQL', 'build')
    expect(a.build).toEqual(['SQL'])
    expect(applyClaim(a, 'sql', 'build').build).toEqual(['SQL'])
  })
  it('"I want to build this" does nothing for a skill they have', () => {
    const s = applyClaim({ ...empty, have: ['SQL'] }, 'sql', 'build')
    expect(s.build).toEqual([])
  })
  it('takes a claim back from its own list only', () => {
    const s = removeClaim({ have: ['SQL'], build: ['Python'], levels: {} }, 'sql', 'have')
    expect(s).toEqual({ have: [], build: ['Python'], levels: {} })
  })
  it('reports what the member said, "have" first', () => {
    expect(claimOf({ have: ['SQL'], build: ['SQL'] }, 'sql')).toBe('have')
    expect(claimOf({ have: [], build: ['SQL'] }, 'SQL')).toBe('build')
    expect(claimOf({ have: [], build: [] }, 'SQL')).toBeNull()
  })
})

describe('skills for a job listing', () => {
  const m = market([row('python', 'Python', 900), row('sql', 'SQL', 1200), row('excel', 'Excel', 700)])
  it('keeps only skills on the market, the most asked for first', () => {
    expect(skillsForPosting(['python', 'rare thing', 'sql', 'excel'], m)).toEqual([
      { slug: 'sql', name: 'SQL' }, { slug: 'python', name: 'Python' }, { slug: 'excel', name: 'Excel' },
    ])
  })
  it('lists a skill once and respects the limit', () => {
    expect(skillsForPosting(['sql', 'SQL', 'python'], m, 1)).toEqual([{ slug: 'sql', name: 'SQL' }])
  })
  it('returns nothing without a market or terms', () => {
    expect(skillsForPosting(['sql'], null)).toEqual([])
    expect(skillsForPosting([], m)).toEqual([])
  })
})
