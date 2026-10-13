import { describe, expect, it } from 'vitest'
import { buildDeck } from '@/lib/pitch/build'
import { defaultRuleSet } from '@/lib/pitch/defaults'
import { computePriority, FUNDING_WEIGHT } from '@/lib/crm/scoring'
import { nextCloseAmong } from '@/lib/funding-opportunities/eligibility'

const NOW = new Date('2026-10-13T12:00:00Z')
const brand = { orgName: 'State University', primary: '#2e7d5b', accent: '#111111' }
const grant = (over = {}) => ({
  title: 'Dislocated Worker Grant', agency: 'Employment and Training Administration',
  closesAt: new Date('2026-11-15'), eligibility: 'VIA_PARTNER' as const, url: 'https://www.grants.gov/search-results-detail/1', ...over,
})

describe('funding slide', () => {
  it('is in the higher-ed and economic development defaults', () => {
    for (const t of ['HIGHER_ED', 'ECON_DEV'] as const) {
      expect(defaultRuleSet(t).slides.some((s) => s.id === 'f-funding' && s.kind === 'funding')).toBe(true)
    }
  })
  it('lists grants with how to pursue each', () => {
    const deck = buildDeck({ rules: defaultRuleSet('HIGHER_ED'), brand, area: null, funding: [grant(), grant({ eligibility: 'DIRECT', title: 'Open grant' })], now: NOW })
    const s = deck.slides.find((x) => x.id === 'f-funding')!
    expect(s.rows).toHaveLength(2)
    expect(s.rows![0][3]).toBe('You apply, NextChapter delivers')
    expect(s.rows![1][3]).toBe('Apply directly')
  })
  it('drops the slide when nothing is open rather than showing an empty table', () => {
    const deck = buildDeck({ rules: defaultRuleSet('HIGHER_ED'), brand, area: null, funding: [], now: NOW })
    expect(deck.slides.some((x) => x.id === 'f-funding')).toBe(false)
  })
})

describe('funding in rank', () => {
  const base = {
    quality: 'B' as const, eligibility: 'NOT_APPLICABLE' as const, warmPath: 0.6, nextDueAt: null,
    committedFollowUpAt: null, stageProgress: 0.3, lastTouchedAt: NOW, createdAt: NOW, now: NOW,
  }
  it('adds a smaller signal than the org’s own deadline when a matched grant closes soon', () => {
    const none = computePriority(base)
    const soon = computePriority({ ...base, fundingCloseAt: new Date('2026-10-25') })
    const own = computePriority({ ...base, nextDueAt: new Date('2026-10-25') })
    expect(soon.score - none.score).toBeCloseTo(FUNDING_WEIGHT, 1)
    expect(own.score).toBeGreaterThan(soon.score)
  })
  it('adds nothing for a grant far off or none at all', () => {
    expect(computePriority({ ...base, fundingCloseAt: new Date('2027-06-01') }).funding).toBe(0)
    expect(computePriority({ ...base, fundingCloseAt: null }).funding).toBe(0)
  })
  it('takes the soonest real close inside the window', () => {
    const d = nextCloseAmong([{ closesAt: new Date('2026-12-01') }, { closesAt: new Date('2026-10-30') }, { closesAt: null }, { closesAt: new Date('2026-10-01') }], NOW)
    expect(d?.toISOString().slice(0, 10)).toBe('2026-10-30')
  })
})
