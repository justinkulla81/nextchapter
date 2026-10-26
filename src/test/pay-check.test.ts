import { describe, expect, it } from 'vitest'
import { evaluatePay, parseAnnualPay, payCheckSentence, type PayCheckStat } from '@/lib/tools/pay-check'

const stat: PayCheckStat = { name: 'Product Manager', slug: 'product-manager', payCount: 120, p25: 110_000, median: 130_000, p75: 150_000 }

describe('parseAnnualPay', () => {
  it('reads dollars, commas and k', () => {
    expect(parseAnnualPay('$120,000')).toBe(120000)
    expect(parseAnnualPay('120k')).toBe(120000)
    expect(parseAnnualPay(' 95.5k ')).toBe(95500)
  })
  it('rejects hourly-looking, tiny, huge and junk values', () => {
    expect(parseAnnualPay('45')).toBeNull()
    expect(parseAnnualPay('5000000')).toBeNull()
    expect(parseAnnualPay('abc')).toBeNull()
  })
})

describe('evaluatePay', () => {
  it('calls pay within 10% of the median in line', () => {
    expect(evaluatePay(135_000, stat)?.verdict).toBe('in_line')
  })
  it('places pay below, above and in the bands', () => {
    expect(evaluatePay(90_000, stat)).toMatchObject({ verdict: 'below', band: 'below_range' })
    expect(evaluatePay(115_000, stat)).toMatchObject({ verdict: 'below', band: 'lower_half' })
    expect(evaluatePay(160_000, stat)).toMatchObject({ verdict: 'above', band: 'above_range' })
  })
  it('gives the dollar gap to the median', () => {
    expect(evaluatePay(100_000, stat)?.gapToMedian).toBe(30_000)
  })
})

describe('payCheckSentence', () => {
  it('says what the benchmark is, without promising a salary', () => {
    const r = evaluatePay(90_000, stat)!
    const s = payCheckSentence(90_000, stat, r)
    expect(s).toContain('median that employers list')
    expect(s).toContain('under the lower quarter')
  })
})
