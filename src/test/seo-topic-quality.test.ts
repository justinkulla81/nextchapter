import { describe, expect, it } from 'vitest'
import { assess, assessAssociation, assessConference, conferenceFactCount, type ConferenceFactInput } from '@/lib/seo/topic-quality'
import { exposureFacts, jobFacts, trendFact } from '@/lib/seo/topic-facts'

const full: ConferenceFactInput = {
  datesConfirmed: true, startDate: '2027-05-16', typicalMonth: 'May', format: 'IN_PERSON', city: 'Phoenix', state: 'AZ', access: 'PAID', costLow: 500, costHigh: 900,
  speaking: 'OPEN_CFP', speakingDeadline: null, organizer: 'AAAE', seniorities: ['SENIOR'], roles: [], programFormats: ['KEYNOTE'], whyAttend: 'The main yearly gathering of airport directors and operators.',
  cheaperWays: null, verified: true, checkedAt: '2026-10-23', industries: ['Transportation & Logistics'], functions: ['Operations'],
}
const bare: ConferenceFactInput = { ...full, datesConfirmed: false, startDate: null, typicalMonth: null, city: null, state: null, access: 'PAID', costLow: null, costHigh: null, speaking: 'UNKNOWN', organizer: null, seniorities: [], programFormats: [], whyAttend: null, verified: false, checkedAt: null, industries: [], functions: [] }

describe('quality bar', () => {
  it('counts a conference row’s own facts', () => {
    expect(conferenceFactCount(full)).toBe(9)
    expect(conferenceFactCount(bare)).toBe(0)
  })
  it('passes a well-filled conference and fails a bare one', () => {
    expect(assessConference(full, true, 5).indexable).toBe(true)
    expect(assessConference(bare, false, 0).indexable).toBe(false)
  })
  it('needs both facts and links', () => {
    expect(assess(9, 2).indexable).toBe(false)
    expect(assess(4, 9).indexable).toBe(false)
    expect(assess(5, 3).indexable).toBe(true)
  })
  it('judges an association from its conferences', () => {
    expect(assessAssociation([full, { ...full }]).indexable).toBe(true)
    expect(assessAssociation([bare, bare]).indexable).toBe(false)
  })
})

describe('sourced facts', () => {
  it('gives every fact a source', () => {
    const stats = { sample: 100, paid: 60, p25: 80000, p50: 100000, p75: 130000, entryPct: 20, noExperiencePct: 0, aiSkillPct: 5, aiExposedPct: 3, remotePct: 10, skills: [], states: [] }
    const facts = [...jobFacts(1000, stats), ...exposureFacts('Finance'), trendFact({ yoyPct: -1.2, asOf: '2026-09' }, 'Insurance')!]
    expect(facts.length).toBeGreaterThan(6)
    for (const f of facts) expect(f.source.length).toBeGreaterThan(5)
    expect(facts.find((f) => f.key === 'noexp')).toBeUndefined()
    expect(facts.find((f) => f.key === 'exposure')?.period).toBe('estimate')
    expect(facts.find((f) => f.key === 'ces')?.value).toContain('financial activities')
  })
  it('has no exposure fact for a function without a confident occupation group', () => {
    expect(exposureFacts('Customer Success')).toEqual([])
  })
})
