import 'server-only'
import { unstable_cache } from 'next/cache'

/**
 * The national layoff and unemployment numbers the layoff tracker sets its
 * own counts against, from the Bureau of Labor Statistics.
 *
 *   JOLTS layoffs and discharges — every layoff in the country, monthly, a
 *     survey estimate. The yardstick for how much WARN filings miss.
 *   CPS unemployed 27 weeks or more — long-term unemployment, as a count and
 *     as a share of everyone unemployed.
 *   CPS median weeks unemployed, and the unemployment rate.
 *
 * All are BLS survey estimates, seasonally adjusted, published monthly.
 */
const SERIES = {
  layoffs: 'JTS000000000000000LDL', // thousands
  longTerm: 'LNS13008636', // thousands, unemployed 27+ weeks
  longTermShare: 'LNS13025703', // percent of the unemployed
  medianWeeks: 'LNS13008276',
  rate: 'LNS14000000', // percent
} as const
type Key = keyof typeof SERIES

export interface BlsPoint { year: number; month: number; value: number }
export interface BlsSeries {
  latest: BlsPoint
  /** The same month a year earlier, when published. */
  yearAgo: BlsPoint | null
  /** Every month of the latest point's year, oldest first. */
  thisYear: BlsPoint[]
}
export type NationalLaborData = Record<Key, BlsSeries | null> & { fetchedAt: string }

async function fetchNational(): Promise<NationalLaborData> {
  const end = new Date().getUTCFullYear()
  {
    const res = await fetch('https://api.bls.gov/publicAPI/v2/timeseries/data/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(10_000),
      body: JSON.stringify({
        seriesid: Object.values(SERIES),
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

    const out = { fetchedAt: new Date().toISOString() } as NationalLaborData
    for (const [key, id] of Object.entries(SERIES) as [Key, string][]) {
      const points = (data.Results?.series?.find((s) => s.seriesID === id)?.data ?? [])
        .filter((p) => /^M(0[1-9]|1[0-2])$/.test(p.period))
        .map((p) => ({ year: Number(p.year), month: Number(p.period.slice(1)), value: Number(p.value) }))
        .filter((p) => Number.isFinite(p.value))
        .sort((a, b) => b.year - a.year || b.month - a.month)
      const latest = points[0]
      out[key] = latest
        ? {
            latest,
            yearAgo: points.find((p) => p.year === latest.year - 1 && p.month === latest.month) ?? null,
            thisYear: points.filter((p) => p.year === latest.year).reverse(),
          }
        : null
    }
    return out
  }
}

/**
 * Cached for twelve hours. BLS publishes these once a month and allows a
 * limited number of requests a day; the pages that show them rebuild every
 * few minutes.
 */
const cached = unstable_cache(fetchNational, ['bls-national-labor-v1'], { revalidate: 43_200 })

/** Null when BLS cannot be reached; a failure is not cached, so the next page build tries again. */
export async function getNationalLaborData(): Promise<NationalLaborData | null> {
  try {
    return await cached()
  } catch (e) {
    console.error('BLS national series could not be loaded', e)
    return null
  }
}

export function monthLabel(p: BlsPoint): string {
  return new Date(Date.UTC(p.year, p.month - 1, 1)).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}
