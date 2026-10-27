import { describe, expect, it } from 'vitest'
import { buildLayoffGuide, guideKind, planningDate, type GuideNotice } from '@/lib/warn/layoff-guide'

const at = (iso: string) => new Date(`${iso}T12:00:00Z`)
const now = at('2026-10-27')
const notice = (over: Partial<GuideNotice> = {}): GuideNotice => ({
  state: 'WA', workers: 100, noticeDate: at('2026-10-20'), noticeDateKnown: true, effectiveDate: at('2026-12-19'), ...over,
})

describe('guideKind', () => {
  it('is a layoff when there are notices and no newer announcement', () => {
    expect(guideKind({ notices: [notice()], announcements: [] })).toBe('layoff')
  })
  it('follows a buyout announced after the latest notice', () => {
    expect(guideKind({ notices: [notice()], announcements: [{ kind: 'buyout', date: at('2026-10-25') }] })).toBe('buyout')
  })
  it('keeps layoff when the buyout was announced before the latest notice', () => {
    expect(guideKind({ notices: [notice()], announcements: [{ kind: 'buyout', date: at('2026-09-01') }] })).toBe('layoff')
  })
  it('uses the announcement alone when there are no notices', () => {
    expect(guideKind({ notices: [], announcements: [{ kind: 'buyout', date: at('2026-10-25') }] })).toBe('buyout')
    expect(guideKind({ notices: [], announcements: [{ kind: 'layoff', date: at('2026-10-25') }] })).toBe('layoff')
  })
})

describe('planningDate', () => {
  it('picks the effective date nearest today inside the window', () => {
    const d = planningDate([notice({ effectiveDate: at('2026-12-19') }), notice({ effectiveDate: at('2026-11-10') })], now)
    expect(d?.toISOString().slice(0, 10)).toBe('2026-11-10')
  })
  it('ignores dates too far back or too far ahead, and missing ones', () => {
    expect(planningDate([notice({ effectiveDate: at('2026-06-01') })], now)).toBeNull()
    expect(planningDate([notice({ effectiveDate: at('2027-03-01') })], now)).toBeNull()
    expect(planningDate([notice({ effectiveDate: null })], now)).toBeNull()
  })
})

describe('buildLayoffGuide', () => {
  it('dates the steps from the effective date and names states with workers', () => {
    const g = buildLayoffGuide({ name: 'Acme', notices: [notice({ workers: 120 }), notice({ workers: 30 })], announcements: [], now })
    expect(g.kind).toBe('layoff')
    expect(g.stepsFrom?.toISOString().slice(0, 10)).toBe('2026-12-19')
    expect(g.steps).toHaveLength(4)
    expect(g.steps[0].date.toISOString().slice(0, 10)).toBe('2026-12-21')
    expect(g.facts.map((f) => f.text)).toContain('WA: 2 notices, naming 150 workers.')
  })
  it('does not state a worker count the filings do not give', () => {
    const g = buildLayoffGuide({ name: 'Acme', notices: [notice({ workers: null })], announcements: [], now })
    expect(g.facts.map((f) => f.text)).toContain('WA: 1 notice.')
  })
  it('adds the New York and New Jersey notice rules only for those states', () => {
    const ny = buildLayoffGuide({ name: 'Acme', notices: [notice({ state: 'NY' })], announcements: [], now })
    expect(ny.stateNotes.map((n) => n.state)).toEqual(['NY'])
    const wa = buildLayoffGuide({ name: 'Acme', notices: [notice()], announcements: [], now })
    expect(wa.stateNotes).toEqual([])
  })
  it('gives a buyout the offer questions and no dated steps or filing counts', () => {
    const g = buildLayoffGuide({ name: 'Acme', notices: [], announcements: [{ kind: 'buyout', date: at('2026-10-25') }], now })
    expect(g.kind).toBe('buyout')
    expect(g.steps).toEqual([])
    expect(g.facts).toEqual([])
    expect(g.questions[0].heading).toBe('The offer')
  })
  it('gives an old filing no step list and no filing counts', () => {
    const g = buildLayoffGuide({ name: 'Acme', notices: [notice({ noticeDate: at('2025-01-10'), effectiveDate: at('2025-03-10') })], announcements: [], now })
    expect(g.steps).toEqual([])
    expect(g.facts).toEqual([])
  })
})

describe('CompanyLayoffGuide', () => {
  it('renders the facts, dated steps, questions and state links', async () => {
    const { renderToStaticMarkup } = await import('react-dom/server')
    const { createElement } = await import('react')
    const { CompanyLayoffGuide } = await import('@/components/layoffs/CompanyLayoffGuide')
    const guide = buildLayoffGuide({ name: 'Acme', notices: [notice({ state: 'NY' })], announcements: [], now })
    const html = renderToStaticMarkup(createElement(CompanyLayoffGuide, { name: 'Acme', guide, states: ['NY'] }))
    expect(html).toContain('If you were affected by the Acme layoffs')
    expect(html).toContain('Dec 19, 2026')
    expect(html).toContain('New York requires covered employers to give 90 days')
    expect(html).toContain('Questions to ask Acme')
    expect(html).toContain('/unemployment-benefits/new-york')
  })
})
