import { describe, it, expect } from 'vitest'
import { addSeenAt, downloadEmail, gapIdeas, addWording, gapMatchPrompt, parseGapMatches, wordingsOf, winsFromAwards, winsFromCard } from '@/lib/vision/competitor-sync-core'

const now = new Date('2026-10-25T12:00:00Z')

describe('product gap ideas', () => {
  it('keeps real, new, deduped ideas and skips existing titles', () => {
    expect(gapIdeas(['Resume builder with ATS scoring.', 'resume builder with ats scoring', 'x', 'Skills-based job matching'], ['Skills based job matching'])).toEqual(['Resume builder with ATS scoring'])
  })
  it('adds a competitor to the seen-at line once', () => {
    const b = addSeenAt(null, 'Acme')
    expect(b).toBe('Seen at competitors: Acme')
    expect(addSeenAt(b, 'Globex')).toBe('Seen at competitors: Acme; Globex')
    expect(addSeenAt(b, 'acme')).toBe(b)
    const c = addSeenAt(addSeenAt(null, 'Kuder, Inc.'), 'Kuder, Inc.')
    expect(c).toBe('Seen at competitors: Kuder, Inc.')
  })
})

describe('wins to CRM', () => {
  const a = { awardKey: 'k1', description: 'Career services for dislocated workers', agency: 'Department of Labor', subAgency: 'Employment and Training Administration', amount: 1_200_000, startDate: new Date('2024-01-01'), endDate: new Date('2027-06-30'), url: 'https://www.usaspending.gov/award/1' }
  it('past award gives a dated win and a future end date gives a re-bid date', () => {
    const [w] = winsFromAwards('Acme', [a], now)
    expect(w.buyer).toBe('Employment and Training Administration')
    expect(w.rebidAt?.toISOString().slice(0, 10)).toBe('2027-06-30')
    expect(w.ref).toBe('competitor-win:k1')
  })
  it('an ended contract has no re-bid date', () => expect(winsFromAwards('Acme', [{ ...a, endDate: new Date('2025-01-01') }], now)[0].rebidAt).toBeNull())
  it('card wins need a named buyer; the year dates them', () => {
    const w = winsFromCard('Acme', [{ what: 'State career portal', buyer: 'State of Ohio', year: '2025' }, { what: 'No buyer' }])
    expect(w).toHaveLength(1)
    expect(w[0].when?.getUTCFullYear()).toBe(2025)
  })
})

describe('download email', () => {
  it('lists strengths, weaknesses, gaps and wins, escaped', () => {
    const { subject, html } = downloadEmail({
      name: 'Acme <b>', url: 'https://acme.com', relationship: 'DIRECT', segment: null, positioning: 'Coaching', status: 'ACTIVE', statusNote: null, hq: null, foundedYear: null, headcount: 50,
      fundingRaisedUsd: 12_000_000, lastRound: null, investors: null, revenueNote: null, userCountNote: null, pricingNote: null, keyFeatures: [], customers: [{ name: 'Globex' }],
      wins: [{ what: 'DOL grant', buyer: 'DOL', year: '2025' }], weWin: ['Price'], theyWin: ['Brand'], weNeed: ['Mobile app'], lessons: [], partnerIdea: null, notes: null, sourceUrl: null,
    }, 'https://x/y')
    expect(subject).toContain('Acme')
    expect(html).toContain('Where they are stronger')
    expect(html).toContain('DOL grant — DOL — 2025')
    expect(html).toContain('Mobile app')
    expect(html).not.toContain('<b>')
  })
})

describe('gap matching by meaning', () => {
  it('keeps only in-range, unrepeated matches and real groups', () => {
    const text = 'Here: {"matches":[{"new":0,"existing":1},{"new":0,"existing":0},{"new":9,"existing":1},{"new":1,"existing":"x"}],' +
      '"groups":[{"label":"Cohort-based learning programs","members":[1,2,2]},{"label":"Too few","members":[3]},{"label":"Reuses a matched gap","members":[0,3]}]}'
    const r = parseGapMatches(text, 4, 2)
    expect([...r.matches]).toEqual([[0, 1]])
    expect(r.groups).toEqual([{ label: 'Cohort-based learning programs', members: [1, 2] }])
  })
  it('returns nothing for an unreadable answer', () => {
    expect(parseGapMatches('no json', 3, 3).matches.size).toBe(0)
    expect(parseGapMatches('{bad', 3, 3).groups).toEqual([])
  })
  it('lists existing and new gaps with indices', () => {
    const p = gapMatchPrompt(['A idea here'], [{ title: 'B idea here' }])
    expect(p).toContain('E0\tA idea here')
    expect(p).toContain('N0\tB idea here')
  })
})

describe('absorbed wordings', () => {
  it('records each other wording once and reads them back', () => {
    const b = addWording(addWording('Seen at competitors: Acme', 'Cohort learning'), 'cohort  learning!')
    expect(b).toBe('Seen at competitors: Acme\nAlso worded: Cohort learning')
    expect(wordingsOf(addWording(b, 'Group classes'))).toEqual(['Cohort learning', 'Group classes'])
  })
})
