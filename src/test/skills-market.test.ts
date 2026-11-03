import { describe, expect, it } from 'vitest'
import {
  aiComplementSkills, dimensionValues, hotSkills, placesForSkill, skillGap, skillLabel, skillsByExposure, skillsIn, topSkills,
  type SkillMarket, type SkillRow,
} from '@/lib/skills/market'

const row = (name: string, n: number, over: Partial<SkillRow> = {}): SkillRow => ({
  slug: name.toLowerCase().replace(/\s+/g, '-'), name, n, fresh: 0, exposure: null, exposureN: 0, aiPair: 0,
  by: { industry: {}, function: {}, state: {}, level: {} }, ...over,
})

const market = (skills: SkillRow[]): SkillMarket => ({
  asOf: '2026-11-03T00:00:00Z', live: 20000, withSkills: 10000, fresh: 2000,
  totals: { industry: { tech: 4000, health: 1000 }, function: {}, state: {}, level: { entry: 500, mid: 800, vp: 200 } },
  labels: { industry: { tech: 'Technology', health: 'Healthcare' }, function: {}, state: {}, level: { entry: 'Entry level', mid: 'Mid level', vp: 'VP and executive' } },
  skills,
})

describe('skillLabel', () => {
  it('upper-cases acronyms and keeps product spellings', () => {
    expect(skillLabel('sql')).toBe('SQL')
    expect(skillLabel('powerpoint')).toBe('PowerPoint')
    expect(skillLabel('project management')).toBe('Project management')
  })
})

describe('lists', () => {
  const skills = [
    row('Excel', 5000, { fresh: 500, exposure: 0.41, exposureN: 900, aiPair: 250, by: { industry: { tech: 1200, health: 20 }, function: {}, state: {}, level: { entry: 200, mid: 300 } } }),
    row('Python', 3000, { fresh: 900, exposure: 0.2, exposureN: 900, aiPair: 900, by: { industry: { tech: 2000, health: 10 }, function: {}, state: {}, level: {} } }),
    row('Welding', 1500, { fresh: 100, exposure: 0.01, exposureN: 400 }),
    row('Tiny', 100),
  ]
  const m = market(skills)

  it('ranks the most-asked skills and drops ones below the minimum', () => {
    expect(topSkills(m).map((s) => s.name)).toEqual(['Excel', 'Python', 'Welding'])
    expect(topSkills(m)[0].share).toBeCloseTo(50)
  })

  it('ranks inside one industry by count, with share of that industry', () => {
    const r = skillsIn(m, 'industry', 'tech')
    expect(r.map((s) => s.name)).toEqual(['Python', 'Excel'])
    expect(r[0].share).toBeCloseTo(50)
  })

  it('leaves out cells below the minimum posting count', () => {
    expect(skillsIn(m, 'industry', 'health')).toEqual([])
  })

  it('lists a skill\'s places, levels in seniority order', () => {
    expect(placesForSkill(m, skills[0], 'industry').map((p) => p.key)).toEqual(['tech'])
    expect(placesForSkill(m, skills[0], 'level').map((p) => p.key)).toEqual(['entry', 'mid'])
  })

  it('finds rising skills as fresh share over overall share, above 1 only', () => {
    // Python: 900/2000 = 45% fresh vs 30% overall → 1.5. Excel: 25% vs 50% → below 1. Welding: fresh < 100 floor? 100 passes, 5% vs 15%.
    const hot = hotSkills(m)
    expect(hot.map((s) => s.name)).toEqual(['Python'])
    expect(hot[0].lift).toBeCloseTo(1.5)
  })

  it('says nothing about rising skills when too few jobs are recent', () => {
    expect(hotSkills({ ...m, fresh: 10 })).toEqual([])
  })

  it('orders by AI exposure, most and least, and needs enough matched jobs', () => {
    const wide = market([...skills, row('Sparse', 4000, { exposure: 0.9, exposureN: 10 }), row('Other', 2000, { exposure: 0.3, exposureN: 300 })])
    expect(skillsByExposure(wide, 'most').map((s) => s.name)).toEqual(['Excel', 'Other', 'Python', 'Welding'])
    expect(skillsByExposure(wide, 'least').map((s) => s.name)[0]).toBe('Welding')
  })

  it('finds skills asked for alongside an AI skill', () => {
    expect(aiComplementSkills(m).map((s) => s.name)).toEqual(['Python', 'Excel', 'Welding'])
  })

  it('lists dimension values, levels in seniority order', () => {
    expect(dimensionValues(m, 'level').map((v) => v.key)).toEqual(['entry', 'mid', 'vp'])
    expect(dimensionValues(m, 'industry').map((v) => v.key)).toEqual(['tech', 'health'])
  })
})

describe('skillGap', () => {
  const m = market([row('Excel', 5000), row('Python', 3000), row('SQL', 2000)])
  it('splits the most-asked skills into shown and missing, ignoring case', () => {
    const g = skillGap(m, ['excel', ' SQL '])
    expect(g.have.map((s) => s.name)).toEqual(['Excel', 'SQL'])
    expect(g.missing.map((s) => s.name)).toEqual(['Python'])
  })
})
