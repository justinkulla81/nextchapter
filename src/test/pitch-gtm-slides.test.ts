import { describe, it, expect } from 'vitest'
import { defaultRuleSet } from '@/lib/pitch/defaults'
import { mergeRuleSet } from '@/lib/pitch/store'
import { buildDeck, type AreaInput } from '@/lib/pitch/build'
import { CUSTOMER_TYPES } from '@/lib/pitch/types'

// September 2026 Employment Report go-to-market slides: mid-career alumni
// (higher ed), "next to WIOA, not against it", and employer AI-layoff
// disclosure readiness. Figures are quoted from the report; see report-facts.ts.

const brand = { orgName: 'Acme', primary: '#2e7d5b', accent: '#0b2545' }
const area = (over: Partial<AreaInput> = {}): AreaInput => ({
  id: '21111', name: 'Jefferson County', state: 'KY', level: 'COUNTY', population: 777392, unemploymentRate: 4.3, unemploymentRatePrior: 4.3, unemploymentAsOf: '2026-08',
  medianHouseholdIncome: 67849, perCapitaIncome: 41267, whiteCollarShare: 0.41, wcUnemploymentEst: 2.8, bcUnemploymentEst: 5.3, layoffs12mo: 1200, layoffEvents12mo: 6, layoffs90d: 300,
  higherEdCount: 1, higherEd: [], dataCenterCount: 0, dataCenters: [], wioaBoards: [], majorEmployers: [], initiatives: null, news: [], ...over,
})
const textOf = (d: ReturnType<typeof buildDeck>, id: string) => {
  const s = d.slides.find((x) => x.id === id)!
  return [s.title, ...s.bullets, ...(s.facts ?? []).flatMap((f) => [f.label, f.value, f.note ?? ''])].join(' ')
}

describe('mid-career alumni slide (higher ed)', () => {
  it('quotes the report figures with a source and no price', () => {
    const deck = buildDeck({ rules: defaultRuleSet('HIGHER_ED'), brand, area: area() })
    const s = deck.slides.find((x) => x.id === 'h-midcareer')!
    expect(s.kind).toBe('stats')
    expect(s.facts!.map((f) => f.value)).toEqual(['0.88%', '0.83%', '1.02%', '+1.5 pts'])
    expect(textOf(deck, 'h-midcareer')).toMatch(/0\.57%/)
    expect(s.source).toMatch(/Ch\. 06 Exhibit 19 \(p\. 15\)/)
    expect(s.source).toMatch(/NextChapter calculation from Census CPS microdata/)
    expect(JSON.stringify([s.bullets, s.title])).not.toMatch(/\$\d|per seat|pricing/i)
    expect(s.bullets.join(' ')).toMatch(/Career, Advancement and Institution/)
  })
  it('sits in the Data section and still works in a generic deck', () => {
    const deck = buildDeck({ rules: defaultRuleSet('HIGHER_ED'), brand, area: null })
    const s = deck.slides.find((x) => x.id === 'h-midcareer')!
    expect(s.section).toBe('Data')
    expect(s.facts).toHaveLength(4)
  })
})

describe('next to WIOA, not against it', () => {
  const types = ['WIOA_BOARD', 'ECON_DEV', 'WORKFORCE_NONPROFIT', 'HIGHER_ED'] as const
  it('is in the board, economic development, nonprofit and higher-ed decks with the Exhibit 32 numbers', () => {
    for (const t of types) {
      const deck = buildDeck({ rules: defaultRuleSet(t), brand, area: area() })
      const s = deck.slides.find((x) => x.id === 'w-wioa')
      expect(s, t).toBeTruthy()
      expect(s!.facts!.map((f) => f.value)).toEqual(expect.arrayContaining(['$1.396B', '187,108', '37,119']))
      expect(s!.bullets.join(' ')).toMatch(/Individual Training Accounts and on-the-job training/)
      expect(s!.bullets.join(' ')).toMatch(/1 in 5/)
      expect(s!.source).toMatch(/Exhibit 32 \(p\. 25\)/)
    }
  })
  it('leaves the slide out of the types it does not fit', () => {
    for (const t of CUSTOMER_TYPES.filter((x) => !(types as readonly string[]).includes(x))) {
      expect(defaultRuleSet(t).slides.some((s) => s.id === 'w-wioa')).toBe(false)
    }
  })
  it('puts the higher-ed version in the appendix and the rest in the main deck', () => {
    const he = buildDeck({ rules: defaultRuleSet('HIGHER_ED'), brand, area: area() })
    expect(he.slides.find((x) => x.id === 'w-wioa')!.appendix).toBe(true)
    const board = buildDeck({ rules: defaultRuleSet('WIOA_BOARD'), brand, area: area() })
    expect(board.slides.find((x) => x.id === 'w-wioa')!.appendix).toBeFalsy()
  })
  it('never prints a zero or a made-up board number, and shows no price', () => {
    for (const t of types) {
      const deck = buildDeck({ rules: defaultRuleSet(t), brand, area: area() })
      expect(deck.slides.find((x) => x.id === 'w-wioa')!.bullets.join(' ')).not.toMatch(/\b0\b|\$\d/)
      expect(deck.warnings.some((w) => /never show a zero/.test(w))).toBe(true)
    }
  })
})

describe('employer AI-layoff disclosure readiness', () => {
  const deck = buildDeck({ rules: defaultRuleSet('OUTPLACEMENT_EMPLOYER'), brand, area: area() })
  it('states the report facts with chapters, and the offer', () => {
    const rules = textOf(deck, 'e-ai-rules')
    expect(rules).toMatch(/SB 951/)
    expect(rules).toMatch(/January 1, 2027/)
    expect(rules).toMatch(/AI-Related Job Impacts Clarity Act/)
    expect(deck.slides.find((x) => x.id === 'e-ai-rules')!.source).toMatch(/Ch\. 03 \(p\. 9\)/)
    expect(textOf(deck, 'e-disclosure')).toMatch(/disclosure-ready summary/)
  })
  it('prints a counsel-review note on all three slides and repeats it in the warnings', () => {
    for (const id of ['e-ai-rules', 'e-disclosure', 'a-ai-rules']) {
      expect(deck.slides.find((x) => x.id === id)!.callout, id).toMatch(/^Counsel review required/)
    }
    expect(deck.warnings.filter((w) => /Counsel review required/.test(w))).toHaveLength(3)
    expect(deck.warnings.some((w) => /counsel review is required before any use/.test(w))).toBe(true)
  })
  it('keeps the optional appendix after the main close, with the dates, and makes no guarantee or legal conclusion', () => {
    const idx = (id: string) => deck.slides.findIndex((x) => x.id === id)
    expect(deck.slides[idx('a-ai-rules')].appendix).toBe(true)
    expect(idx('a-ai-rules')).toBeGreaterThan(idx('next'))
    const text = ['e-ai-rules', 'e-disclosure', 'a-ai-rules'].map((id) => textOf(deck, id)).join(' ')
    expect(text).toMatch(/SB 947/)
    expect(text).toMatch(/Connecticut SB 5/)
    expect(text).toMatch(/October 26/)
    expect(text).not.toMatch(/guarantee|ensure compliance|you must|will keep you compliant|\$\d/i)
  })
  it('cannot lose the note when a saved rule set overrides the slide text', () => {
    const d = defaultRuleSet('OUTPLACEMENT_EMPLOYER')
    const saved = { ...d, slides: d.slides.map((s) => (s.id === 'e-ai-rules' ? { ...s, callout: undefined, bullets: ['Edited'] } : s)) }
    const merged = mergeRuleSet('OUTPLACEMENT_EMPLOYER', saved)
    expect(merged.slides.find((s) => s.id === 'e-ai-rules')!.callout).toMatch(/^Counsel review required/)
  })
})

describe('new default slides in a saved rule set', () => {
  it('land after the slide that precedes them, not behind the appendix', () => {
    const d = defaultRuleSet('ECON_DEV')
    const saved = { ...d, slides: d.slides.filter((s) => s.id !== 'w-wioa') }
    const merged = mergeRuleSet('ECON_DEV', saved)
    const ids = merged.slides.map((s) => s.id)
    expect(ids.indexOf('w-wioa')).toBe(ids.indexOf('fit') + 1)
  })
})
