// The pay check: where one salary sits against what employers list for the same job title. Pure and tested in
// src/test/pay-check.test.ts. The benchmark is the spread of annual pay in current listings on employers' own career
// sites (see src/lib/seo/job-titles.ts): what employers advertise, not what people are paid, and it says so.

import { comparePay, type PayVsMarket } from '@/lib/pay/market-pay'

export interface PayCheckStat {
  name: string
  slug: string
  payCount: number
  p25: number
  median: number
  p75: number
  /** The function most of this title's listings are tagged with (src/lib/pay/ai-premium.ts), where its AI-skill premium comes from. */
  fn?: string | null
}

export interface PayCheckResult {
  verdict: PayVsMarket
  /** Your pay as a share of the median: 1.05 = 5% above. */
  ratio: number
  /** Where you sit among the listings: below the lower quarter, in the middle half, or above the upper quarter. */
  band: 'below_range' | 'lower_half' | 'upper_half' | 'above_range'
  /** Dollars to the median, negative when you are above it. */
  gapToMedian: number
}

export function evaluatePay(annualPay: number, stat: PayCheckStat): PayCheckResult | null {
  const c = comparePay(annualPay, stat.median)
  if (!c) return null
  const band = annualPay < stat.p25 ? 'below_range' : annualPay > stat.p75 ? 'above_range' : annualPay < stat.median ? 'lower_half' : 'upper_half'
  return { verdict: c.verdict, ratio: c.ratio, band, gapToMedian: stat.median - annualPay }
}

const usd = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`

/** One plain sentence for the result, with no promise about what an employer will pay. */
export function payCheckSentence(annualPay: number, stat: PayCheckStat, r: PayCheckResult): string {
  const pct = Math.round(Math.abs(r.ratio - 1) * 100)
  const title = stat.name.toLowerCase()
  if (r.verdict === 'in_line') return `${usd(annualPay)} is within 10% of the ${usd(stat.median)} median that employers list for ${title} roles.`
  const dir = r.verdict === 'above' ? 'above' : 'below'
  const tail = r.band === 'below_range' ? ` It is under the lower quarter of listings (${usd(stat.p25)}).` : r.band === 'above_range' ? ` It is over the upper quarter of listings (${usd(stat.p75)}).` : ''
  return `${usd(annualPay)} is about ${pct}% ${dir} the ${usd(stat.median)} median that employers list for ${title} roles.${tail}`
}

/** Parses "$120,000", "120000" or "120k". Null when it is not a plausible annual figure. */
export function parseAnnualPay(raw: string): number | null {
  const t = raw.trim().toLowerCase().replace(/[$,\s]/g, '')
  const m = /^(\d+(?:\.\d+)?)(k?)$/.exec(t)
  if (!m) return null
  const n = Number(m[1]) * (m[2] ? 1000 : 1)
  return n >= 20_000 && n <= 2_000_000 ? Math.round(n) : null
}
