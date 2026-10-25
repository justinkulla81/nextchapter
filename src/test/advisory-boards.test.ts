import { describe, expect, it } from 'vitest'
import { ADVISORY_SOURCES, advisoryPlan, boardExperienceOf, boardSectorsOf } from '@/lib/network/advisory-boards'

describe('board answers', () => {
  it('reads only the three known experiences', () => {
    expect(boardExperienceOf({ boardExperience: 'BOARD' })).toBe('BOARD')
    expect(boardExperienceOf({ boardExperience: 'ADVISORY' })).toBe('ADVISORY')
    expect(boardExperienceOf({ boardExperience: 'NONE' })).toBe('NONE')
    expect(boardExperienceOf({ boardExperience: 'CHAIR' })).toBeNull()
    expect(boardExperienceOf(null)).toBeNull()
  })
  it('trims and caps the sectors', () => {
    expect(boardSectorsOf({ boardSectors: '  health, education  ' })).toBe('health, education')
    expect(boardSectorsOf({ boardSectors: 'x'.repeat(300) })).toHaveLength(120)
    expect(boardSectorsOf({})).toBe('')
  })
})

describe('advisoryPlan', () => {
  it('puts a different first step first for each experience', () => {
    const keys = (['NONE', 'ADVISORY', 'BOARD'] as const).map((e) => advisoryPlan({ boardExperience: e }).next.key)
    expect(keys).toEqual(['first_seat', 'ask_for_board', 'chair_reference'])
  })
  it('asks where they are when it does not know', () => {
    expect(advisoryPlan({}).next.key).toBe('pick_where')
  })
  it('names their sectors in the list step when they gave them', () => {
    expect(advisoryPlan({ boardSectors: 'health' }).steps[0].title).toBe('List 10 organizations in health you would serve')
    expect(advisoryPlan({}).steps[0].title).toBe('List 10 organizations you would serve')
  })
  it('says nothing about a job search, so it is safe in confidential mode', () => {
    const text = JSON.stringify(advisoryPlan({ boardExperience: 'NONE' }))
    expect(text).not.toMatch(/looking for a job|open to work|job search(?!\.)/i)
    expect(text).toMatch(/Nothing here mentions a job search/)
  })
  it('states no statistic', () => {
    expect(JSON.stringify(advisoryPlan({ boardExperience: 'BOARD' }))).not.toMatch(/\d+\s?%|\b\d+x\b/)
  })
  it('only sends them to pages that exist and to https sources', () => {
    const p = advisoryPlan({})
    const inApp = new Set(['/dashboard/companies', '/dashboard/network/be-found', '/dashboard/network/contacts', '/dashboard/interim-work'])
    for (const s of p.steps) if (s.href) expect(inApp.has(s.href)).toBe(true)
    for (const s of ADVISORY_SOURCES) expect(s.href.startsWith('https://')).toBe(true)
    expect(ADVISORY_SOURCES.map((s) => new URL(s.href).hostname)).toEqual(['boardsource.org', 'taprootfoundation.org', 'www.boardprospects.com', 'fi.co'])
  })
})
