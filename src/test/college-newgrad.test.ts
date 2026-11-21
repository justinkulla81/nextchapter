import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/prisma', () => ({ prisma: {} }))

import { fiveYearSteps } from '@/components/higher-ed/FirstFiveYears'
import { buildPaths, wantsCareerPaths } from '@/lib/higher-ed/career-paths'

const NOW = new Date('2026-11-21T00:00:00Z')

describe('the first five years', () => {
  it('marks answered, sent, past and coming check-ins honestly', () => {
    const s = fiveYearSteps(2025, [{ kind: 'M6', status: 'RESPONDED' }, { kind: 'M18', status: 'SENT' }], 10, NOW)
    expect(s.map((x) => x.state)).toEqual(['done', 'answered', 'sent', 'coming', 'coming'])
    expect(fiveYearSteps(2024, [], 10, NOW)[1].state).toBe('past')
    expect(s[4].when).toBe('Each October')
  })
})

describe('career paths', () => {
  it('serve students and graduates of the last two years', () => {
    expect(wantsCareerPaths({ affiliation: 'STUDENT', classYear: 2028 }, NOW)).toBe(true)
    expect(wantsCareerPaths({ affiliation: 'ALUM', classYear: 2024 }, NOW)).toBe(true)
    expect(wantsCareerPaths({ affiliation: 'ALUM', classYear: 2015 }, NOW)).toBe(false)
  })

  it('marks skills the résumé shows and attaches offerings only to the rest', () => {
    const course = { key: 'audit:1', kind: 'audit' as const, name: 'Data Analysis', detail: null, skills: ['excel', 'data analysis'], href: '#' }
    const [role] = buildPaths([{ title: 'Financial analyst', skills: ['Mathematics'], tools: ['Excel'] }], ['mathematics'], [course])
    expect(role.skills).toEqual([
      { name: 'Mathematics', have: true, offerings: [] },
      { name: 'Excel', have: false, offerings: [course] },
    ])
  })
})
