import { describe, expect, it } from 'vitest'
import { courseNamesSkill, pickPrograms, rankCourses, soc7 } from '@/lib/skills/learn'

const course = (id: string, title: string, over: Partial<{ description: string; keywords: string[]; free: boolean }> = {}) => ({ id, title, description: '', keywords: [], free: false, ...over })

describe('courses that name a skill', () => {
  it('matches the whole term only', () => {
    expect(courseNamesSkill(course('1', 'SQL for analysts'), 'SQL')).toBe(true)
    expect(courseNamesSkill(course('2', 'Learning MySQL'), 'SQL')).toBe(false)
    expect(courseNamesSkill(course('3', 'Intro', { description: 'You will use Excel daily.' }), 'excel')).toBe(true)
    expect(courseNamesSkill(course('4', 'Excellence in service'), 'Excel')).toBe(false)
  })
  it('handles names with punctuation', () => {
    expect(courseNamesSkill(course('5', 'Building with Node.js'), 'Node.js')).toBe(true)
    expect(courseNamesSkill(course('6', 'C++ basics'), 'C++')).toBe(true)
  })
  it('matches a keyword', () => {
    expect(courseNamesSkill(course('7', 'Data bootcamp', { keywords: ['python', 'pandas'] }), 'Python')).toBe(true)
  })
  it('ranks a title match first, then free, and respects the limit', () => {
    const list = [
      course('a', 'Data bootcamp', { description: 'Python for beginners', free: true }),
      course('b', 'Python for everybody'),
      course('c', 'Python in depth', { free: true }),
      course('d', 'Unrelated'),
    ]
    expect(rankCourses(list, 'Python').map((c) => c.id)).toEqual(['c', 'b', 'a'])
    expect(rankCourses(list, 'Python', 1).map((c) => c.id)).toEqual(['c'])
  })
  it('refuses a one-letter skill name', () => {
    expect(courseNamesSkill(course('1', 'R programming'), 'R')).toBe(false)
  })
})

describe('training programs', () => {
  it('uses the 7-character SOC code', () => {
    expect(soc7('15-1252.00')).toBe('15-1252')
  })
  it('keeps one program per provider, cheapest first, unknown cost last', () => {
    const rows = [
      { id: '1', provider: 'A College', costUsd: 5000 },
      { id: '2', provider: 'A College', costUsd: 1000 },
      { id: '3', provider: 'B Institute', costUsd: null },
      { id: '4', provider: 'C Academy', costUsd: 3000 },
    ]
    expect(pickPrograms(rows).map((r) => r.id)).toEqual(['2', '4', '3'])
    expect(pickPrograms(rows, 2).map((r) => r.id)).toEqual(['2', '4'])
  })
})
