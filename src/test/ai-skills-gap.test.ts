import { describe, expect, it } from 'vitest'
import { readPostingAi } from '@/lib/ai-skills/taxonomy'
import { personAiLevels } from '@/lib/ai-skills/person'
import { aggregateAiGap } from '@/lib/ai-skills/gap'
import { courseAi, coursesFor } from '@/lib/ai-skills/courses'

const none = { matrix: [], completedCourses: [], aiProjects: [], familiarTools: [] }

describe('personAiLevels', () => {
  it('reads a resume mention as aware and a confirmed skill as practitioner', () => {
    const { levels } = personAiLevels({ ...none, matrix: [{ label: 'ChatGPT', level: 'used' }, { label: 'Prompt engineering', level: 'strong' }] })
    expect(levels['ai-tools']).toBe('aware')
    expect(levels['prompting']).toBe('practitioner')
  })
  it('lets an AI project lift the person to practitioner', () => {
    expect(personAiLevels({ ...none, aiProjects: [{ title: 'Built a RAG assistant for our policy docs' }] }).levels['rag']).toBe('practitioner')
  })
  it('never lowers a level it already has', () => {
    const { levels } = personAiLevels({ ...none, matrix: [{ label: 'ChatGPT', level: 'strong' }], completedCourses: [{ skills: ['ai-tools'], level: 'aware' }] })
    expect(levels['ai-tools']).toBe('practitioner')
  })
})

describe('aggregateAiGap', () => {
  const reads = [
    ...Array.from({ length: 6 }, () => readPostingAi('Marketing Manager', 'Use ChatGPT and prompt engineering daily.')),
    ...Array.from({ length: 4 }, () => readPostingAi('Operations Lead', 'Build AI workflows with Zapier.')),
    readPostingAi('Accountant', 'Month-end close.'),
  ]
  it('counts only jobs that mention AI and ranks gaps before covered skills', () => {
    const gap = aggregateAiGap(reads, { 'ai-tools': 'practitioner' })
    expect(gap.jobsRead).toBe(11)
    expect(gap.jobsWithAi).toBe(10)
    expect(gap.rows[0].status).not.toBe('covered')
    expect(gap.rows.find((r) => r.key === 'ai-tools')?.status).toBe('covered')
  })
  it('marks a lower level as build and no level as missing', () => {
    const gap = aggregateAiGap(reads, { 'ai-tools': 'aware' })
    expect(gap.rows.find((r) => r.key === 'ai-tools')?.status).toBe('build')
    expect(gap.rows.find((r) => r.key === 'prompting')?.status).toBe('missing')
  })
})

describe('courses', () => {
  const catalog = [
    { title: 'AI For Everyone', description: 'A foundational introduction to what AI can do.', skillLevel: 'BEGINNER' as const, category: 'AI_TRAINING', free: false },
    { title: 'Prompt Engineering for ChatGPT', description: 'Prompt patterns for ChatGPT.', skillLevel: 'INTERMEDIATE' as const, category: 'AI_TRAINING', free: true },
    { title: 'Excel for Accountants', description: 'Spreadsheets.', skillLevel: 'BEGINNER' as const, category: 'FUNCTION_TRAINING', free: true },
  ]
  it('tags generic beginner AI courses with the basics and ignores non-AI ones', () => {
    expect(courseAi(catalog[0])).toEqual({ skills: ['ai-tools'], level: 'aware' })
    expect(courseAi(catalog[2])).toBeNull()
  })
  it('recommends only courses that move the person above their current level', () => {
    expect(coursesFor('ai-tools', 'practitioner', 'aware', catalog).map((c) => c.title)).not.toContain('AI For Everyone')
    expect(coursesFor('prompting', 'practitioner', null, catalog).map((c) => c.title)).toEqual(['Prompt Engineering for ChatGPT'])
  })
})

import { AI_SKILL_COURSE_SEEDS } from '@/lib/ai-skills/catalog-seed'
describe('catalog seed', () => {
  for (const c of AI_SKILL_COURSE_SEEDS) {
    it(`${c.title} tags to its intended skills`, () => {
      const ai = courseAi({ ...c, category: 'AI_TRAINING' })
      expect(ai?.level).toBe(c.expect.level)
      for (const k of c.expect.skills) expect(ai?.skills).toContain(k)
    })
  }
})
