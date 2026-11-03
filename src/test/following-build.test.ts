import { describe, expect, it } from 'vitest'
import { buildFollowRow, pickSuggestions, sortFollowRows, parseSort } from '@/lib/following/build'
import type { RankedCompany } from '@/lib/companies/company-ranking'

const ranked = (over: { name?: string; norm?: string; warn?: { filings12mo: number; employeesAffected: number; daysSinceMostRecent: number } | null; band?: 'strong' | 'worth_a_look' | 'long_shot'; reasons?: string[]; onWatchlist?: boolean; roles?: number | null } = {}): RankedCompany =>
  ({
    company: { id: `id-${over.norm ?? 'acme'}`, name: over.name ?? 'Acme', canonicalNameNormalized: over.norm ?? 'acme', warn: over.warn ?? null, onWatchlist: over.onWatchlist ?? false, signalOpenRoles: over.roles ?? null, hqMetro: null },
    ranking: { band: over.band ?? 'strong', reasons: over.reasons ?? ['You have led finance at a company this size.'] },
  }) as unknown as RankedCompany

const entry = (id: string, companyName: string, iso = '2026-11-03T12:00:00Z') => ({ id, companyName, createdAt: new Date(iso) })

describe('buildFollowRow', () => {
  it('puts a recent layoff notice in needs attention, with the numbers it rests on', () => {
    const r = buildFollowRow({ entry: entry('1', 'Intel'), ranked: ranked({ name: 'Intel', norm: 'intel', warn: { filings12mo: 2, employeesAffected: 120, daysSinceMostRecent: 6 } }), newOpenings: 0, openings: 14, layoffHref: '/layoffs/company/intel' })
    expect(r.group).toBe('attention')
    expect(r.verdict).toBe('Layoff notice 6 days ago')
    expect(r.reason).toContain('120 workers named across 2 filings')
    expect(r.primary.href).toBe('/layoffs/company/intel')
  })
  it('treats an old layoff as quiet, not urgent', () => {
    const r = buildFollowRow({ entry: entry('1', 'Intel'), ranked: ranked({ warn: { filings12mo: 1, employeesAffected: 5, daysSinceMostRecent: 200 } }), newOpenings: 0, openings: 0, layoffHref: '/x' })
    expect(r.group).toBe('quiet')
  })
  it('puts new openings in hiring and uses the fit reason', () => {
    const r = buildFollowRow({ entry: entry('1', 'Acme'), ranked: ranked(), newOpenings: 6, openings: 9, layoffHref: '/x' })
    expect(r.group).toBe('hiring')
    expect(r.verdict).toBe('6 new openings')
    expect(r.reason).toBe('You have led finance at a company this size.')
    expect(r.primary.label).toBe('See 6 openings')
  })
  it('does not invent a fit reason for a long shot', () => {
    const r = buildFollowRow({ entry: entry('1', 'Acme'), ranked: ranked({ band: 'long_shot' }), newOpenings: 1, openings: 1, layoffHref: '/x' })
    expect(r.reason).toBe('Posted since you last looked at this company.')
  })
  it('still builds a row for a company we have no record of', () => {
    const r = buildFollowRow({ entry: entry('1', 'Tiny Co'), ranked: null, newOpenings: 0, openings: 0, layoffHref: '/x' })
    expect(r.group).toBe('quiet')
    expect(r.primary.href).toBe('/dashboard/companies?q=Tiny%20Co')
  })
})

describe('sortFollowRows', () => {
  const rows = [
    buildFollowRow({ entry: entry('a', 'Zed', '2026-10-01T00:00:00Z'), ranked: null, newOpenings: 0, openings: 0, layoffHref: '/x' }),
    buildFollowRow({ entry: entry('b', 'Bee', '2026-11-01T00:00:00Z'), ranked: ranked({ warn: { filings12mo: 1, employeesAffected: 1, daysSinceMostRecent: 1 } }), newOpenings: 0, openings: 0, layoffHref: '/x' }),
    buildFollowRow({ entry: entry('c', 'Ace', '2026-10-15T00:00:00Z'), ranked: ranked(), newOpenings: 2, openings: 2, layoffHref: '/x' }),
  ]
  it('needs attention first, then hiring, then quiet', () => expect(sortFollowRows(rows, 'attention').map((r) => r.name)).toEqual(['Bee', 'Ace', 'Zed']))
  it('newest follow first', () => expect(sortFollowRows(rows, 'newest').map((r) => r.name)).toEqual(['Bee', 'Ace', 'Zed']))
  it('A to Z', () => expect(sortFollowRows(rows, 'az').map((r) => r.name)).toEqual(['Ace', 'Bee', 'Zed']))
  it('falls back to needs attention for an unknown sort', () => expect(parseSort('nope')).toBe('attention'))
})

describe('pickSuggestions', () => {
  const list = [
    ranked({ name: 'Eaton', norm: 'eaton', roles: 9 }),
    ranked({ name: 'Followed', norm: 'followed', onWatchlist: true }),
    ranked({ name: 'Hidden', norm: 'hidden' }),
    ranked({ name: 'Long', norm: 'long', band: 'long_shot' }),
    ranked({ name: 'NoReason', norm: 'noreason', reasons: [] }),
    ranked({ name: 'Parker', norm: 'parker' }),
  ]
  it('skips followed, dismissed, long-shot and reason-less companies, and says why for the rest', () => {
    const s = pickSuggestions(list, ['Followed'], new Set(['id-hidden']))
    expect(s.map((x) => x.name)).toEqual(['Eaton', 'Parker'])
    expect(s[0].fact).toBe('9 open roles.')
    expect(s.every((x) => x.reason.length > 0)).toBe(true)
  })
  it('stops at the limit', () => expect(pickSuggestions(list, [], new Set(), 1)).toHaveLength(1))
})
