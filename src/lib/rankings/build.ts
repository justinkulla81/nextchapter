import 'server-only'
import { lookupAreaCode } from '@/lib/market/metro-areas'
import { costsFor } from '@/lib/market/area-costs'
import { getStateCities, getStateCityPlaces, getStateCounties, placeUrl } from '@/lib/places/places'
import { placeKey } from '@/lib/workforce/places'
import { stateSlug } from '@/lib/seo/states'
import { rankCities, rankCounties, wave1Specs } from '@/lib/rankings/build-edition'
import { STATE_FIPS } from '@/lib/rankings/regions'
import { loadCityStats, loadCountyStats } from '@/lib/rankings/scan'
import { previousEdition, readRanking, readRankingIndex, writePlaceRanks, writeRanking, writeRankingIndex } from '@/lib/rankings/store'
import type { CityStat, CountyStat, PlaceInfo, PlaceRanks, RankingEdition, RankingIndexEntry } from '@/lib/rankings/types'
import type { Cost } from '@/lib/rankings/measures'

const titleCase = (s: string) => s.replace(/\b[a-z]/g, (c) => c.toUpperCase())

/** Each city's display name and place-page link, from the place tables, for the states that appear in the scan. */
async function placeInfo(states: string[]): Promise<Map<string, PlaceInfo>> {
  const out = new Map<string, PlaceInfo>()
  for (const st of states) {
    const [places, live] = await Promise.all([getStateCityPlaces(st), getStateCities(st)])
    const ok = new Set(live.map((c) => c.slug))
    for (const p of places) out.set(`${st}|${p.key}`, { name: p.name, href: ok.has(p.slug) ? placeUrl.city(stateSlug(st), p.slug) : null })
  }
  return out
}

/** County pages exist for every county; the slug is the one the place pages use. */
async function countyHrefs(states: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  for (const st of states) for (const c of await getStateCounties(st)) out.set(c.fips, placeUrl.county(stateSlug(st), c.slug))
  return out
}

/** The local price level for a city: its metro's, else its state's. Null when we have neither. */
export function costOf(c: CityStat, name: string): Cost | null {
  const hit = lookupAreaCode(name, c.st)
  if (hit?.areaType === 'M') {
    const metro = costsFor({ metroCode: hit.areaCode.slice(0, 5) })
    if (metro?.rpp && metro.name !== 'United States') return { rpp: metro.rpp, basis: 'metro' }
  }
  const fips = STATE_FIPS[c.st]
  const state = fips ? costsFor({ stateFips: fips }) : null
  return state?.rpp && state.name !== 'United States' ? { rpp: state.rpp, basis: 'state' } : null
}

export async function buildRankings(now = new Date()): Promise<{ edition: string; built: number; skipped: string[]; cities: number; counties: number }> {
  const edition = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
  const builtAt = now.toISOString()
  const [citiesRaw, countiesRaw] = await Promise.all([loadCityStats(), loadCountyStats()])
  // A city is keyed the way the place pages key it ("st. louis" and "st louis" are one place); if two spellings both qualify, the bigger sample stands.
  const keyed = new Map<string, CityStat>()
  for (const c of citiesRaw) {
    const city = placeKey(c.city) || c.city
    const k = `${c.st}|${city}`
    if (!keyed.has(k) || (keyed.get(k) as CityStat).n < c.n) keyed.set(k, { ...c, city })
  }
  const cities = [...keyed.values()]
  const states = [...new Set(cities.map((c) => c.st))]
  const [info, hrefs] = await Promise.all([placeInfo(states), countyHrefs([...new Set(countiesRaw.map((c) => c.st))])])
  const counties: CountyStat[] = countiesRaw.map((c) => ({ ...c, href: hrefs.get(c.fips) ?? c.href }))
  const infoOf = (c: CityStat): PlaceInfo => info.get(`${c.st}|${c.city}`) ?? { name: titleCase(c.city), href: null }
  const ctx = { costOf: (c: CityStat) => costOf(c, infoOf(c).name) }

  const byState = new Map<string, number>()
  for (const c of cities) byState.set(c.st, (byState.get(c.st) ?? 0) + c.n)
  const topStates = [...byState].sort((a, b) => b[1] - a[1]).map(([st]) => st)

  const earlier = new Map((await readRankingIndex()).map((e) => [e.slug, e.editions]))
  const entries: RankingIndexEntry[] = []
  const placeRanks: PlaceRanks = {}
  const skipped: string[] = []
  const prevEd = previousEdition(edition)
  for (const spec of wave1Specs(topStates)) {
    const prev = await readRanking(spec.slug, prevEd).catch(() => null)
    const prevRanks = prev ? new Map(prev.rows.map((r) => [r.key, r.rank])) : null
    const ed: RankingEdition | null = spec.measure === 'growth' || spec.measure === 'infogrowth'
      ? rankCounties(spec, counties, edition, builtAt, prevRanks)
      : rankCities(spec, cities, infoOf, ctx, edition, builtAt, prevRanks)
    if (!ed) { skipped.push(spec.slug); continue }
    await writeRanking(ed)
    for (const r of ed.rows.slice(0, 25)) (placeRanks[r.key] ??= []).push({ slug: ed.slug, title: ed.title, rank: r.rank, valueLabel: r.valueLabel, places: ed.rows.length })
    entries.push({ slug: ed.slug, edition, title: ed.title, family: ed.family, measure: ed.measure, scopeKind: ed.scope.kind, scopeId: ed.scope.id, scopeName: ed.scope.name, topName: ed.rows[0].name, topValueLabel: ed.rows[0].valueLabel, places: ed.rows.length, editions: [...new Set([edition, ...(earlier.get(ed.slug) ?? [])])].sort().reverse() })
  }
  for (const k of Object.keys(placeRanks)) placeRanks[k].sort((a, b) => a.rank - b.rank)
  await writeRankingIndex(entries)
  await writePlaceRanks(placeRanks)
  return { edition, built: entries.length, skipped, cities: cities.length, counties: counties.length }
}
