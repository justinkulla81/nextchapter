import 'server-only'
import { prisma } from '@/lib/prisma'

/**
 * County unemployment from the BLS Local Area Unemployment Statistics:
 * unemployed and labor force for each county, the latest month and the same
 * month a year earlier. A board's rate is its counties' unemployed over
 * their labor force, so a big county weighs what it should.
 *
 * LAUS county figures are not seasonally adjusted and run about two months
 * behind. Long-term unemployment (27 weeks or more) is not published below
 * the national level, so boards show the national figure for that.
 */
const BLS = 'https://api.bls.gov/publicAPI/v2/timeseries/data/'
/** 25 counties × 2 series: the API's 50-series limit. */
const PER_REQUEST = 25

const seriesId = (fips: string, measure: '04' | '06') => `LAUCN${fips}00000000${measure}`

type Point = { year: number; month: number; value: number }

export function latestWithYearAgo(unemployed: Point[], labor: Point[]): {
  period: string; unemployed: number; laborForce: number; rate: number; rateYearAgo: number | null
} | null {
  const key = (p: Point) => p.year * 100 + p.month
  const lf = new Map(labor.map((p) => [key(p), p.value]))
  const months = unemployed.filter((p) => lf.has(key(p)) && lf.get(key(p))! > 0).sort((a, b) => key(b) - key(a))
  const latest = months[0]
  if (!latest) return null
  const rateAt = (k: number) => {
    const u = unemployed.find((p) => key(p) === k)
    const l = lf.get(k)
    return u && l ? Math.round((u.value / l) * 1000) / 10 : null
  }
  return {
    period: `${latest.year}-${String(latest.month).padStart(2, '0')}`,
    unemployed: latest.value,
    laborForce: lf.get(key(latest))!,
    rate: rateAt(key(latest))!,
    rateYearAgo: rateAt(key(latest) - 100),
  }
}

/**
 * Refreshes the counties not updated this month, oldest first, until the
 * budget is spent or BLS's daily limit is reached.
 */
export async function refreshCountyLabor(budgetMs = 60_000, maxAgeDays = 25): Promise<{ counties: number; stopped?: string }> {
  const started = Date.now()
  const cutoff = new Date(Date.now() - maxAgeDays * 86_400_000)
  const due = await prisma.countyLabor.findMany({
    where: { OR: [{ period: null }, { updatedAt: { lt: cutoff } }] },
    orderBy: [{ period: { sort: 'asc', nulls: 'first' } }, { updatedAt: 'asc' }],
    select: { fips: true },
  })
  const year = new Date().getFullYear()
  let counties = 0
  for (let i = 0; i < due.length; i += PER_REQUEST) {
    if (Date.now() - started > budgetMs) break
    const batch = due.slice(i, i + PER_REQUEST).map((c) => c.fips)
    const res = await fetch(BLS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(30_000),
      body: JSON.stringify({
        seriesid: batch.flatMap((f) => [seriesId(f, '04'), seriesId(f, '06')]),
        startyear: String(year - 1), endyear: String(year),
        ...(process.env.BLS_API_KEY ? { registrationkey: process.env.BLS_API_KEY } : {}),
      }),
    }).catch(() => null)
    if (!res?.ok) return { counties, stopped: `BLS returned ${res?.status ?? 'no response'}` }
    const data = (await res.json()) as {
      status?: string; message?: string[]
      Results?: { series?: { seriesID: string; data?: { year: string; period: string; value: string }[] }[] }
    }
    if (data.status !== 'REQUEST_SUCCEEDED' && !data.Results?.series?.length) {
      return { counties, stopped: data.message?.join(' ') || data.status || 'BLS refused the request' }
    }
    const points = new Map<string, Point[]>()
    for (const s of data.Results?.series ?? []) {
      points.set(s.seriesID, (s.data ?? [])
        .filter((d) => /^M(0[1-9]|1[0-2])$/.test(d.period) && d.value !== '-' && Number.isFinite(Number(d.value)))
        .map((d) => ({ year: Number(d.year), month: Number(d.period.slice(1)), value: Number(d.value) })))
    }
    for (const fips of batch) {
      const r = latestWithYearAgo(points.get(seriesId(fips, '04')) ?? [], points.get(seriesId(fips, '06')) ?? [])
      await prisma.countyLabor.update({
        where: { fips },
        data: r
          ? { period: r.period, unemployed: r.unemployed, laborForce: r.laborForce, rate: r.rate, rateYearAgo: r.rateYearAgo, updatedAt: new Date() }
          // No series for this county (a new Connecticut region, say): checked, nothing to show.
          : { period: 'none', updatedAt: new Date() },
      })
      counties++
    }
  }
  return { counties }
}

export interface BoardLabor { rate: number; rateYearAgo: number | null; unemployed: number; laborForce: number; period: string; counties: number }

/** A board's unemployment: its counties summed. */
export function boardLabor(rows: { laborForce: number | null; unemployed: number | null; rateYearAgo: number | null; period: string | null }[]): BoardLabor | null {
  const live = rows.filter((r) => r.laborForce && r.unemployed != null && r.period && r.period !== 'none')
  if (!live.length) return null
  const laborForce = live.reduce((s, r) => s + r.laborForce!, 0)
  const unemployed = live.reduce((s, r) => s + r.unemployed!, 0)
  const withAgo = live.filter((r) => r.rateYearAgo != null)
  const agoLf = withAgo.reduce((s, r) => s + r.laborForce!, 0)
  const rateYearAgo = withAgo.length === live.length && agoLf
    ? Math.round((withAgo.reduce((s, r) => s + (r.rateYearAgo! / 100) * r.laborForce!, 0) / agoLf) * 1000) / 10
    : null
  return {
    rate: Math.round((unemployed / laborForce) * 1000) / 10,
    rateYearAgo,
    unemployed, laborForce,
    period: live.map((r) => r.period!).sort().at(-1)!,
    counties: live.length,
  }
}
