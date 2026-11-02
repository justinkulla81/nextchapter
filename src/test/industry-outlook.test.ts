import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { industryOutlook, joltsFacts } from '@/lib/seo/industry-outlook'
import { readingFromPoints, joltsSeriesId } from '@/lib/market/bls-industry-jolts'
import { JOLTS_CODE_BY_BUCKET } from '@/lib/market/industry-jolts-data'
import { INDUSTRIES } from '@/lib/seo/topics'

const r = (value: number, yearAgo: number) => ({ value, yearAgo, asOf: '2026-08' })

describe('industry outlook', () => {
  it('is Building when employment, openings and layoffs all point up', () => {
    const o = industryOutlook({ yoyPct: 2.1 }, { openings: r(5.4, 4.8), layoffs: r(0.8, 1.1) }, 'health care')
    expect(o.label).toBe('Building')
    expect(o.evidence).toHaveLength(3)
  })
  it('is Cooling when they point down', () => {
    expect(industryOutlook({ yoyPct: -1.2 }, { openings: r(3.0, 3.8), layoffs: r(1.6, 1.2) }).label).toBe('Cooling')
  })
  it('is Steady when mixed or flat', () => {
    expect(industryOutlook({ yoyPct: 0.3 }, { openings: r(4.0, 4.1), layoffs: r(1.0, 1.0) }).label).toBe('Steady')
  })
  it('needs two inputs', () => {
    expect(industryOutlook({ yoyPct: 3 }, undefined).label).toBe('Not enough data')
    expect(industryOutlook(undefined, { openings: r(5, 4) }).label).toBe('Not enough data')
  })
  it('turns a reading into sourced facts', () => {
    const f = joltsFacts({ openings: r(5.4, 4.8) }, 'finance and insurance')
    expect(f).toHaveLength(1)
    expect(f[0].source).toContain('Job Openings and Labor Turnover')
    expect(f[0].value).toContain('closest BLS sector')
  })
})

describe('JOLTS data', () => {
  it('needs both ends of the year to give a reading', () => {
    expect(readingFromPoints([{ year: 2026, month: 8, value: 5 }])).toBeNull()
    expect(readingFromPoints([{ year: 2026, month: 8, value: 5 }, { year: 2025, month: 8, value: 4.5 }])).toEqual({ value: 5, yearAgo: 4.5, asOf: '2026-08' })
  })
  it('builds the 21-character series ids BLS uses', () => {
    expect(joltsSeriesId('540099', 'openings')).toBe('JTS540099000000000JOR')
    expect(joltsSeriesId('620000', 'layoffs')).toBe('JTS620000000000000LDR')
  })
  it('only maps industries that exist', () => {
    const names = new Set(INDUSTRIES.map((i) => i.name))
    for (const b of Object.keys(JOLTS_CODE_BY_BUCKET)) expect(names.has(b), b).toBe(true)
  })
})
