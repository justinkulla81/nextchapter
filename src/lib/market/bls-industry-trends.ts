import 'server-only'
import { unstable_cache } from 'next/cache'

/**
 * Is an industry adding or shedding jobs? Year-over-year change in national
 * payroll employment, from the BLS Current Employment Statistics (seasonally
 * adjusted, monthly). Free, and one request covers every industry.
 *
 * This is deliberately NOT computed from our own job postings: those arrive in
 * crawler bulk imports (a single import added ~32,000 postings in one week),
 * so any "postings are up" trend would measure our crawler, not the economy.
 *
 * BLS publishes industries as broad sectors, so several of our finer industry
 * buckets share a series. A bucket with no sensible sector (Other, Nonprofit)
 * is simply absent — callers treat that as "no trend", never as flat.
 */
export const CES_SERIES_BY_BUCKET: Record<string, string> = {
  'Financial Services & Banking': 'CES5500000001',
  Insurance: 'CES5500000001',
  'Accounting & Audit': 'CES6000000001',
  'Legal Services': 'CES6000000001',
  'Professional Services & Consulting': 'CES6000000001',
  'Advertising, Marketing & PR': 'CES6000000001',
  'Staffing & Human Capital': 'CES6000000001',
  'Technology & Software': 'CES5000000001',
  Telecommunications: 'CES5000000001',
  'Media & Entertainment': 'CES5000000001',
  'Healthcare & Hospital Systems': 'CES6562000001',
  'Pharmaceuticals & Biotech': 'CES6562000001',
  'Medical Devices': 'CES3000000001',
  'Education & EdTech': 'CES6561000001',
  'Retail & E-commerce': 'CES4200000001',
  'Consumer Packaged Goods': 'CES3000000001',
  'Manufacturing & Industrial': 'CES3000000001',
  'Automotive & Mobility': 'CES3000000001',
  'Aerospace & Defense': 'CES3000000001',
  'Agriculture & Food Production': 'CES3000000001',
  'Hospitality, Travel & Food Service': 'CES7000000001',
  'Energy & Utilities': 'CES4422000001',
  'Construction & Real Estate': 'CES2000000001',
  'Transportation & Logistics': 'CES4300000001',
  'Government & Public Sector': 'CES9000000001',
}

export interface IndustryTrend {
  yoyPct: number
  asOf: string // e.g. "2026-09"
}

interface Point {
  year: number
  month: number
  value: number
}

// Latest published month vs the same month a year earlier. Null if either is
// missing — a trend needs both ends.
export function yoyFromPoints(points: Point[]): IndustryTrend | null {
  const sorted = [...points].sort((a, b) => b.year - a.year || b.month - a.month)
  const latest = sorted[0]
  const yearAgo = latest && sorted.find((p) => p.year === latest.year - 1 && p.month === latest.month)
  if (!latest || !yearAgo || yearAgo.value <= 0) return null
  return {
    yoyPct: Math.round(((latest.value / yearAgo.value - 1) * 100) * 10) / 10,
    asOf: `${latest.year}-${String(latest.month).padStart(2, '0')}`,
  }
}

export async function fetchIndustryTrends(): Promise<Record<string, IndustryTrend>> {
  const ids = [...new Set(Object.values(CES_SERIES_BY_BUCKET))]
  const end = new Date().getUTCFullYear()
  const res = await fetch('https://api.bls.gov/publicAPI/v2/timeseries/data/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(10_000),
    body: JSON.stringify({
      seriesid: ids,
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

  const bySeries = new Map<string, IndustryTrend>()
  for (const s of data.Results?.series ?? []) {
    const points = (s.data ?? [])
      .filter((p) => /^M(0[1-9]|1[0-2])$/.test(p.period))
      .map((p) => ({ year: Number(p.year), month: Number(p.period.slice(1)), value: Number(p.value) }))
      .filter((p) => Number.isFinite(p.value))
    const trend = yoyFromPoints(points)
    if (trend) bySeries.set(s.seriesID, trend)
  }

  const out: Record<string, IndustryTrend> = {}
  for (const [bucket, seriesId] of Object.entries(CES_SERIES_BY_BUCKET)) {
    const t = bySeries.get(seriesId)
    if (t) out[bucket] = t
  }
  return out
}

// BLS publishes once a month and rate-limits; twelve hours is plenty.
const cached = unstable_cache(fetchIndustryTrends, ['bls-industry-trends-v1'], { revalidate: 43_200 })

/** Empty when BLS can't be reached (not cached, so the next call retries) — no trend, not a flat one. */
export async function getIndustryTrends(): Promise<Record<string, IndustryTrend>> {
  try {
    return await cached()
  } catch (e) {
    console.error('BLS industry trends could not be loaded', e)
    return {}
  }
}
