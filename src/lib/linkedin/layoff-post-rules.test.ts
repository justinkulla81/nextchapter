import { describe, expect, it } from 'vitest'
import {
  assignSlots, looksNonUs, speculative, slidesFor, credibilityOf, audienceFit, employerKey, farOffTimeline, plausibleEmployer, rankScore, sameEvent, MAX_EMPLOYEES, draftText, eligibleAngles, leastRecent, MIN_EMPLOYEES, POST_LINK,
  type DraftFacts, type GateNotice,
} from './layoff-post-rules'

const now = new Date('2026-10-20T15:00:00Z') // Tuesday 11:00 ET
const notice = (o: Partial<GateNotice> = {}): GateNotice => ({
  employer: 'Acme', source: 'MANUAL_ANNOUNCEMENT', sourceUrl: 'https://example.com/a', layoffType: null, employees: 500,
  fetchedAt: new Date('2026-10-19T12:00:00Z'), dismissedAt: null, ...o,
})
const facts = (o: Partial<DraftFacts> = {}): DraftFacts => ({
  employer: 'Acme', employees: 500, percent: null, place: 'Harris County, TX', state: 'TX', noticeDate: null,
  effectiveDate: '2026-12-15T00:00:00Z', industry: null, sourceUrl: null, credibility: 'warn-filing',
  openRolesInState: 900, openSeniorRolesInState: 200, openRemoteRoles: 400, tagSuggestions: [], ...o,
})

describe('credibilityOf', () => {
  it('accepts a state WARN filing and an SEC filing on their own', () => {
    expect(credibilityOf(notice({ source: 'WARN_FILING' }), [], now)).toBe('warn-filing')
    expect(credibilityOf(notice({ sourceUrl: 'https://www.sec.gov/x' }), [], now)).toBe('sec-filing')
  })
  it('accepts news with one source as unconfirmed, two as confirmed, a trusted outlet as trusted', () => {
    expect(credibilityOf(notice(), ['Local Blog'], now)).toBe('unconfirmed')
    expect(credibilityOf(notice(), ['Local Blog', 'Other Blog'], now)).toBe('two-publishers')
    expect(credibilityOf(notice(), ['Reuters'], now)).toBe('trusted-outlet')
  })
  it('holds back a layoff only the hedged headlines describe', () => {
    expect(credibilityOf(notice(), ['Reuters'], now, ['Acme could cut 500 jobs'])).toBeNull()
    expect(credibilityOf(notice(), ['Local Blog'], now, ['Acme considering layoffs', 'Acme may lay off 500'])).toBeNull()
    expect(credibilityOf(notice(), ['Local Blog'], now, ['Acme lays off 500', 'Acme could cut more'])).toBe('unconfirmed')
  })
  it('counts the same publisher twice as one', () => {
    expect(credibilityOf(notice(), ['Local Blog', 'local blog'], now)).toBe('unconfirmed')
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
    expect(eligibleAngles(facts({ openRolesInState: null, openSeniorRolesInState: null, effectiveDate: null }))).toEqual(['offer-help', 'first-week', 'company-offer', 'long-search', 'comment-for-plan'])
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
  it('puts at most two on a day', () => {
    const perDay = new Map<string, number>()
    for (const s of assignSlots(6, [], now)) {
      const k = s.toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
      perDay.set(k, (perDay.get(k) ?? 0) + 1)
    }
    expect(Math.max(...perDay.values())).toBeLessThanOrEqual(2)
  })
})

describe('gate: junk names and absurd sizes', () => {
  const w = { source: 'WARN_FILING' as const }
  it('rejects names that are not companies', () => {
    for (const bad of ['AI blamed for', 'Announcing', 'Big four bank', 'Australian bank', 'Westminster council', 'lowercase co']) {
      expect(plausibleEmployer(bad), bad).toBe(false)
      expect(credibilityOf(notice({ ...w, employer: bad }), [], now), bad).toBeNull()
    }
    for (const ok of ['Kroger', 'Hasbro, Inc.', 'T-Mobile USA, Inc.', 'Keya Group', 'NAB']) expect(plausibleEmployer(ok), ok).toBe(true)
  })
  it('rejects a layoff too large to be one company\'s', () => {
    expect(credibilityOf(notice({ ...w, employees: MAX_EMPLOYEES + 1 }), [], now)).toBeNull()
  })
})

describe('sameEvent', () => {
  const d = new Date('2026-10-13T00:00:00Z')
  const ev = (employer: string, employees = 3000, date = d) => ({ employer, employees, date })
  it('treats possessives and plain names as one company', () => {
    expect(employerKey('Kroger’s')).toBe('kroger')
    expect(sameEvent(ev('Kroger’s'), ev('Kroger', 3000, new Date('2026-10-12T00:00:00Z')))).toBe(true)
  })
  it('matches an acronym or a shared word when the headcount and dates agree', () => {
    expect(sameEvent(ev('NAB', 2500), ev('National Australia Bank', 2500))).toBe(true)
    expect(sameEvent(ev('Australia’s NAB', 2500), ev('National Australia Bank', 2500))).toBe(true)
  })
  it('keeps different companies apart', () => {
    expect(sameEvent(ev('Netflix', 1000), ev('Hasbro, Inc.', 587))).toBe(false)
    expect(sameEvent(ev('Acme Bank', 500), ev('Zeta Bank', 500, new Date('2026-11-30T00:00:00Z')))).toBe(false)
  })
})

describe('audienceFit and rankScore', () => {
  it('sorts national everyday employers above elite tech', () => {
    expect(audienceFit('Kroger’s', null)).toBe('target')
    expect(audienceFit('Hasbro, Inc.', 'Manufacturing')).toBe('target')
    expect(audienceFit('Netflix', null)).toBe('elite')
    expect(audienceFit('Acme Software', 'Software publishers')).toBe('elite')
    expect(audienceFit('Zeta Holdings', null)).toBe('neutral')
  })
  it('does not match a brand inside another word', () => {
    expect(audienceFit('Gaptech Labs', null)).toBe('neutral')
    expect(audienceFit('Targeted Media', null)).toBe('neutral')
  })
  it('ranks a widely covered national employer above a bigger elite-tech filing', () => {
    const kroger = rankScore('two-publishers', 3000, { inCrm: false, publishers: 40, fit: 'target' })
    const netflix = rankScore('warn-filing', 1000, { inCrm: false, publishers: 300, fit: 'elite' })
    expect(kroger).toBeGreaterThan(netflix)
  })
  it('still puts an official filing ahead of a thin news story at the same fit', () => {
    expect(rankScore('warn-filing', 500, { inCrm: false, publishers: 1, fit: 'neutral' })).toBeGreaterThan(rankScore('two-publishers', 500, { inCrm: false, publishers: 2, fit: 'neutral' }))
  })
  it('prefers an employer we know, all else equal', () => {
    expect(rankScore('two-publishers', 500, { inCrm: true, publishers: 5, fit: 'neutral' })).toBeGreaterThan(rankScore('two-publishers', 900, { inCrm: false, publishers: 5, fit: 'neutral' }))
  })
})

describe('farOffTimeline', () => {
  it('flags cuts spread over years and leaves near-term ones alone', () => {
    expect(farOffTimeline(['Volkswagen to cut 35,000 jobs by 2030'], null, now)).toBe('runs to 2030')
    expect(farOffTimeline(['Bank plans to cut 2,500 jobs over the next three years'], null, now)).toBe('spread over the next three years')
    expect(farOffTimeline(['Kroger lays off 3,000 corporate workers'], null, now)).toBeNull()
    expect(farOffTimeline(['Retailer to cut jobs by 2027'], null, now)).toBeNull() // only a year out, 2026 now
    expect(farOffTimeline(['Hasbro layoffs in 2026'], null, now)).toBeNull()
  })
  it('flags a WARN effective date more than six months away', () => {
    expect(farOffTimeline([], new Date('2027-06-01T00:00:00Z'), now)).toMatch(/six months/)
    expect(farOffTimeline([], new Date('2026-12-15T00:00:00Z'), now)).toBeNull()
  })
})

describe('slidesFor', () => {
  const soon = new Date('2026-10-20T15:00:00Z')
  it('opens with the big number and closes with the ask', () => {
    const s = slidesFor(facts(), 'n1', soon)
    expect(s[0]).toMatchObject({ kind: 'cover', big: '500 jobs', name: 'Acme' })
    expect(s[s.length - 1].kind).toBe('cta')
  })
  it('teaches in three steps and adds the market slide only with a real number', () => {
    const s = slidesFor(facts(), 'n1', soon)
    expect(s.filter((x) => x.kind === 'step')).toHaveLength(3)
    expect(s.some((x) => x.kind === 'market')).toBe(true)
    expect(slidesFor(facts({ openRolesInState: null, openSeniorRolesInState: null }), 'n1', soon).some((x) => x.kind === 'market')).toBe(false)
  })
  it('counts the days to the effective date', () => {
    const f = slidesFor(facts({ effectiveDate: '2026-12-15T00:00:00Z' }), 'n1', soon).find((x) => x.kind === 'facts')
    expect(JSON.stringify(f)).toContain('55 days')
  })
  it('keeps every slide within a swipeable length', () => {
    for (const seed of ['a', 'b', 'c', 'd']) expect(slidesFor(facts(), seed, soon).length).toBeLessThanOrEqual(8)
  })
})

describe('market slide and local-market wording', () => {
  const soon = new Date('2026-10-20T15:00:00Z')
  it('leads with all white-collar roles, then manager and above, then remote', () => {
    const m = slidesFor(facts(), 'n1', soon).find((x) => x.kind === 'market')
    expect(m).toMatchObject({ kind: 'market' })
    const stats = (m as { stats: { value: string; label: string }[] }).stats
    expect(stats.map((x) => x.value)).toEqual(['900', '200', '400'])
    expect(stats[0].label).toContain('every level')
    expect(stats[1].label).toContain('manager level or above')
  })
  it('the post text names all roles, the manager share and remote', () => {
    const t = draftText('local-market', facts(), 'n1').body
    expect(t).toContain('900')
    expect(t).toContain('200')
    expect(t).toMatch(/white-collar/)
    expect(t).toMatch(/remote roles are open to anyone/)
    expect(draftText('offer-help', facts(), 'n1').body).not.toMatch(/in TX: .*Harris County, TX/)
  })
  it('still works for drafts made before remote roles were counted', () => {
    const { openRemoteRoles, ...old } = facts()
    void openRemoteRoles
    expect(() => draftText('local-market', old as DraftFacts, 'n1')).not.toThrow()
  })
})

describe('speculation and non-US detection', () => {
  it('reads hedged headlines as speculation only when all of them hedge', () => {
    expect(speculative(['X could cut jobs'])).toBe(true)
    expect(speculative(['X lays off 500', 'X could cut more'])).toBe(false)
    expect(speculative([])).toBe(false)
  })
  it('flags coverage about somewhere else, unless it mentions the US', () => {
    expect(looksNonUs(['NAB to cut 2,500 jobs in Australia'])).toBe(true)
    expect(looksNonUs(['Telia lays off 900 in Sweden'])).toBe(true)
    expect(looksNonUs(['Kroger lays off 3,000 corporate workers'])).toBe(false)
    expect(looksNonUs(['Canadian bank cuts jobs in Canada and Ohio'])).toBe(false)
    expect(looksNonUs(['Siemens cuts jobs in Germany and the US'])).toBe(false)
    expect(looksNonUs(['Layoffs hit Sweden, and the news tells us more'])).toBe(true)
  })
})


describe('newer angles', () => {
  const facts: DraftFacts = {
    employer: 'Pfizer', employees: 330, percent: null, place: 'NY', state: 'NY', noticeDate: null, effectiveDate: null, industry: null, sourceUrl: null, credibility: 'warn-filing',
    openRolesInState: 900, openSeniorRolesInState: 300, openRemoteRoles: 50, tagSuggestions: [],
    hiringNearby: [{ name: 'Northwell Health', roles: 120 }, { name: 'Mastercard', roles: 80 }],
    otherLayoffs: [{ employer: 'Levi Strauss', employees: 303 }],
  }
  it('offers the hiring and roundup angles only when there is something to say', () => {
    expect(eligibleAngles(facts)).toEqual(expect.arrayContaining(['company-offer', 'hiring-nearby', 'also-this-week', 'long-search', 'comment-for-plan']))
    const bare = { ...facts, hiringNearby: [], otherLayoffs: [] }
    expect(eligibleAngles(bare)).not.toContain('hiring-nearby')
    expect(eligibleAngles(bare)).not.toContain('also-this-week')
  })
  it('names the other companies in the roundup and the hiring post', () => {
    expect(draftText('also-this-week', facts, 'a').body).toContain('Levi Strauss')
    expect(draftText('hiring-nearby', facts, 'a').body).toContain('Northwell Health')
  })
  it('the company offer names the company and promises counts, never names', () => {
    const t = draftText('company-offer', facts, 'a').body
    expect(t).toContain('Pfizer')
    expect(t).toMatch(/never names/)
  })
})
