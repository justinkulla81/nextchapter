import { describe, expect, it } from 'vitest'
import { renderedTitle, titleMeta, trimTitle } from '@/lib/seo/title'

describe('titles', () => {
  it('keeps the brand when the whole title fits in 60', () => {
    expect(titleMeta('Kentucky Layoffs: WARN Notices')).toBe('Kentucky Layoffs: WARN Notices')
    expect(renderedTitle('Kentucky Layoffs: WARN Notices')).toBe('Kentucky Layoffs: WARN Notices | NextChapter')
  })
  it('drops the brand and trims at a break when it does not', () => {
    const long = 'National Council of State Housing Agencies: conferences, dates and speaking opportunities'
    const t = titleMeta(long) as { absolute: string }
    expect(t.absolute.length).toBeLessThanOrEqual(60)
    expect(t.absolute.startsWith('National Council of State Housing Agencies')).toBe(true)
    expect(t.absolute.endsWith('…')).toBe(false)
  })
  it('never ends mid-word and never exceeds 60', () => {
    for (const s of ['Matanuska-Susitna Borough, AK Jobs, Unemployment and Layoffs', 'Upper Cumberland Local Workforce Development Board , Inc.: Counties and Job Centers, TN', 'x'.repeat(90)]) {
      expect(renderedTitle(s).length).toBeLessThanOrEqual(60)
    }
    const r = trimTitle('Southern Alleghenies Workforce Development Board: Counties and Job Centers, PA')
    expect(r.length).toBeLessThanOrEqual(60)
    expect(r.startsWith('Southern Alleghenies Workforce Development Board')).toBe(true)
    expect(trimTitle('Ragan Communications: conferences, dates and speaking opportunities')).toBe('Ragan Communications: conferences, dates')
  })
})

import { KEYWORD_CLUSTERS } from '@/lib/seo/keywords'
describe('keyword-map titles', () => {
  it('every owner page title shows in 60 characters or fewer', () => {
    const long = KEYWORD_CLUSTERS.filter((c) => c.seo?.title && renderedTitle(c.seo.title).length > 60).map((c) => c.owner)
    expect(long).toEqual([])
  })
  it('no title is cut with an ellipsis', () => {
    const cut = KEYWORD_CLUSTERS.filter((c) => c.seo?.title && renderedTitle(c.seo.title).endsWith('…')).map((c) => c.owner)
    expect(cut).toEqual([])
  })
})
