import 'server-only'
import { unstable_cache } from 'next/cache'
import { JOLTS_CODE_BY_BUCKET, type JoltsReading, type JoltsMeasures } from '@/lib/market/industry-jolts-data'

/**
 * Job openings, hires and layoffs rates by industry from the BLS Job Openings and Labor Turnover Survey (seasonally
 * adjusted, monthly, free, one request covers every industry). Rates are a share of employment. The latest published
 * month is set against the same month a year earlier; a measure missing either end is left out, never shown as flat.
 */
const MEASURES = { openings: 'JOR', hires: 'HIR', layoffs: 'LDR' } as const

interface Point { year: number; month: number; value: number }

export function readingFromPoints(points: Point[]): JoltsReading | null {
  const sorted = [...points].sort((a, b) => b.year - a.year || b.month - a.month)
  const latest = sorted[0]
  const yearAgo = latest && sorted.find((p) => p.year === latest.year - 1 && p.month === latest.month)
  if (!latest || !yearAgo) return null
  return { value: latest.value, yearAgo: yearAgo.value, asOf: `${latest.year}-${String(latest.month).padStart(2, '0')}` }
}

export const joltsSeriesId = (code: string, measure: keyof typeof MEASURES) => `JTS${code}000000000${MEASURES[measure]}`

export async function fetchIndustryJolts(): Promise<Record<string, JoltsMeasures>> {
  const codes = [...new Set(Object.values(JOLTS_CODE_BY_BUCKET).map((x) => x.code))]
  const ids = codes.flatMap((c) => (Object.keys(MEASURES) as (keyof typeof MEASURES)[]).map((m) => joltsSeriesId(c, m)))
  const end = new Date().getUTCFullYear()
  const res = await fetch('https://api.bls.gov/publicAPI/v2/timeseries/data/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(15_000),
    body: JSON.stringify({ seriesid: ids, startyear: String(end - 1), endyear: String(end), ...(process.env.BLS_API_KEY ? { registrationkey: process.env.BLS_API_KEY } : {}) }),
  })
  if (!res.ok) throw new Error(`BLS returned ${res.status}`)
  const data = (await res.json()) as { status?: string; Results?: { series?: { seriesID: string; data?: { year: string; period: string; value: string }[] }[] } }
  if (data.status !== 'REQUEST_SUCCEEDED') throw new Error(`BLS: ${data.status}`)

  const bySeries = new Map<string, JoltsReading>()
  for (const s of data.Results?.series ?? []) {
    const points = (s.data ?? [])
      .filter((p) => /^M(0[1-9]|1[0-2])$/.test(p.period))
      .map((p) => ({ year: Number(p.year), month: Number(p.period.slice(1)), value: Number(p.value) }))
      .filter((p) => Number.isFinite(p.value))
    const r = readingFromPoints(points)
    if (r) bySeries.set(s.seriesID, r)
  }

  const out: Record<string, JoltsMeasures> = {}
  for (const [bucket, { code }] of Object.entries(JOLTS_CODE_BY_BUCKET)) {
    const m: JoltsMeasures = {}
    for (const k of Object.keys(MEASURES) as (keyof typeof MEASURES)[]) {
      const r = bySeries.get(joltsSeriesId(code, k))
      if (r) m[k] = r
    }
    if (Object.keys(m).length) out[bucket] = m
  }
  return out
}

const cached = unstable_cache(fetchIndustryJolts, ['bls-industry-jolts-v1'], { revalidate: 43_200 })

/** Empty when BLS cannot be reached (not cached, so the next call retries): no reading, not a flat one. */
export async function getIndustryJolts(): Promise<Record<string, JoltsMeasures>> {
  try {
    return await cached()
  } catch (e) {
    console.error('BLS industry JOLTS could not be loaded', e)
    return {}
  }
}
