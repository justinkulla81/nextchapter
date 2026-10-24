import 'server-only'
import { prisma } from '@/lib/prisma'
import { ttlCached } from '@/lib/admin/ttl-cache'
import { listPrograms } from '@/lib/benefits/store'
import { lookupSocCode } from '@/lib/market/soc-codes'
import { loadCountyContext } from './county-context-data'
import { placeKeys } from './places'
import { jobsByCounty } from './county-context'
import {
  bucketSectors, compareRows, factsFor, metroForCounty, parseMetros, shortMetroName,
  type Incentives, type LaborRow, type Metro, type MetroFacts, type MetroFile, type PlaceView,
} from './metro-compare'

/** The 387 metro areas, read on first use so other routes do not carry the file. */
let metrosP: Promise<Metro[]> | null = null
export function loadMetros(): Promise<Metro[]> {
  metrosP ??= import('./data/metro-compare.json').then((f) => parseMetros(f.default as unknown as MetroFile))
  return metrosP
}

/** County unemployment rows, one query for every county. */
const laborRows = ttlCached(10 * 60 * 1000, async () => {
  const rows = await prisma.countyLabor.findMany({ select: { fips: true, state: true, laborForce: true, unemployed: true, rateYearAgo: true, period: true } })
  return new Map<string, LaborRow & { state: string }>(rows.filter((r) => r.period !== 'none').map((r) => [r.fips, r]))
})

/**
 * Open roles on the job board by county, all of them and (when given) those in one
 * occupation group: postings are grouped by the city they name and each city goes to its county.
 */
const rolesByCounty = ttlCached(10 * 60 * 1000, async (socMajor: string | null) => {
  const [groups, { placeCounty }] = await Promise.all([
    prisma.$queryRaw<{ st: string; city: string; n: bigint }[]>`
      select "locationState" st, "locationCity" city, count(*) n from "ExclusiveJobPosting"
       where status = 'approved' and "archivedAt" is null and "locationState" is not null and "locationCity" is not null
         and (${socMajor}::text is null or regexp_replace(coalesce("socCode", ''), '\\D', '', 'g') like ${socMajor ?? ''} || '%')
       group by 1, 2`,
    loadCountyContext(),
  ])
  return jobsByCounty(groups.map((g) => ({ ...g, n: Number(g.n) })), placeCounty, placeKeys)
}, (socMajor) => socMajor ?? 'all')

/** The metro a member lives in, from their city and state; null when the city is not one we can place. */
export async function currentMetro(city: string | null, state: string | null): Promise<Metro | null> {
  if (!city || !state) return null
  const [{ placeCounty }, metros] = await Promise.all([loadCountyContext(), loadMetros()])
  const code = state.length === 2 ? state.toUpperCase() : null
  if (!code) return null
  const fips = placeKeys(city).map((k) => placeCounty[`${code}|${k}`]).find(Boolean)
  return metroForCounty(metros, fips)
}

export interface Member {
  primaryFunction: string | null
  industryBucket: string | null
}

async function metroFacts(metro: Metro, member: Member): Promise<MetroFacts> {
  const [labor, { context }, soc] = await Promise.all([laborRows(), loadCountyContext(), Promise.resolve(lookupSocCode(member.primaryFunction))])
  const socMajor = soc ? soc.code.slice(0, 2) : null
  const [roles, fieldRoles] = await Promise.all([rolesByCounty(null), socMajor ? rolesByCounty(socMajor) : Promise.resolve(null)])
  const states = [...new Set(metro.counties.map((f) => labor.get(f)?.state).filter((s): s is string => !!s))]
  return factsFor({ metro, states, labor, context, roles, fieldRoles, sectorCodes: bucketSectors(member.industryBucket) })
}

/**
 * Open programs in the benefits catalog's relocation category for the destination state. Only OPEN and ROLLING ones
 * (a closed or unchecked one is not help someone can count on), and not rows filed under the state whose locality
 * names another state (the catalog has some). The category also holds local job and housing programs, so the
 * page says "in our relocation catalog" and not "pays you to move".
 */
async function incentivesFor(state: string | undefined): Promise<Incentives | null> {
  if (!state) return null
  try {
    const rows = await listPrograms({ category: 'RELOCATION', state, limit: 200 })
    const live = rows.filter((r) => r.state === state && (r.status === 'OPEN' || r.status === 'ROLLING') && !/^[A-Z]{2}$/.test(r.locality ?? '') && !r.name.startsWith('(none'))
    if (live.length === 0) return null
    return { state, count: live.length, names: live.slice(0, 2).map((r) => r.name) }
  } catch {
    return null // the benefits table is applied by hand and may not be there yet
  }
}

/** Where the member lives and each chosen place, all measured the same way. */
export async function comparePlaces(args: { current: Metro | null; chosen: Metro[]; member: Member }) {
  const { current, chosen, member } = args
  const [curFacts, destFacts] = await Promise.all([
    current ? metroFacts(current, member) : Promise.resolve(null),
    Promise.all(chosen.map((m) => metroFacts(m, member))),
  ])
  const fieldName = lookupSocCode(member.primaryFunction)?.title ?? null
  const opts = { salary: 100_000, fieldName }
  const places: PlaceView[] = await Promise.all(
    destFacts.map(async (f) => {
      const rows = compareRows(f, curFacts, opts)
      return { cbsa: f.cbsa, name: shortMetroName(f.name), rows, incentives: await incentivesFor(f.states[0]) }
    }),
  )
  return {
    current: curFacts ? { name: shortMetroName(curFacts.name), rows: compareRows(curFacts, null, opts) } : null,
    places,
    fieldName,
  }
}
