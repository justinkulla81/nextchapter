import 'server-only'
import type { BlsResult } from '@/lib/market/types'
import { lookupSocCode } from '@/lib/market/soc-codes'
import { lookupAreaCode } from '@/lib/market/metro-areas'

const EMPLOYMENT_DATATYPE_CODE = '01'
const INDUSTRY_CODE_ALL = '000000'

function buildSeriesId(areaType: 'M' | 'S', areaCode: string, socCode: string): string {
  return `OEU${areaType}${areaCode}${INDUSTRY_CODE_ALL}${socCode}${EMPLOYMENT_DATATYPE_CODE}`
}

export async function lookupBlsTrend(
  primaryFunction: string | null,
  city: string | null,
  state: string | null
): Promise<BlsResult> {
  const occupation = lookupSocCode(primaryFunction)
  const area = lookupAreaCode(city, state)

  if (!occupation || !area) {
    return { status: 'unavailable', socCode: null, areaCode: null, yoyChangePct: null, error: null }
  }

  const apiKey = process.env.BLS_API_KEY
  const seriesId = buildSeriesId(area.areaType, area.areaCode, occupation.code)
  const endYear = new Date().getFullYear()
  const startYear = endYear - 2

  try {
    const response = await fetch('https://api.bls.gov/publicAPI/v2/timeseries/data/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(8000),
      body: JSON.stringify({
        seriesid: [seriesId],
        startyear: String(startYear),
        endyear: String(endYear),
        ...(apiKey ? { registrationkey: apiKey } : {}),
      }),
    })

    if (!response.ok) {
      return {
        status: 'fetch_failed',
        socCode: occupation.code,
        areaCode: area.areaCode,
        yoyChangePct: null,
        error: `BLS request failed with status ${response.status}.`,
      }
    }

    const data = (await response.json()) as {
      status?: string
      Results?: { series?: { data?: { year: string; value: string }[] }[] }
    }

    const series = data.Results?.series?.[0]
    const points = (series?.data ?? [])
      .map((point) => ({ year: Number(point.year), value: Number(point.value) }))
      .filter((point) => Number.isFinite(point.year) && Number.isFinite(point.value))
      .sort((a, b) => b.year - a.year)

    if (data.status !== 'REQUEST_SUCCEEDED' || points.length < 2) {
      return {
        status: 'unavailable',
        socCode: occupation.code,
        areaCode: area.areaCode,
        yoyChangePct: null,
        error: null,
      }
    }

    const [latest, previous] = points
    const yoyChangePct =
      previous.value === 0 ? null : ((latest.value - previous.value) / previous.value) * 100

    return {
      status: 'success',
      socCode: occupation.code,
      areaCode: area.areaCode,
      yoyChangePct,
      error: null,
    }
  } catch (error) {
    return {
      status: 'fetch_failed',
      socCode: occupation.code,
      areaCode: area.areaCode,
      yoyChangePct: null,
      error: error instanceof Error ? error.message : 'Failed to fetch BLS timeseries data.',
    }
  }
}
