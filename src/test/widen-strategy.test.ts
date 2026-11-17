import { describe, expect, it } from 'vitest'
import { functionKeyFor, industryKeyFor, needsStrategy, skillsIntel, strategySummary } from '@/lib/jobs/widen-strategy'
import type { SkillMarket } from '@/lib/skills/market'

const none = { remote: false, states: [], cities: [], industries: [], roles: [] }

describe('strategySummary', () => {
  const names = { state: (s: string) => ({ TX: 'Texas', GA: 'Georgia' })[s] ?? s, city: (c: string) => c.replace(/,\s*[A-Z]{2}$/, ''), role: (r: string) => r.replace(/_/g, ' ') }
  it('is null until something is picked', () => {
    expect(strategySummary(none, names)).toBeNull()
  })
  it('says what the search adds, in words', () => {
    expect(strategySummary({ remote: true, states: ['GA'], cities: ['Austin, TX'], industries: ['Insurance'], roles: ['fpa_manager'] }, names)).toBe(
      'Your search adds jobs in Austin, Georgia and remote, Insurance employers and fpa manager roles.'
    )
  })
})

describe('needsStrategy', () => {
  it('sends a member with nothing outside home to the strategy first', () => {
    expect(needsStrategy({}, none, 0)).toBe(true)
  })
  it('keeps the plain switch once they finished one or already widened', () => {
    expect(needsStrategy({ widenStrategy: { at: '2026-11-17T00:00:00Z' } }, none, 0)).toBe(false)
    expect(needsStrategy({}, { ...none, states: ['TX'] }, 0)).toBe(false)
    expect(needsStrategy({}, none, 1)).toBe(false)
    expect(needsStrategy({}, { ...none, cities: ['Austin, TX'] }, 0)).toBe(false)
  })
})

describe('skills intelligence', () => {
  const market = {
    asOf: '', live: 1000, withSkills: 900, fresh: 0,
    totals: { industry: { healthcare: 400, hospitals: 100 }, function: { finance: 500 }, state: {}, level: {} },
    labels: { industry: { healthcare: 'Healthcare & Hospital Systems', hospitals: 'Healthcare & Hospital Systems' }, function: { finance: 'Finance' }, state: {}, level: {} },
    skills: [
      { slug: 'excel', name: 'Excel', n: 400, fresh: 0, exposure: null, exposureN: 0, aiPair: 0, by: { industry: {}, function: { finance: 300 }, state: {}, level: {} } },
      { slug: 'sql', name: 'SQL', n: 350, fresh: 0, exposure: null, exposureN: 0, aiPair: 0, by: { industry: {}, function: { finance: 100 }, state: {}, level: {} } },
    ],
  } as unknown as SkillMarket
  it('splits the field’s top skills into shown and not shown', () => {
    const s = skillsIntel(market, ['excel'], { dim: 'function', key: functionKeyFor('Finance') }, 'Finance jobs')
    expect(s?.have.map((x) => x.name)).toEqual(['Excel'])
    expect(s?.missing.map((x) => x.name)).toEqual(['SQL'])
    expect(s?.basis).toBe(500)
  })
  it('says nothing about a slice too small to read', () => {
    expect(skillsIntel(market, [], { dim: 'function', key: 'law' }, 'Law jobs')).toBeNull()
  })
  it('maps an industry bucket to its largest key', () => {
    expect(industryKeyFor(market, 'Healthcare & Hospital Systems')).toBe('healthcare')
  })
})
