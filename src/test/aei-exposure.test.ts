import { describe, expect, it } from 'vitest'
import { aeiSocFor, collabModeFor, exposureLevelFor, lookupOccupation } from '@/lib/aei/job-exposure'
import { taskSkillLinks } from '@/lib/aei/task-skills'
import { memberSkillAiUse } from '@/lib/aei/skills'
import { BOARD_SORTS, isExposureSort, parseBoardSearchParams } from '@/lib/jobs/board-search'

describe('AI exposure levels (Anthropic Economic Index)', () => {
  it('uses the fixed cutoffs: High >= 50% of tasks, Medium >= 25%, else Low', () => {
    expect(exposureLevelFor(50)).toBe('high')
    expect(exposureLevelFor(62.5)).toBe('high')
    expect(exposureLevelFor(49.9)).toBe('medium')
    expect(exposureLevelFor(25)).toBe('medium')
    expect(exposureLevelFor(24.9)).toBe('low')
    expect(exposureLevelFor(0)).toBe('low')
    expect(exposureLevelFor(null)).toBeNull()
  })

  it('reads automation vs augmentation with an even band', () => {
    expect(collabModeFor(60.6, 39.4)).toBe('automates')
    expect(collabModeFor(33.8, 66.2)).toBe('augments')
    expect(collabModeFor(48.5, 51.5)).toBe('both')
    expect(collabModeFor(null, 50)).toBeNull()
  })
})

describe('the occupation a job is read as', () => {
  it("keeps the crawler's title match", () => {
    expect(aeiSocFor({ socCode: '15-1252.00', title: 'Senior Software Engineer', fn: 'Engineering', level: 'SENIOR_IC' })).toEqual({ soc: '15-1252.00', source: 'title' })
  })

  it('reads vague titles from function and level', () => {
    expect(aeiSocFor({ socCode: null, title: 'Director', fn: 'Finance', level: 'DIRECTOR' })).toEqual({ soc: '11-3031.00', source: 'function' })
    expect(aeiSocFor({ socCode: null, title: 'Senior Manager, AP & AR', fn: 'Finance', level: 'SR_MANAGER' }).soc).toBe('11-3031.00')
    expect(aeiSocFor({ socCode: null, title: 'Analyst II - Tax', fn: 'Finance', level: 'MID_IC' }).soc).toBe('13-2011.00')
    expect(aeiSocFor({ socCode: null, title: 'Principal Engineer, Platform', fn: 'Engineering', level: 'PRINCIPAL' }).soc).toBe('15-1252.00')
    expect(aeiSocFor({ socCode: null, title: 'Spacecraft Mechanisms Build Engineer', fn: 'Engineering', level: 'MID_IC' }).soc).toBe('17-2199.00')
    expect(aeiSocFor({ socCode: null, title: 'Support Lead', fn: 'Customer Success', level: 'MID_IC' }).soc).toBe('43-4051.00')
    expect(aeiSocFor({ socCode: null, title: 'Help Desk Manager', fn: 'Engineering', level: 'MANAGER' }).soc).toBe('11-3021.00')
    expect(aeiSocFor({ socCode: null, title: 'Senior Paralegal', fn: 'Legal', level: 'SENIOR_IC' }).soc).toBe('23-2011.00')
  })

  it('falls back to a generic occupation by level with no function', () => {
    expect(aeiSocFor({ socCode: null, title: 'Team Leader', fn: null, level: 'MANAGER' })).toEqual({ soc: '11-1021.00', source: 'default' })
    expect(aeiSocFor({ socCode: null, title: 'Associate', fn: 'Other', level: 'EARLY_IC' })).toEqual({ soc: '13-1199.00', source: 'default' })
  })

  it('looks codes outside O*NET 31.0 up by their detailed SOC', () => {
    const m = new Map([
      ['15-1252.00', 'a'],
      ['13-1199.04', 'b'],
    ])
    expect(lookupOccupation(m, '15-1252.00')).toBe('a')
    expect(lookupOccupation(m, '15-1252.01')).toBe('a')
    expect(lookupOccupation(m, '13-1199.09')).toBe('b')
    expect(lookupOccupation(m, '47-2111.00')).toBeNull()
  })
})

describe('AEI task -> skill links', () => {
  it('links task verbs to O*NET basic skills', () => {
    const ids = taskSkillLinks('Write, update, and maintain computer programs or software packages.').map((l) => l.skillId)
    expect(ids).toContain('skill:2.A.1.c')
    expect(ids).toContain('skill:2.B.3.e')
    expect(taskSkillLinks('Negotiate contracts with vendors.').map((l) => l.skillId)).toContain('skill:2.B.1.d')
  })
})

describe("a member's skills, automated vs augmented", () => {
  const skills = [
    { skillId: 'skill:2.B.3.e', name: 'Programming', taskCount: 100, automationPct: 58.6, augmentationPct: 41.4, topTask: null },
    { skillId: 'skill:2.B.1.e', name: 'Instructing', taskCount: 38, automationPct: 38.1, augmentationPct: 61.9, topTask: null },
    { skillId: 'skill:2.A.1.c', name: 'Writing', taskCount: 90, automationPct: 49, augmentationPct: 51, topTask: null },
  ]
  it('maps member words to skills and splits them', () => {
    const r = memberSkillAiUse(['Python', 'Mentoring', 'Copywriting', 'Underwater basket weaving'], skills)
    expect(r.automated.map((x) => x.skill)).toEqual(['Programming'])
    expect(r.automated[0].yourLabel).toBe('Python')
    expect(r.augmented.map((x) => x.skill)).toEqual(['Instructing'])
  })
})

describe('board sorts', () => {
  it('offers Most / Least exposed to AI', () => {
    expect(BOARD_SORTS).toContain('ai_most')
    expect(parseBoardSearchParams({ sort: 'ai_least' }).sort).toBe('ai_least')
    expect(isExposureSort('ai_most')).toBe(true)
    expect(isExposureSort('pay')).toBe(false)
  })
})
