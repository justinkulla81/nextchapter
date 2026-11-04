import { describe, expect, it } from 'vitest'
import { layoffNewsItems, newsWindowStart } from '@/lib/seo/layoff-news-items'

const NOW = Date.parse('2026-11-04T05:00:00Z')
const day = (iso: string) => new Date(`${iso}T00:00:00Z`)
const opts = { now: NOW, meetsBar: () => true, stateName: (c: string) => (c === 'FL' ? 'Florida' : c) }
const company = (slug: string, latest: string, states = ['FL']) => ({ slug, name: slug.toUpperCase(), latest: day(latest), states, notices: [{ workers: 50 }] })

describe('layoffNewsItems', () => {
  it('starts the window at the beginning of the UTC day two days ago', () => {
    expect(new Date(newsWindowStart(NOW)).toISOString()).toBe('2026-11-02T00:00:00.000Z')
  })
  it('keeps a filing dated two days ago even though midnight is more than 48 hours back', () => {
    const out = layoffNewsItems([company('geico', '2026-11-02'), company('old', '2026-11-01')], [], opts)
    expect(out.map((i) => i.slug)).toEqual(['geico'])
    expect(out[0].title).toBe('GEICO layoff notice in Florida')
  })
  it('adds announcements that have no filing, labelled as reports or buyouts', () => {
    const out = layoffNewsItems([], [{ slug: 'fiserv', name: 'Fiserv', latest: day('2026-11-03') }, { slug: 'acme', name: 'Acme', latest: day('2026-11-03'), buyout: true }], opts)
    expect(out.map((i) => i.title)).toEqual(['Acme: buyout offered', 'Fiserv: layoffs reported'])
  })
  it('lists a company once, using the newer of its filing and its announcement', () => {
    const out = layoffNewsItems([company('x', '2026-11-02')], [{ slug: 'x', name: 'X', latest: day('2026-11-03') }], opts)
    expect(out).toHaveLength(1)
    expect(out[0].title).toBe('X: layoffs reported')
  })
  it('skips filings below the page bar, future dates and dates before the window', () => {
    const out = layoffNewsItems([company('thin', '2026-11-03'), company('future', '2026-11-09')], [{ slug: 'ann-old', name: 'Old', latest: day('2026-10-30') }], { ...opts, meetsBar: (c) => c.slug !== 'thin' })
    expect(out).toEqual([])
  })
  it('sorts newest first and caps at the limit', () => {
    const out = layoffNewsItems([company('a', '2026-11-02'), company('b', '2026-11-04'), company('c', '2026-11-03')], [], { ...opts, limit: 2 })
    expect(out.map((i) => i.slug)).toEqual(['b', 'c'])
  })
})
