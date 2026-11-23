import { describe, expect, it } from 'vitest'
import { boardWageHistory, payChangePct } from '@/lib/workforce/board-wage-history'

describe('board wage history (BLS QCEW)', () => {
  it('has Florida statewide matching the BLS state total (8,814,642 private jobs, $72,719 average pay, 2025)', async () => {
    const h = await boardWageHistory('FL-FL')
    expect(h).not.toBeNull()
    const i = h!.years.indexOf(2025)
    expect(h!.years[0]).toBe(2015)
    expect(Math.abs((h!.series['10'].e[i] ?? 0) - 8_814_642)).toBeLessThan(10)
    expect(h!.series['10'].p[i]).toBe(72_719)
  })
  it('covers a sector list including information, finance, professional services and construction', async () => {
    const h = await boardWageHistory('FL-FL')
    for (const code of ['10', '23', '51', '52', '54', '62']) expect(h!.series[code]).toBeDefined()
  })
  it('returns null for a board not in the file and computes pay change', async () => {
    expect(await boardWageHistory('MA-288')).toBeNull()
    const h = await boardWageHistory('FL-FL')
    const c = payChangePct(h!.series['10'], h!.years, 2015, 2025)
    expect(c).toBeGreaterThan(30)
  })
})
