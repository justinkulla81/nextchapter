import { describe, expect, it } from 'vitest'
import {
  assignSlots, credibilityOf, draftText, eligibleAngles, leastRecent, MIN_EMPLOYEES, POST_LINK,
  type DraftFacts, type GateNotice,
} from './layoff-post-rules'

const now = new Date('2026-10-20T15:00:00Z') // Tuesday 11:00 ET
const notice = (o: Partial<GateNotice> = {}): GateNotice => ({
  source: 'MANUAL_ANNOUNCEMENT', sourceUrl: 'https://example.com/a', layoffType: null, employees: 500,
  fetchedAt: new Date('2026-10-19T12:00:00Z'), dismissedAt: null, ...o,
})
const facts = (o: Partial<DraftFacts> = {}): DraftFacts => ({
  employer: 'Acme', employees: 500, percent: null, place: 'Harris County, TX', state: 'TX', noticeDate: null,
  effectiveDate: '2026-12-15T00:00:00Z', industry: null, sourceUrl: null, credibility: 'warn-filing',
  openRolesInState: 900, openSeniorRolesInState: 200, tagSuggestions: [], ...o,
})

describe('credibilityOf', () => {
  it('accepts a state WARN filing and an SEC filing on their own', () => {
    expect(credibilityOf(notice({ source: 'WARN_FILING' }), [], now)).toBe('warn-filing')
    expect(credibilityOf(notice({ sourceUrl: 'https://www.sec.gov/x' }), [], now)).toBe('sec-filing')
  })
  it('needs two publishers for news, or one trusted outlet', () => {
    expect(credibilityOf(notice(), ['Local Blog'], now)).toBeNull()
    expect(credibilityOf(notice(), ['Local Blog', 'Other Blog'], now)).toBe('two-publishers')
    expect(credibilityOf(notice(), ['Reuters'], now)).toBe('trusted-outlet')
  })
  it('counts the same publisher twice as one', () => {
    expect(credibilityOf(notice(), ['Local Blog', 'local blog'], now)).toBeNull()
  })
  it('rejects small, unsized, dismissed and stale layoffs', () => {
    const w = { source: 'WARN_FILING' as const }
    expect(credibilityOf(notice({ ...w, employees: MIN_EMPLOYEES - 1 }), [], now)).toBeNull()
    expect(credibilityOf(notice({ ...w, employees: null }), [], now)).toBeNull()
    expect(credibilityOf(notice({ ...w, dismissedAt: now }), [], now)).toBeNull()
    expect(credibilityOf(notice({ ...w, fetchedAt: new Date('2026-10-01T00:00:00Z') }), [], now)).toBeNull()
  })
})

describe('angles and wording', () => {
  it('only offers angles the facts support', () => {
    expect(eligibleAngles(facts({ openRolesInState: null, openSeniorRolesInState: null, effectiveDate: null }))).toEqual(['offer-help', 'first-week'])
    expect(eligibleAngles(facts({ credibility: 'two-publishers' }))).not.toContain('timeline')
  })
  it('prefers the least recently used option', () => {
    expect(leastRecent(['a', 'b', 'c'], ['a', 'b'], 'x')).toBe('c')
    expect(leastRecent(['a', 'b'], ['a', 'b'], 'x')).toBe('b')
  })
  it('keeps the link out of the post and in the first comment', () => {
    const t = draftText('offer-help', facts(), 'n1')
    expect(t.body).not.toContain('http')
    expect(t.firstComment).toContain(POST_LINK)
    expect(t.body).toContain('Acme')
  })
  it('words different notices differently', () => {
    const bodies = new Set(Array.from({ length: 12 }, (_, i) => draftText('first-week', facts(), `notice-${i}`).body))
    expect(bodies.size).toBeGreaterThan(4)
  })
})

describe('assignSlots', () => {
  it('spreads posts across slots on weekdays, never two inside the gap', () => {
    const slots = assignSlots(4, [], now)
    expect(slots).toHaveLength(4)
    for (let i = 1; i < slots.length; i++) expect(slots[i].getTime() - slots[i - 1].getTime()).toBeGreaterThanOrEqual(3 * 3_600_000)
    for (const s of slots) expect([0, 6]).not.toContain(new Date(s.getTime() - 5 * 3_600_000).getUTCDay())
  })
  it('starts at least an hour out and skips slots already taken', () => {
    const first = assignSlots(1, [], now)[0]
    expect(first.getTime()).toBeGreaterThanOrEqual(now.getTime() + 3_600_000)
    expect(assignSlots(1, [first], now)[0].getTime()).toBeGreaterThan(first.getTime())
  })
  it('puts at most two on one day', () => {
    const perDay = new Map<string, number>()
    for (const s of assignSlots(6, [], now)) {
      const k = s.toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
      perDay.set(k, (perDay.get(k) ?? 0) + 1)
    }
    expect(Math.max(...perDay.values())).toBeLessThanOrEqual(2)
  })
})
