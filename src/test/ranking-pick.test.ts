import { describe, expect, it } from 'vitest'
import { pickRanking, plainPlaceName, rankingSentenceHtml, type AreaPlace } from '@/lib/org-claims/ranking-pick'
import { escapeHtml } from '@/lib/mailing/render'
import type { PlaceRank, RankingIndexEntry } from '@/lib/rankings/types'

const idx = (slug: string, scopeKind: RankingIndexEntry['scopeKind']): RankingIndexEntry =>
  ({ slug, edition: '2026-11', title: slug, family: 'x', measure: 'x' as never, scopeKind, scopeId: '', scopeName: '', topName: '', topValueLabel: '', places: 100, editions: ['2026-11'] })
const r = (slug: string, title: string, rank: number, places = 100): PlaceRank => ({ slug, title, rank, places, valueLabel: '' })

const area: AreaPlace[] = [
  { key: '37101', name: 'Johnston County', level: 'county' },
  { key: 'NC|smithfield', name: 'Smithfield town', level: 'city' },
]
const index = [idx('fastest-growing-job-markets', 'national'), idx('junior-se', 'region'), idx('conf', 'national'), idx('short', 'national')]

describe('pickRanking', () => {
  it('prefers a national top-10 placing over a better regional one', () => {
    const ranks = { '37101': [r('fastest-growing-job-markets', 'Fastest-growing job markets', 2)], 'NC|smithfield': [r('junior-se', 'Best cities for junior jobs in the Southeast', 1)] }
    expect(pickRanking(area, ranks, index)).toMatchObject({ place: 'Johnston County', rank: 2, scope: 'national' })
  })
  it('takes a regional placing only in its top 3, and strips the Census kind from a city name', () => {
    expect(pickRanking(area, { 'NC|smithfield': [r('junior-se', 'Best cities for junior jobs in the Southeast', 4)] }, index)).toBeNull()
    expect(pickRanking(area, { 'NC|smithfield': [r('junior-se', 'Best cities for junior jobs in the Southeast', 3)] }, index)).toMatchObject({ place: 'Smithfield', rank: 3 })
  })
  it('skips conference lists, short lists and places outside the area', () => {
    const ranks = { '37101': [r('conf', 'Cities hosting the most business conferences', 1), r('short', 'Best cities for HR jobs', 1, 12)], '99999': [r('fastest-growing-job-markets', 'Fastest-growing job markets', 1)] }
    expect(pickRanking(area, ranks, index)).toBeNull()
  })
})

describe('rankingSentenceHtml', () => {
  it('writes one sentence with the list linked', () => {
    const pick = pickRanking(area, { '37101': [r('fastest-growing-job-markets', 'Fastest-growing job markets', 2)] }, index)
    expect(rankingSentenceHtml(pick, escapeHtml)).toBe('Johnston County is #2 of 100 on NextChapter&#39;s November 2026 list of the <a href="https://launchyournextchapter.com/rankings/fastest-growing-job-markets">fastest-growing job markets</a>.')
    expect(rankingSentenceHtml(null, escapeHtml)).toBe('')
  })
  it('keeps proper nouns in the title', () => {
    expect(plainPlaceName('Indianapolis city (balance)')).toBe('Indianapolis')
    expect(plainPlaceName('Exton CDP')).toBe('Exton')
  })
})
