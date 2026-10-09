import 'server-only'
import { prisma } from '@/lib/prisma'
import { normalizeMetroArea } from '@/lib/constants/metro-areas'
import { getNationalLaborData } from '@/lib/market/bls-national'

// How is the member's own area doing? Built only from data we already hold:
// GeoArea (BLS state unemployment, current and a year earlier) and WARN notices
// (filed layoffs, matched to the member's metro by the city on the filing).
// No new external calls beyond the already-cached national rate.
//
// Stress is a deliberately blunt 0-2 count of independent warning signs, not a
// score, because each input is coarse (state-level unemployment, a metro match
// by city name): rising unemployment, unemployment above the national rate,
// and a heavy run of local layoffs.

const DAY_MS = 24 * 60 * 60 * 1000
export const METRO_LAYOFF_WORKERS_HIGH = 500
const RISING_UNEMPLOYMENT_PTS = 0.5
const ABOVE_NATIONAL_PTS = 0.5

export interface LocalEconomy {
  metro: string | null
  state: string
  stateName: string
  unemploymentRate: number | null
  unemploymentChange: number | null // points vs a year earlier
  nationalRate: number | null
  metroLayoffEvents90d: number
  metroLayoffWorkers90d: number
  stateLayoffWorkers90d: number
  stress: 0 | 1 | 2
}

export function stressLevel(input: {
  unemploymentChange: number | null
  unemploymentRate: number | null
  nationalRate: number | null
  metroLayoffWorkers90d: number
}): 0 | 1 | 2 {
  let n = 0
  if (input.unemploymentChange !== null && input.unemploymentChange >= RISING_UNEMPLOYMENT_PTS) n++
  if (input.unemploymentRate !== null && input.nationalRate !== null && input.unemploymentRate >= input.nationalRate + ABOVE_NATIONAL_PTS) n++
  if (input.metroLayoffWorkers90d >= METRO_LAYOFF_WORKERS_HIGH) n++
  return n >= 2 ? 2 : n === 1 ? 1 : 0
}

export async function getLocalEconomy(metro: string | null, stateCode: string | null): Promise<LocalEconomy | null> {
  const state = stateCode?.trim().toUpperCase()
  if (!state || state.length !== 2) return null

  const since = new Date(Date.now() - 90 * DAY_MS)
  const [geo, notices, national] = await Promise.all([
    // GeoArea is read with raw SQL on purpose: that table is populated by the
    // geography import and may be absent from this build's Prisma schema or from
    // a database that hasn't loaded it. Any failure just means "no unemployment
    // figure" — the layoff half of this module doesn't depend on it.
    prisma
      .$queryRaw<{ name: string; unemploymentRate: number | null; unemploymentRatePrior: number | null }[]>`
        select "name", "unemploymentRate", "unemploymentRatePrior" from "GeoArea"
        where "level" = 'STATE' and "state" = ${state} limit 1`
      .then((rows) => rows[0] ?? null)
      .catch(() => null),
    prisma.warnNotice.findMany({
      where: { state, noticeDate: { gte: since } },
      select: { address: true, employees: true },
    }),
    getNationalLaborData(),
  ])
  // WARN "address" is the city on most state filings; normalizeMetroArea maps
  // it to the same metro bucket the member's own location uses.
  const metroNotices = metro ? notices.filter((n) => normalizeMetroArea(n.address?.split(',')[0]?.trim() ?? null) === metro) : []
  const workers = (rows: { employees: number | null }[]) => rows.reduce((s, r) => s + (r.employees ?? 0), 0)

  const unemploymentRate = geo?.unemploymentRate ?? null
  const unemploymentChange =
    geo && geo.unemploymentRate !== null && geo.unemploymentRatePrior !== null
      ? Math.round((geo.unemploymentRate - geo.unemploymentRatePrior) * 10) / 10
      : null
  const nationalRate = national?.rate?.latest.value ?? null
  const metroLayoffWorkers90d = workers(metroNotices)

  return {
    metro,
    state,
    stateName: geo?.name ?? state,
    unemploymentRate,
    unemploymentChange,
    nationalRate,
    metroLayoffEvents90d: metroNotices.length,
    metroLayoffWorkers90d,
    stateLayoffWorkers90d: workers(notices),
    stress: stressLevel({ unemploymentChange, unemploymentRate, nationalRate, metroLayoffWorkers90d }),
  }
}
