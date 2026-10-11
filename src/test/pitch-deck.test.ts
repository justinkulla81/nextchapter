import { describe, it, expect } from 'vitest'
import { defaultRuleSet } from '@/lib/pitch/defaults'
import { mergeRuleSet } from '@/lib/pitch/store'
import { buildDeck, type AreaInput } from '@/lib/pitch/build'
import { ensureReadable, contrastWithWhite } from '@/lib/pitch/brand'
import { CUSTOMER_TYPES } from '@/lib/pitch/types'

const brand = { orgName: 'Acme EDO', primary: '#2e7d5b', accent: '#0b2545' }
const area = (over: Partial<AreaInput> = {}): AreaInput => ({
  id: '21111', name: 'Jefferson County', state: 'KY', level: 'COUNTY', population: 777392, unemploymentRate: 4.3, unemploymentRatePrior: 4.3, unemploymentAsOf: '2026-08',
  medianHouseholdIncome: 67849, perCapitaIncome: 41267, whiteCollarShare: 0.41, wcUnemploymentEst: 2.8, bcUnemploymentEst: 5.3, layoffs12mo: 1200, layoffEvents12mo: 6, layoffs90d: 300,
  higherEdCount: 1, higherEd: [{ name: 'U of L', control: 'Public', level: '4-year', size: '20,000+' }], dataCenterCount: 0, dataCenters: [], wioaBoards: [], majorEmployers: [], initiatives: null, news: [], ...over,
})

describe('pitch rules', () => {
  it('every customer type has a default rule set with a cover and an ask', () => {
    for (const t of CUSTOMER_TYPES) {
      const r = defaultRuleSet(t)
      expect(r.slides.find((s) => s.id === 'cover')).toBeTruthy()
      expect(r.slides.find((s) => s.id === 'next')?.bullets.length).toBeGreaterThan(0)
    }
  })
  it('a switched-off slide never appears in a deck', () => {
    const rules = defaultRuleSet('ECON_DEV')
    rules.slides.find((s) => s.id === 'why-now')!.enabled = false
    const deck = buildDeck({ rules, brand, area: area() })
    expect(deck.slides.some((s) => s.id === 'why-now')).toBe(false)
  })
  it('a saved edit overrides the default text, and new default slides still appear', () => {
    const d = defaultRuleSet('CHAMBER')
    const saved = { ...d, slides: d.slides.filter((s) => s.id !== 'a-news').map((s) => (s.id === 'problem' ? { ...s, bullets: ['Custom line'] } : s)) }
    const merged = mergeRuleSet('CHAMBER', saved)
    expect(merged.slides.find((s) => s.id === 'problem')?.bullets).toEqual(['Custom line'])
    expect(merged.slides.some((s) => s.id === 'a-news')).toBe(true)
  })
  it('a generic deck has no local-data slides', () => {
    const deck = buildDeck({ rules: defaultRuleSet('ECON_DEV'), brand, area: null })
    expect(deck.generic).toBe(true)
    expect(deck.slides.some((s) => s.id === 'local-data' || s.id.startsWith('a-warn'))).toBe(false)
  })
  it('never states "0 workers" when an area has no layoff filings; warns instead', () => {
    const deck = buildDeck({ rules: defaultRuleSet('ECON_DEV'), brand, area: area({ layoffs12mo: 0, layoffs90d: 0, layoffEvents12mo: 0 }) })
    const text = deck.slides.flatMap((s) => [...s.bullets, ...(s.facts ?? []).map((f) => f.value)]).join(' ')
    expect(text).not.toMatch(/\b0 workers\b/)
    expect(deck.warnings.some((w) => /No layoff filings/.test(w))).toBe(true)
  })
  it('shows no price anywhere and does not warn about one', () => {
    const deck = buildDeck({ rules: defaultRuleSet('HIGHER_ED'), brand, area: area() })
    expect(deck.warnings.some((w) => /price/i.test(w))).toBe(false)
    const text = JSON.stringify(deck.slides.map((x) => ({ b: x.bullets, p: x.packages, o: x.offer, t: x.title })))
    expect(text).not.toMatch(/\$\d|per seat|pricing/i)
  })
  it('keeps the higher-ed confirm-what-is-live reminder as a warning', () => {
    const deck = buildDeck({ rules: defaultRuleSet('HIGHER_ED'), brand, area: area() })
    expect(deck.warnings.some((w) => /Confirm which screens/.test(w))).toBe(true)
  })
  it('every type offers packages and at least one tailored demo screen (recruiter and others differ)', () => {
    const frames = new Set<string>()
    for (const t of CUSTOMER_TYPES) {
      const r = defaultRuleSet(t)
      expect(r.packages.length).toBeGreaterThanOrEqual(3)
      const deck = buildDeck({ rules: r, brand, area: area() })
      const demos = deck.slides.filter((s) => s.kind === 'demo')
      expect(demos.length).toBeGreaterThan(0)
      demos.forEach((d) => { expect(d.demo!.rows.length).toBeGreaterThan(0); frames.add(d.demo!.frame) })
    }
    expect(frames.size).toBeGreaterThanOrEqual(CUSTOMER_TYPES.length)
  })
  it('higher ed speaks to alumni, career services, alumni relations, development, employers and leadership', () => {
    const deck = buildDeck({ rules: defaultRuleSet('HIGHER_ED'), brand, area: area() })
    const who = deck.slides.find((s) => s.kind === 'constituents')!
    const names = who.rows!.map((r) => r[0].toLowerCase())
    for (const n of ['alumni', 'career services', 'alumni relations', 'development', 'employer relations', 'institution leadership']) expect(names.some((x) => x.includes(n))).toBe(true)
  })
  it('switching an audience slide off removes it from the audience table too', () => {
    const rules = defaultRuleSet('HIGHER_ED')
    rules.slides.find((s) => s.id === 'c-development')!.enabled = false
    const deck = buildDeck({ rules, brand, area: area() })
    expect(deck.slides.some((s) => s.id === 'c-development')).toBe(false)
    expect(deck.slides.find((s) => s.kind === 'constituents')!.rows!.some((r) => /development/i.test(r[0]))).toBe(false)
  })
  it('the main deck stays between 18 and 30 slides for every type', () => {
    for (const t of CUSTOMER_TYPES) {
      const deck = buildDeck({ rules: defaultRuleSet(t), brand, area: t === 'RECRUITER' ? null : area() })
      const main = deck.slides.filter((s) => !s.appendix).length
      expect(main).toBeGreaterThanOrEqual(18)
      expect(main).toBeLessThanOrEqual(30)
    }
  })
  it('the security slide is off until there is something to say, and no [ADD] placeholder reaches a default deck', () => {
    const deck = buildDeck({ rules: defaultRuleSet('ECON_DEV'), brand, area: area() })
    expect(deck.slides.some((s) => s.id === 'a-security')).toBe(false)
    expect(deck.warnings.some((w) => w.includes('[ADD:'))).toBe(false)
  })
  it('drops the team slide when nobody is picked', () => {
    const deck = buildDeck({ rules: defaultRuleSet('HIGHER_ED'), brand, area: area(), people: [] })
    expect(deck.slides.some((s) => s.kind === 'people')).toBe(false)
  })
})

describe('workforce board choice', () => {
  it('names the local board, not the statewide one, when both are attached', async () => {
    const { localFirst } = await import('@/lib/geo/filters')
    const boards = [{ name: 'Kentucky Workforce Innovation Board', statewide: true }, { name: 'Greater Louisville Workforce Development Board', statewide: false }]
    expect(localFirst(boards)[0].name).toBe('Greater Louisville Workforce Development Board')
  })
})

describe('deck colors', () => {
  it('darkens a too-light color until white text passes AA', () => {
    expect(contrastWithWhite(ensureReadable('#ffd100'))).toBeGreaterThanOrEqual(4.5)
  })
  it('leaves a readable color alone and rejects junk', () => {
    expect(ensureReadable('#2e7d5b')).toBe('#2e7d5b')
    expect(ensureReadable('not a color')).toBe('#2e7d5b')
  })
})
