import 'server-only'
import { unstable_cache } from 'next/cache'

/**
 * Pay against prices, from the Bureau of Labor Statistics, for the pay-and-cost-of-living journey page.
 *
 *   CES0500000003 — average hourly earnings of all employees, total private (dollars, seasonally adjusted)
 *   CUSR0000SA0   — CPI-U, all items, U.S. city average (index, seasonally adjusted)
 *
 * Both are for every worker or every urban consumer, not white-collar roles or one metro; the page says so.
 */
const EARNINGS = 'CES0500000003'
const CPI = 'CUSR0000SA0'

export interface PayVsPrices {
  /** Latest month the two series share, e.g. { year: 2026, month: 9 }. */
  year: number
  month: number
  /** Percent change in average hourly earnings over twelve months. */
  wagesPct: number
  /** Percent change in consumer prices over twelve months. */
  pricesPct: number
  /** wagesPct - pricesPct, in percentage points: positive means pay is ahead of prices. */
  realPct: number
}

type Pt = { year: number; month: number; value: number }

async function fetchPay(): Promise<PayVsPrices> {
  const end = new Date().getUTCFullYear()
  const res = await fetch('https://api.bls.gov/publicAPI/v2/timeseries/data/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(10_000),
    body: JSON.stringify({
      seriesid: [EARNINGS, CPI],
      startyear: String(end - 1),
      endyear: String(end),
      ...(process.env.BLS_API_KEY ? { registrationkey: process.env.BLS_API_KEY } : {}),
    }),
  })
  if (!res.ok) throw new Error(`BLS returned ${res.status}`)
  const data = (await res.json()) as {
    status?: string
    Results?: { series?: { seriesID: string; data?: { year: string; period: string; value: string }[] }[] }
  }
  if (data.status !== 'REQUEST_SUCCEEDED') throw new Error(`BLS: ${data.status}`)
  const points = (id: string): Pt[] =>
    (data.Results?.series?.find((s) => s.seriesID === id)?.data ?? [])
      .filter((p) => /^M(0[1-9]|1[0-2])$/.test(p.period))
      .map((p) => ({ year: Number(p.year), month: Number(p.period.slice(1)), value: Number(p.value) }))
      .filter((p) => Number.isFinite(p.value))
  return computePay(points(EARNINGS), points(CPI))
}

/** Twelve-month change in each series at the newest month both have, a year-earlier point required. */
export function computePay(earnings: Pt[], cpi: Pt[]): PayVsPrices {
  const key = (p: Pt) => p.year * 12 + p.month
  const byKey = (pts: Pt[]) => new Map(pts.map((p) => [key(p), p.value]))
  const e = byKey(earnings)
  const c = byKey(cpi)
  const shared = [...e.keys()].filter((k) => c.has(k) && e.has(k - 12) && c.has(k - 12)).sort((a, b) => b - a)
  const k = shared[0]
  if (k === undefined) throw new Error('BLS pay series have no month in common with a year-earlier month')
  const pct = (m: Map<number, number>) => (m.get(k)! / m.get(k - 12)! - 1) * 100
  const wagesPct = pct(e)
  const pricesPct = pct(c)
  return {
    year: Math.floor((k - 1) / 12),
    month: ((k - 1) % 12) + 1,
    wagesPct,
    pricesPct,
    realPct: wagesPct - pricesPct,
  }
}

/** Cached twelve hours: BLS publishes monthly and limits daily requests. */
const cached = unstable_cache(fetchPay, ['bls-pay-vs-prices-v1'], { revalidate: 43_200 })

/** Null when BLS cannot be reached; a failure is not cached. */
export async function getPayVsPrices(): Promise<PayVsPrices | null> {
  try {
    return await cached()
  } catch (e) {
    console.error('BLS pay and price series could not be loaded', e)
    return null
  }
}
