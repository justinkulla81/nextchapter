import { describe, expect, it, vi } from 'vitest'
import type { BenefitProgramRow } from '@/lib/benefits/types'
import { buildLayoffGuide, guideKind, planningDate, type GuideNotice } from '@/lib/warn/layoff-guide'
import { filingFacts, guidePrograms } from '@/lib/warn/layoff-guide-programs'

// The form's server action pulls in the database client; the render test only needs the markup.
vi.mock('@/lib/leads/actions', () => ({ submitJourneyLead: vi.fn() }))

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

describe('scripts and topics', () => {
  it('fills the employer name into the scripts and varies by kind', () => {
    const layoff = buildLayoffGuide({ name: 'Acme', notices: [notice()], announcements: [], now })
    expect(layoff.scripts.map((x) => x.id)).toEqual(['layoff-meeting', 'layoff-ask', 'layoff-network', 'layoff-interview'])
    expect(layoff.scripts.find((x) => x.id === 'layoff-interview')?.text).toContain('Acme reduced its workforce in October 2026')
    const buyout = buildLayoffGuide({ name: 'Acme', notices: [], announcements: [{ kind: 'buyout', date: at('2026-10-25') }], now })
    expect(buyout.scripts.map((x) => x.id)).toEqual(['buyout-receive', 'buyout-ask', 'buyout-network'])
  })
  it('covers FSA, 401(k), non-compete, NDA and company property', () => {
    const g = buildLayoffGuide({ name: 'Acme', notices: [notice()], announcements: [], now })
    const all = g.topics.flatMap((t) => t.items).join(' ')
    for (const word of ['FSA', '401(k)', 'Non-compete', 'Confidentiality (NDA)', 'Non-disparagement', 'laptop']) expect(all).toContain(word)
  })
})

describe('filingFacts', () => {
  it('gives the agency, filing page and benefit limits for a state', () => {
    const [f] = filingFacts(['WA'])
    expect(f.stateName).toBe('Washington')
    expect(f.page).toBe('/unemployment-benefits/washington')
    expect(f.fileUrl).toMatch(/^https:\/\//)
    expect(f.maxWeekly).toBeGreaterThan(0)
  })
  it('skips a state with no data', () => {
    expect(filingFacts(['ZZ'])).toEqual([])
  })
})

describe('guidePrograms', () => {
  const row = (over: Partial<BenefitProgramRow>): BenefitProgramRow => ({
    id: 'x', category: 'SUPPORT', name: 'State final pay', provider: null, scope: 'STATE', state: 'WA', locality: null, amount: '$500', eligibility: null,
    status: 'OPEN', statusNote: null, url: 'https://example.gov/p', segments: [], verified: true, checkedAt: null, source: null, city: null,
    employer: null, employerKey: null, geoAreaId: null, applyUrl: null, ...over,
  })
  it('lists a verified program for the state and none for another state', () => {
    const src = [row({ id: 'a' }), row({ id: 'b', state: 'OR', name: 'Oregon final pay' })]
    const out = guidePrograms({ states: ['WA'], source: src })
    expect(out.map((p) => p.id)).toEqual(['a'])
    expect(out[0].where).toBe('WA')
  })
  it('leaves out a student tax credit that is not about losing a job', () => {
    const src = [row({ id: 'tax', name: 'Lifetime Learning Credit', scope: 'NATIONAL', state: null })]
    expect(guidePrograms({ states: ['WA'], source: src })).toEqual([])
  })
  it('does not list a program written for a group the page cannot know the reader belongs to', () => {
    const src = [row({ id: 'vet', name: 'State continuation for one group', segments: ['veteran'] }), row({ id: 'ok' })]
    expect(guidePrograms({ states: ['WA'], source: src }).map((p) => p.id)).toEqual(['ok'])
  })
  it('leaves out a closed or unverified program', () => {
    const src = [row({ id: 'c', status: 'CLOSED' }), row({ id: 'u', verified: false })]
    expect(guidePrograms({ states: ['WA'], source: src })).toEqual([])
  })
})

describe('CompanyLayoffGuide', () => {
  it('renders the facts, dated steps, filing, scripts, programs and the lead form', async () => {
    const { renderToStaticMarkup } = await import('react-dom/server')
    const { createElement } = await import('react')
    const { CompanyLayoffGuide } = await import('@/components/layoffs/CompanyLayoffGuide')
    const guide = buildLayoffGuide({ name: 'Acme', notices: [notice({ state: 'NY' })], announcements: [], now })
    const html = renderToStaticMarkup(createElement(CompanyLayoffGuide, {
      name: 'Acme', slug: 'acme', guide, states: ['NY'], filing: filingFacts(['NY']),
      programs: [{ id: 'p1', name: 'Transition grant', where: 'NY', amount: '$500', url: 'https://example.gov/p', help: 'support' }],
    }))
    expect(html).toContain('If you were affected by the Acme layoffs')
    expect(html).toContain('Dec 19, 2026')
    expect(html).toContain('New York requires covered employers to give 90 days')
    expect(html).toContain('Questions to ask Acme')
    expect(html).toContain('File for unemployment benefits')
    expect(html).toContain('/unemployment-benefits/new-york')
    expect(html).toContain('Settle these before your last day')
    expect(html).toContain('Transition grant')
    expect(html).toContain('/topics/what-to-say-when-laid-off')
    expect(html).toContain('Make this guide yours')
    expect(html).toContain('layoffs:guide:acme')
  })
})
