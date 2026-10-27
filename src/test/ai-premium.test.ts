import { describe, expect, it } from 'vitest'
import {
  CSV_COLUMNS,
  TITLE_FN_MIN_SHARE,
  TITLE_FN_MIN_TAGGED,
  aiIllustration,
  aiPremiumCsv,
  aiPremiumForFunction,
  aiPremiumSentence,
  functionCode,
  modalFunction,
  signedPct,
} from '@/lib/pay/ai-premium'
import type { AiMarketData, AiPremium } from '@/lib/skills/ai-market'

const premium = (over: Partial<AiPremium> = {}): AiPremium => ({ nAi: 400, nBase: 900, medAi: 165_000, medBase: 140_000, rawUsd: 25_000, rawPct: 17.9, ...over })

function market(functions: Record<string, { label: string; n?: number; sharePct?: number; premium?: AiPremium }>): AiMarketData {
  return {
    asOf: '2026-10-26T23:45:50.552Z',
    counts: { live: 0, aiSkill: 0, aiExposed: 0, fullText: 0, twin: 0, excerpt: 0, unread: 0, aiSkillFullText: 0, aiExposedFullText: 0 },
    functions: Object.fromEntries(
      Object.entries(functions).map(([fn, f]) => [fn, { label: f.label, n: f.n ?? 1000, aiSkill: 0, aiExposed: 0, sharePct: f.sharePct ?? 20, exposedPct: 0, premium: f.premium, levels: {}, topItems: [], topTools: [] }]),
    ),
  } as AiMarketData
}

describe('modalFunction', () => {
  it('needs enough tagged listings', () => {
    expect(modalFunction(Array(TITLE_FN_MIN_TAGGED - 1).fill('finance'))).toBeNull()
    expect(modalFunction(Array(TITLE_FN_MIN_TAGGED).fill('finance'))).toBe('finance')
  })
  it('needs a clear majority', () => {
    const fns = [...Array(5).fill('finance'), ...Array(5).fill('operations')]
    expect(modalFunction(fns)).toBeNull()
    const mostly = [...Array(7).fill('finance'), ...Array(3).fill('operations')]
    expect(7 / 10).toBeGreaterThanOrEqual(TITLE_FN_MIN_SHARE)
    expect(modalFunction(mostly)).toBe('finance')
  })
  it('ignores untagged listings', () => {
    expect(modalFunction([...Array(10).fill('sales'), ...Array(50).fill(null), undefined])).toBe('sales')
  })
})

describe('functionCode', () => {
  it('accepts the stored label or the crawler code', () => {
    expect(functionCode('Human Resources')).toBe('people')
    expect(functionCode('people')).toBe('people')
    expect(functionCode('Data & Analytics')).toBe('data_ai')
    expect(functionCode('marketing')).toBe('marketing')
  })
  it('knows nothing it was not told', () => {
    expect(functionCode('Underwater basket weaving')).toBeNull()
    expect(functionCode(null)).toBeNull()
    expect(functionCode('')).toBeNull()
  })
})

describe('aiPremiumForFunction', () => {
  it('finds a function by its stored label', () => {
    const p = aiPremiumForFunction(market({ marketing: { label: 'Marketing', premium: premium() } }), 'Marketing')
    expect(p?.fn).toBe('marketing')
  })
  it('returns the function premium when both sides have 30+ paid postings', () => {
    const p = aiPremiumForFunction(market({ product: { label: 'Product', premium: premium({ likePct: 11.5, likeUsd: 17_000, likeN: 500 }) } }), 'product')
    expect(p?.label).toBe('Product')
    expect(p?.likePct).toBe(11.5)
    expect(p?.nAi).toBe(400)
  })
  it('shows nothing when either side is under 30', () => {
    expect(aiPremiumForFunction(market({ legal: { label: 'Legal', premium: premium({ nAi: 29 }) } }), 'legal')).toBeNull()
    expect(aiPremiumForFunction(market({ legal: { label: 'Legal', premium: premium({ nBase: 29 }) } }), 'legal')).toBeNull()
  })
  it('shows nothing without a snapshot, a function or a premium', () => {
    expect(aiPremiumForFunction(null, 'product')).toBeNull()
    expect(aiPremiumForFunction(market({ product: { label: 'Product', premium: premium() } }), null)).toBeNull()
    expect(aiPremiumForFunction(market({ academic: { label: 'Academic' } }), 'academic')).toBeNull()
    expect(aiPremiumForFunction(market({}), 'unknown')).toBeNull()
  })
  it('leaves like for like out when the snapshot has none', () => {
    const p = aiPremiumForFunction(market({ legal: { label: 'Legal', premium: premium() } }), 'legal')
    expect(p?.likePct).toBeUndefined()
  })
})

describe('wording', () => {
  it('says listings, never people, and names the matching when there is a like-for-like figure', () => {
    const matched = aiPremiumForFunction(market({ finance: { label: 'Finance', premium: premium({ likePct: 16.5, likeUsd: 24_500, likeN: 300 }) } }), 'finance')!
    const text = aiPremiumSentence(matched)
    expect(text).toContain('Finance listings')
    expect(text).toContain('+16.5%')
    expect(text).toContain('matched on level and industry')
    expect(text).not.toMatch(/people (earn|make|are paid)/i)
  })
  it('says the raw gap is not matched when there is no like-for-like figure', () => {
    const raw = aiPremiumForFunction(market({ legal: { label: 'Legal', premium: premium() } }), 'legal')!
    const text = aiPremiumSentence(raw)
    expect(text).toContain('not matched')
    expect(text).toContain('$165,000')
  })
  it('signs percentages', () => {
    expect(signedPct(18)).toBe('+18%')
    expect(signedPct(-1)).toBe('-1%')
    expect(signedPct(0)).toBe('0%')
  })
})

describe('aiIllustration', () => {
  const range = { p25: 110_000, median: 130_000, p75: 150_000 }
  it('moves the median by the like-for-like premium, rounded to $500', () => {
    const p = aiPremiumForFunction(market({ finance: { label: 'Finance', premium: premium({ likePct: 16.5, likeUsd: 24_500, likeN: 300 }) } }), 'finance')
    expect(aiIllustration(range, p)).toEqual({ medianWithAi: 151_500, pct: 16.5 })
  })
  it('gives nothing from the raw gap alone', () => {
    const p = aiPremiumForFunction(market({ legal: { label: 'Legal', premium: premium() } }), 'legal')
    expect(aiIllustration(range, p)).toBeNull()
    expect(aiIllustration(range, null)).toBeNull()
  })
})

describe('aiPremiumCsv', () => {
  it('lists only functions that clear the minimum, with a header, quoting and the as-of date', () => {
    const csv = aiPremiumCsv(
      market({
        product: { label: 'Product', sharePct: 41.1, premium: premium({ likePct: 11.5, likeUsd: 17_000, likeN: 500 }) },
        'fund': { label: 'Fundraising, & development', premium: premium({ nAi: 10 }) },
        legal: { label: 'Legal, tax & "compliance"', premium: premium() },
      }),
    )
    const lines = csv.trim().split('\n')
    expect(lines[0]).toBe(CSV_COLUMNS.join(','))
    expect(lines).toHaveLength(3)
    expect(csv).not.toContain('Fundraising')
    expect(csv).toContain('"Legal, tax & ""compliance"""')
    expect(lines.find((l) => l.startsWith('Product'))).toContain('2026-10-26')
  })
  it('has no posting, employer or person columns', () => {
    for (const c of CSV_COLUMNS) expect(c).not.toMatch(/employer|company|title|name|email|url|posting_id/)
  })
})
