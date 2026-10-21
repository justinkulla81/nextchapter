import { describe, it, expect } from 'vitest'
import { buildAiDimensions, buildDimension, type DimCellRow } from '@/lib/skills/ai-market-dimensions'
import { liveDimensionRows, MIN_GROUP_POSTINGS } from '@/lib/skills/ai-skills-public'

const whole = (k: string, side: 'ai' | 'base', n: number, med: number): DimCellRow => ({ k, fn: null, lvl: null, side, n, med, g: 3 })
const cell = (k: string, fn: string, lvl: string, side: 'ai' | 'base', n: number, med: number): DimCellRow => ({ k, fn, lvl, side, n, med, g: 0 })

describe('AI market dimensions', () => {
  const shares = [
    { k: 'Technology & Software', n: 1000, skill: 340 },
    { k: 'Education & EdTech', n: 400, skill: 20 },
    { k: 'Telecommunications', n: 100, skill: 20 },
  ]
  const cells: DimCellRow[] = [
    whole('Technology & Software', 'ai', 120, 180000),
    whole('Technology & Software', 'base', 300, 150000),
    cell('Technology & Software', 'engineering', 'mid', 'ai', 80, 170000),
    cell('Technology & Software', 'engineering', 'mid', 'base', 120, 150000),
    whole('Education & EdTech', 'ai', 10, 90000), // too thin
    whole('Education & EdTech', 'base', 200, 80000),
  ]

  it('computes share and a premium only from enough paid postings per side', () => {
    const rows = buildDimension(shares, cells, (k) => k)
    const tech = rows.find((r) => r.key === 'Technology & Software')!
    expect(tech.sharePct).toBe(34)
    expect(tech.premium?.rawPct).toBe(20)
    expect(tech.premium?.likePct).toBeGreaterThan(0)
    expect(rows.find((r) => r.key === 'Education & EdTech')!.premium).toBeUndefined()
    expect(rows[0].key).toBe('Technology & Software') // largest group first
  })

  it('orders levels from entry to VP and labels them', () => {
    const d = buildAiDimensions({
      industry: { shares: [], cells: [] },
      state: { shares: [], cells: [] },
      level: { shares: [{ k: 'vp', n: 50, skill: 5 }, { k: 'entry', n: 500, skill: 20 }, { k: 'mid', n: 900, skill: 90 }], cells: [] },
    })
    expect(d.level.map((r) => r.label)).toEqual(['Entry', 'Mid-level', 'VP and above'])
  })

  it('public rows drop thin groups, sort by share, and never show one premium without the other', () => {
    const rows = liveDimensionRows(buildDimension(shares, cells, (k) => k))
    expect(rows.map((r) => r.key)).toEqual(['Technology & Software', 'Education & EdTech']) // telecom has 100 < MIN
    expect(MIN_GROUP_POSTINGS).toBe(300)
    for (const r of rows) expect(r.rawPremiumPct === null).toBe(r.likePremiumPct === null)
  })
})
