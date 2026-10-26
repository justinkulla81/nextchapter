import 'server-only'
import { unstable_cache } from 'next/cache'
import { FUNCTION_SOC_GROUP } from '@/lib/seo/topics'

/**
 * Median annual wage by Census occupation major group, from the BLS Occupational Employment and Wage Statistics
 * (national, all industries). Free; one request covers every group. Series id: OEUN + area (7 zeros, national) +
 * industry (6 zeros, all) + occupation (group code + 0000) + data type 13 (annual median wage). Empty when BLS can't be
 * reached, never a made-up number.
 */
export interface GroupWage { median: number; year: string }

const seriesId = (group: string) => `OEUN0000000000000${group}000013`

export async function fetchGroupWages(): Promise<Record<string, GroupWage>> {
  const groups = [...new Set(Object.values(FUNCTION_SOC_GROUP))]
  const res = await fetch('https://api.bls.gov/publicAPI/v2/timeseries/data/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(10_000),
    body: JSON.stringify({
      seriesid: groups.map(seriesId),
      startyear: String(new Date().getUTCFullYear() - 2),
      endyear: String(new Date().getUTCFullYear()),
      ...(process.env.BLS_API_KEY ? { registrationkey: process.env.BLS_API_KEY } : {}),
    }),
  })
  if (!res.ok) throw new Error(`BLS returned ${res.status}`)
  const data = (await res.json()) as { status?: string; Results?: { series?: { seriesID: string; data?: { year: string; period: string; value: string }[] }[] } }
  if (data.status !== 'REQUEST_SUCCEEDED') throw new Error(`BLS: ${data.status}`)
  const out: Record<string, GroupWage> = {}
  for (const s of data.Results?.series ?? []) {
    const group = groups.find((g) => seriesId(g) === s.seriesID)
    const latest = [...(s.data ?? [])].filter((p) => p.period === 'A01' && Number.isFinite(Number(p.value))).sort((a, b) => Number(b.year) - Number(a.year))[0]
    if (group && latest) out[group] = { median: Number(latest.value), year: latest.year }
  }
  return out
}

const cached = unstable_cache(fetchGroupWages, ['bls-oews-group-wages-v1'], { revalidate: 86_400 })

export async function getGroupWages(): Promise<Record<string, GroupWage>> {
  try {
    return await cached()
  } catch (e) {
    console.error('BLS OEWS wages could not be loaded', e)
    return {}
  }
}
