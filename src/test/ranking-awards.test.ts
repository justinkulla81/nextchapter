import { describe, expect, it } from 'vitest'
import { AWARD_MONTHS, awardEntries, awardTier, bucketOf, familyLists, familyOfRanking, groupByMonth, mergeAwards, viewAwards, archiveMonths, type Award } from '@/lib/rankings/awards'
import { cityAwardKeys, placeFromLocation } from '@/lib/rankings/place-keys'
import type { RankingIndexEntry } from '@/lib/rankings/types'

const row = (rank: number, key: string) => ({ rank, key, name: key, sub: 'TX', href: null, value: 1 / rank, valueLabel: `${rank}%`, stats: [], employers: [], change: null, n: 100 })
const ed = (slug: string, edition: string, keys: string[], placeNoun: 'cities' | 'counties' | 'skills' = 'cities') => ({ slug, edition, placeNoun, rows: keys.map((k, i) => row(i + 1, k)) })
const entry = (slug: string, edition: string, extra: Partial<RankingIndexEntry> = {}): RankingIndexEntry => ({
  slug, edition, title: `Title ${slug}`, family: 'Entry-level', measure: 'junior', scopeKind: 'national', scopeId: 'us', scopeName: 'United States', topName: 'Austin', topValueLabel: '9%', places: 50, editions: [edition], ...extra,
})

describe('awards', () => {
  it('gives awards to the top 25 cities and counties, not to skills', () => {
    const keys = Array.from({ length: 40 }, (_, i) => `TX|c${i}`)
    expect(awardEntries(ed('a', '2026-10', keys))).toHaveLength(25)
    expect(awardEntries(ed('a', '2026-10', keys, 'counties'))).toHaveLength(25)
    expect(awardEntries(ed('a', '2026-10', keys, 'skills'))).toEqual([])
    const first = awardEntries(ed('a', '2026-10', keys))[0]
    expect(first[0]).toBe('TX|c0')
    expect(first[1]).toMatchObject({ slug: 'a', edition: '2026-10', rank: 1, places: 40 })
  })

  it('keeps every month and lets a rebuilt month replace its earlier placings', () => {
    let book = mergeAwards({}, awardEntries(ed('a', '2026-09', ['TX|austin', 'TX|dallas'])))
    book = mergeAwards(book, awardEntries(ed('a', '2026-10', ['TX|dallas', 'TX|austin'])))
    expect(book['TX|austin'].map((a) => [a.edition, a.rank])).toEqual([['2026-10', 2], ['2026-09', 1]])
    // October is rebuilt and Austin falls out: its October award goes, September stays.
    book = mergeAwards(book, awardEntries(ed('a', '2026-10', ['TX|dallas'])))
    expect(book['TX|austin'].map((a) => a.edition)).toEqual(['2026-09'])
    expect(book['TX|dallas']).toHaveLength(2)
  })

  it('drops months older than the window', () => {
    let book: Record<string, Award[]> = {}
    for (let m = 0; m < AWARD_MONTHS + 3; m++) {
      const d = new Date(Date.UTC(2024, m, 1))
      const edition = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
      book = mergeAwards(book, awardEntries(ed('a', edition, ['TX|austin'])))
    }
    expect(book['TX|austin']).toHaveLength(AWARD_MONTHS)
  })

  it('titles and links an award: the newest month at the ranking address, older months at their dated address', () => {
    const index = [entry('best-junior', '2026-10', { editions: ['2026-10', '2026-09'] })]
    const views = viewAwards([
      { slug: 'best-junior', edition: '2026-09', rank: 3, valueLabel: '8%', places: 50 },
      { slug: 'best-junior', edition: '2026-10', rank: 4, valueLabel: '9%', places: 50 },
      { slug: 'gone', edition: '2026-10', rank: 1, valueLabel: '1%', places: 5 },
    ], index)
    expect(views.map((v) => [v.month, v.rank, v.href])).toEqual([
      ['October 2026', 4, '/rankings/best-junior'],
      ['September 2026', 3, '/rankings/best-junior/2026-09'],
    ])
    expect(groupByMonth(views).map((m) => m.edition)).toEqual(['2026-10', '2026-09'])
  })

  it('spreads keys over the buckets the same way each time', () => {
    expect(bucketOf('TX|austin')).toBe(bucketOf('TX|austin'))
    expect(bucketOf('01001')).toBeLessThan(32)
  })

  it('tiers ranks for colour', () => {
    expect([1, 3, 4, 10, 11, 25].map(awardTier)).toEqual(['podium', 'podium', 'top10', 'top10', 'top25', 'top25'])
  })
})

describe('job families', () => {
  const index = [
    entry('best-cities-for-marketing-jobs', '2026-10', { measure: 'fnopen', family: 'Job families' }),
    entry('best-cities-for-marketing-pay-vs-cost-of-living', '2026-10', { measure: 'fnpay', family: 'Job families' }),
    entry('ai-tools-named-in-marketing-jobs', '2026-10', { measure: 'aitools', family: 'AI skills' }),
    entry('ai-skills-most-requested-in-marketing-jobs', '2026-10', { measure: 'aiskills', family: 'AI skills' }),
    entry('most-requested-ai-skills', '2026-10', { measure: 'aiskills', family: 'AI skills' }),
    entry('best-cities-for-software-engineering-jobs', '2026-10', { measure: 'swe' }),
    entry('best-cities-for-junior-jobs', '2026-10'),
  ]
  it('matches a list to the family it is about', () => {
    expect(familyOfRanking(index[0])).toBe('Marketing')
    expect(familyOfRanking(index[2])).toBe('Marketing')
    expect(familyOfRanking(index[4])).toBeNull()
    expect(familyOfRanking(index[5])).toBe('Engineering')
    expect(familyOfRanking(index[6])).toBeNull()
  })
  it('lists a family\'s lists, city lists first', () => {
    expect(familyLists(index, 'Marketing').map((x) => x.measure)).toEqual(['fnopen', 'fnpay', 'aiskills', 'aitools'])
    expect(familyLists(index, 'Legal')).toEqual([])
  })
})

describe('archive and place keys', () => {
  it('lists every month once, newest first', () => {
    expect(archiveMonths([entry('a', '2026-10', { editions: ['2026-10', '2026-09'] }), entry('b', '2026-10', { editions: ['2026-10', '2026-08'] })])).toEqual(['2026-10', '2026-09', '2026-08'])
  })
  it('keys a city both ways it may be stored', () => {
    expect(cityAwardKeys('St. Louis', 'MO')).toEqual(['MO|st. louis', 'MO|st louis'])
    expect(cityAwardKeys('Austin', 'TX')).toEqual(['TX|austin'])
    expect(placeFromLocation('Austin, TX')).toEqual({ name: 'Austin, TX', keys: ['TX|austin'] })
    expect(placeFromLocation('Remote')).toBeNull()
  })
})
