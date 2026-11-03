import 'server-only'
import { lookupAreaCode } from '@/lib/market/metro-areas'
import { costsFor } from '@/lib/market/area-costs'
import { getStateCities, getStateCityPlaces, getStateCounties, placeUrl } from '@/lib/places/places'
import { placeKey } from '@/lib/workforce/places'
import { ALL_STATE_CODES, stateSlug } from '@/lib/seo/states'
import { getStateCollegeListings } from '@/lib/seo/college-pages'
import { collegePath } from '@/lib/seo/college-bar'
import { FAMILIES, collegeSpecs, functionSpecs, industrySpecs, rankCities, rankColleges, rankCounties, rankIndustries, rankSkills, skillSpecs, wave1Specs, wave2PlaceSpecs, workforceSpecs, type Spec } from '@/lib/rankings/build-edition'
import { STATE_FIPS } from '@/lib/rankings/regions'
import { loadCityStats, loadCountyStats, loadFunctionCityRows, loadIndustryStats, loadSkillStats } from '@/lib/rankings/scan'
import { awardEntries } from '@/lib/rankings/awards'
import { addToAwardBook, awardBookExists, previousEdition, rebuildAwardBook, readPlaceRanksRaw, readRanking, readRankingIndex, writePlaceRanks, writeRanking, writeRankingIndex } from '@/lib/rankings/store'
import type { BuildGroup, CityStat, CollegeStat, CountyStat, PlaceInfo, PlaceRanks, RankingEdition, RankingIndexEntry } from '@/lib/rankings/types'
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

/** Every college with published earnings and its page address, and the set of cities (state|placekey) that have a college. */
async function loadColleges(): Promise<{ colleges: CollegeStat[]; collegeCities: Set<string> }> {
  const colleges: CollegeStat[] = []
  const collegeCities = new Set<string>()
  for (const st of ALL_STATE_CODES) {
    const list = await getStateCollegeListings(st).catch(() => [])
    for (const c of list) {
      if (c.city) collegeCities.add(`${st}|${placeKey(c.city)}`)
      if (c.earnings10 == null || !c.enrollment) continue
      colleges.push({
        unitid: c.unitid, name: c.name, st, href: collegePath(stateSlug(st), c.slug), control: c.control, level: c.level,
        enrollment: c.enrollment, earnings10: c.earnings10, completionRate: c.completionRate, netPrice: c.netPrice,
      })
    }
  }
  return { colleges, collegeCities }
}

export interface BuildResult { group: BuildGroup; edition: string; built: number; skipped: string[]; cities?: number; counties?: number }

/**
 * Keys a city the way the place pages key it. A posting's city ("st. louis", "foster city") is matched to a place by its own
 * spelling, then by the normalised one ("st louis"), so "Foster City" keeps its name and link; if two spellings both qualify, the
 * bigger sample stands.
 */
function keyCities(raw: CityStat[], has: (key: string) => boolean): CityStat[] {
  const keyed = new Map<string, CityStat>()
  for (const c of raw) {
    const city = [c.city, placeKey(c.city)].find((x) => x && has(`${c.st}|${x}`)) ?? c.city
    const k = `${c.st}|${city}`
    if (!keyed.has(k) || (keyed.get(k) as CityStat).n < c.n) keyed.set(k, { ...c, city })
  }
  return [...keyed.values()]
}

/**
 * Builds one group's lists for this month and stores them. The groups run as separate monthly jobs so that each stays inside the
 * time limit: "places" (cities and counties), "functions" (job-family city lists) and "skills" (AI skills, tools, certifications).
 */
export async function buildRankings(group: BuildGroup = 'places', now = new Date()): Promise<BuildResult> {
  const edition = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
  const builtAt = now.toISOString()
  const prevEd = previousEdition(edition)
  const built: { ed: RankingEdition; spec: Spec }[] = []
  const skipped: string[] = []
  let specs: Spec[] = []
  let cityCount: number | undefined
  let countyCount: number | undefined
  const prevRanksOf = async (slug: string) => {
    const prev = await readRanking(slug, prevEd).catch(() => null)
    return prev ? new Map(prev.rows.map((r) => [r.key, r.rank])) : null
  }

  if (group === 'skills') {
    specs = skillSpecs()
    const { stats, totals } = await loadSkillStats()
    for (const spec of specs) {
      const ed = rankSkills(spec, stats, totals, edition, builtAt, await prevRanksOf(spec.slug))
      ed ? built.push({ ed, spec }) : skipped.push(spec.slug)
    }
    // The industry lists build in this group too: one more pass over the board, no city work.
    const industries = industrySpecs()
    specs = [...specs, ...industries]
    const industryStats = await loadIndustryStats()
    for (const spec of industries) {
      const ed = rankIndustries(spec, industryStats, edition, builtAt, await prevRanksOf(spec.slug))
      ed ? built.push({ ed, spec }) : skipped.push(spec.slug)
    }
  } else if (group === 'workforce') {
    const raw = await loadCountyStats()
    const hrefs = await countyHrefs([...new Set(raw.map((c) => c.st))])
    const counties: CountyStat[] = raw.map((c) => ({ ...c, href: hrefs.get(c.fips) ?? c.href }))
    countyCount = counties.length
    specs = workforceSpecs()
    for (const spec of specs) {
      const ed = rankCounties(spec, counties, edition, builtAt, await prevRanksOf(spec.slug))
      ed ? built.push({ ed, spec }) : skipped.push(spec.slug)
    }
  } else if (group === 'college') {
    const [citiesRaw, { colleges, collegeCities }] = await Promise.all([loadCityStats(), loadColleges()])
    const info = await placeInfo([...new Set(citiesRaw.map((c) => c.st))])
    const cities = keyCities(citiesRaw, (k) => info.has(k))
    cityCount = cities.length
    const infoOf = (c: CityStat): PlaceInfo => info.get(`${c.st}|${c.city}`) ?? { name: titleCase(c.city), href: null }
    const perState = new Map<string, number>()
    for (const c of colleges) if (c.enrollment >= 500) perState.set(c.st, (perState.get(c.st) ?? 0) + 1)
    specs = collegeSpecs([...perState].filter(([, n]) => n >= 8).map(([st]) => st).sort())
    const towns = cities.filter((c) => collegeCities.has(`${c.st}|${c.city}`))
    for (const spec of specs) {
      const prev = await prevRanksOf(spec.slug)
      const ed = spec.measure === 'collegepay'
        ? rankColleges(spec, colleges, edition, builtAt, prev)
        : rankCities(spec, towns, infoOf, { costOf: () => null }, edition, builtAt, prev)
      ed ? built.push({ ed, spec }) : skipped.push(spec.slug)
    }
  } else {
    const [citiesRaw, extra] = await Promise.all([
      loadCityStats(),
      group === 'functions' ? loadFunctionCityRows(FAMILIES.map((f) => f.fn)) : loadCountyStats(),
    ])
    const info = await placeInfo([...new Set(citiesRaw.map((c) => c.st))])
    const cities = keyCities(citiesRaw, (k) => info.has(k))
    cityCount = cities.length
    const infoOf = (c: CityStat): PlaceInfo => info.get(`${c.st}|${c.city}`) ?? { name: titleCase(c.city), href: null }
    const ctx = { costOf: (c: CityStat) => costOf(c, infoOf(c).name) }
    const byState = new Map<string, number>()
    for (const c of cities) byState.set(c.st, (byState.get(c.st) ?? 0) + c.n)
    const topStates = [...byState].sort((a, b) => b[1] - a[1]).map(([st]) => st)

    if (group === 'functions') {
      specs = functionSpecs()
      const base = new Map(cities.map((c) => [`${c.st}|${c.city}`, c]))
      const rows = extra as Awaited<ReturnType<typeof loadFunctionCityRows>>
      for (const spec of specs) {
        // One family's openings by city, carrying the city's concentration and employers; the family's counts replace the city's.
        const slice: CityStat[] = []
        for (const r of rows) {
          if (r.fn !== spec.fn) continue
          const b = base.get(`${r.st}|${placeKey(r.city) || r.city}`)
          if (!b) continue
          slice.push({ ...b, n: r.n, paid: r.paid, payMed: r.payMed, cityN: b.n, entry: 0, ai: 0, remote: 0, eng: 0, engPaid: 0, engPay: null, mid: 0, exec: 0 })
        }
        const ed = rankCities(spec, slice, infoOf, ctx, edition, builtAt, await prevRanksOf(spec.slug))
        ed ? built.push({ ed, spec }) : skipped.push(spec.slug)
      }
    } else {
      const hrefs = await countyHrefs([...new Set((extra as CountyStat[]).map((c) => c.st))])
      const counties: CountyStat[] = (extra as CountyStat[]).map((c) => ({ ...c, href: hrefs.get(c.fips) ?? c.href }))
      countyCount = counties.length
      specs = [...wave1Specs(topStates), ...wave2PlaceSpecs()]
      for (const spec of specs) {
        const prev = await prevRanksOf(spec.slug)
        const ed = spec.measure === 'growth' || spec.measure === 'infogrowth'
          ? rankCounties(spec, counties, edition, builtAt, prev)
          : rankCities(spec, cities, infoOf, ctx, edition, builtAt, prev)
        ed ? built.push({ ed, spec }) : skipped.push(spec.slug)
      }
    }
  }

  // Store the editions, then merge this group's entries into the index and its places into the place-rank figure.
  const entries: RankingIndexEntry[] = []
  const earlier = new Map((await readRankingIndex()).map((e) => [e.slug, e.editions]))
  const placeRanks: PlaceRanks = {}
  for (const { ed } of built) {
    await writeRanking(ed)
    entries.push({
      slug: ed.slug, edition, title: ed.title, family: ed.family, measure: ed.measure, scopeKind: ed.scope.kind, scopeId: ed.scope.id, scopeName: ed.scope.name,
      topName: ed.rows[0].name, topValueLabel: ed.rows[0].valueLabel, places: ed.rows.length, group,
      editions: [...new Set([edition, ...(earlier.get(ed.slug) ?? [])])].sort().reverse(),
    })
    if (ed.placeNoun === 'cities' || ed.placeNoun === 'counties') {
      for (const r of ed.rows.slice(0, 25)) (placeRanks[r.key] ??= []).push({ slug: ed.slug, title: ed.title, rank: r.rank, valueLabel: r.valueLabel, places: ed.rows.length })
    }
  }
  const mine = new Set(specs.map((x) => x.slug))
  const index = (await readRankingIndex()).filter((e) => !mine.has(e.slug) && (e.group ?? 'places') !== group)
  await writeRankingIndex([...index, ...entries])
  // Every month's placings are kept (awards.ts). The first build after they shipped rebuilds them from the stored editions, so
  // the months already published are included; after that each build adds its own.
  if (await awardBookExists()) await addToAwardBook(built.flatMap(({ ed }) => awardEntries(ed)))
  else await rebuildAwardBook()
  if (group !== 'skills') {
    const merged: PlaceRanks = {}
    for (const [k, list] of Object.entries(await readPlaceRanksRaw())) {
      const keep = list.filter((x) => !mine.has(x.slug))
      if (keep.length) merged[k] = keep
    }
    for (const [k, list] of Object.entries(placeRanks)) merged[k] = [...(merged[k] ?? []), ...list]
    for (const k of Object.keys(merged)) merged[k].sort((a, b) => a.rank - b.rank)
    await writePlaceRanks(merged)
  }
  return { group, edition, built: entries.length, skipped, cities: cityCount, counties: countyCount }
}
