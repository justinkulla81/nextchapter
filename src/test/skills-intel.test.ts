import { describe, expect, it } from 'vitest'
import { anonymizeCandidates, countBy, gapRows, seniorityBand, skillsOf, weeksBand, type Person } from '@/lib/workforce/skills-intel'
import { countSkills } from '@/lib/workforce/skills-dictionary'

const person = (o: Partial<Person> = {}): Person => ({ function: 'Finance', industry: 'Insurance', level: 'Manager', years: 10, weeksOut: 30, keywords: ['SQL', 'financial modeling', 'Excel'], dossier: true, ...o })

describe('skills intelligence', () => {
  it('bands seniority from level, falling back to years', () => {
    expect(seniorityBand('VP', null)).toBe('Director or above')
    expect(seniorityBand('IC', 20)).toBe('Individual contributor')
    expect(seniorityBand(null, 9)).toBe('Manager')
    expect(seniorityBand(null, null)).toBeNull()
  })
  it('bands weeks out', () => {
    expect(weeksBand(30)).toBe('26 weeks or more out')
    expect(weeksBand(14)).toBe('13 to 25 weeks out')
    expect(weeksBand(null)).toBeNull()
  })
  it('finds vocabulary skills in résumé keywords', () => {
    expect(skillsOf(['Financial Modeling', 'SQL'])).toEqual(expect.arrayContaining(['Financial modeling or forecasting', 'SQL']))
  })
  it('shows the gap only when enough people have the skill', () => {
    const demand = countSkills(['SQL analyst', 'SQL and Excel', 'Excel and forecasting'])
    const many = Array.from({ length: 10 }, () => person())
    const rows = gapRows(demand, many)
    const sql = rows.find((r) => r.skill === 'SQL')!
    expect(sql.supplyPeople).toBe(10)
    expect(sql.gap).toBeCloseTo(2 / 3 - 1)
    const few = gapRows(demand, [person(), person()])
    expect(few.every((r) => r.supplyPeople === null && r.gap === null)).toBe(true)
  })
  it('counts by a label and hides groups under five', () => {
    const out = countBy([...Array.from({ length: 6 }, () => person()), person({ function: 'HR' })], (p) => p.function)
    expect(out).toEqual([{ label: 'Finance', n: 6 }, { label: 'HR', n: null }])
  })
  it('anonymous profiles: only groups of five or more, no names, shuffled letters, industry generalized when rare', () => {
    const group = [...Array.from({ length: 6 }, () => person()), person({ industry: 'Aerospace & Defense' })]
    const lone = person({ function: 'Legal', level: 'VP' })
    const optedOut = person({ dossier: false })
    const { profiles, hidden } = anonymizeCandidates([...group, lone, optedOut], 'seed1')
    expect(profiles).toHaveLength(7)
    expect(hidden).toBe(1)
    expect(profiles.every((p) => p.function === 'Finance')).toBe(true)
    expect(profiles.filter((p) => p.industry === null)).toHaveLength(1)
    expect(profiles.map((p) => p.label)[0]).toMatch(/^Candidate [A-Z]/)
    expect(JSON.stringify(profiles)).not.toMatch(/@|\d{4}/)
    expect(anonymizeCandidates(group, 'seed2').profiles.map((p) => p.skills.join()).join()).toBe(anonymizeCandidates(group, 'seed1').profiles.map((p) => p.skills.join()).join())
  })
})
