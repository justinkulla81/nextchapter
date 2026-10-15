import { describe, expect, it } from 'vitest'
import { buildSkillMatrix, skillTerms, topSkills } from '@/lib/profile/skill-matrix'

const base = { resumeKeywords: ['SQL', 'Tableau', 'Excel'], confirmedSkillsHave: ['sql', 'Python'], certifications: ['PMP'] }

describe('skills matrix', () => {
  it('merges sources and infers levels', () => {
    const rows = buildSkillMatrix(base)
    const sql = rows.find((r) => r.key === 'sql')!
    expect(sql.sources.sort()).toEqual(['resume', 'self'])
    expect(sql.level).toBe('strong')
    expect(rows.find((r) => r.key === 'pmp')!.level).toBe('strong')
    expect(rows.find((r) => r.key === 'tableau')!.level).toBe('used')
    expect(rows.length).toBe(5)
  })
  it('the person’s own level wins; removed skills drop out of matching', () => {
    const json = { ...base, skillLevels: { Tableau: { level: 'expert' }, excel: { removed: true } } }
    const rows = buildSkillMatrix(json)
    expect(rows[0].key).toBe('tableau')
    expect(rows[0].levelSetBy).toBe('person')
    expect(skillTerms(json)).not.toContain('excel')
    expect(topSkills(json, 1)).toEqual(['Tableau'])
  })
  it('handles empty and junk input', () => {
    expect(buildSkillMatrix({})).toEqual([])
    expect(buildSkillMatrix({ resumeKeywords: [' '], skillLevels: 'x' })).toEqual([])
  })
})
