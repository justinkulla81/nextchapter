import 'server-only'
import { cache } from 'react'
import { Prisma } from '@prisma/client'
import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { heavy, memoTtl } from '@/lib/db/heavy'
import { PUBLIC_JOB_LIVE_SQL, PUBLIC_JOB_STATIC_SQL } from '@/lib/jobs/public-job-page-server'
import { boardCountyKeys } from '@/lib/workforce/board-area'
import { areaPlaces, countyKey, placeKey } from '@/lib/workforce/places'
import { employerSlug } from '@/lib/seo/employer-slug'
import { ALL_STATE_CODES } from '@/lib/seo/states'
import { getStateBoards, slugify, type PublicBoard } from '@/lib/seo/workforce-pages'
import { TWELVE_MONTHS_MS, TWENTY_FOUR_MONTHS_MS, getPublicNotices, type PublicNotice } from '@/lib/warn/layoff-pages'

// Public place pages: /places/<state>, /places/<state>/county/<county>, /places/<state>/city/<city>.
// One page per place, built from tables we already hold: Census/ACS and BLS (GeoArea, CountyLabor),
// IPEDS colleges, CareerOneStop boards and job centers, the WARN record, and the live public job board.
// A city page exists only when it has something of its own to say (CITY_BAR below); every county and
// state has one.

/** Open public roles a city needs before it gets a page on jobs alone. */
export const CITY_MIN_JOBS = 3

const CENSUS_SUFFIX = /\s+(city and borough|city|town|village|cdp|borough|municipality|township|plantation|comunidad|zona urbana)$/i

/** "Bay Minette city" → "Bay Minette". */
export function cityDisplayName(name: string): string {
  return name
    .replace(/\s+\(balance\)$/i, '')
    .replace(/\s+(consolidated|metro(?:politan)?|unified) government$/i, '')
    .replace(CENSUS_SUFFIX, '')
    .trim()
}

// ---------------------------------------------------------------------------------------------
// Counties

export interface County {
  fips: string
  state: string
  name: string
  slug: string
  population: number | null
  laborForce: number | null
  unemploymentRate: number | null
  unemploymentRatePrior: number | null
  asOf: string | null
  medianHouseholdIncome: number | null
  perCapitaIncome: number | null
  whiteCollarShare: number | null
  wcUnemploymentEst: number | null
  bcUnemploymentEst: number | null
  higherEdCount: number
  higherEdEnrollmentEst: number
  builtAt: Date | null
}

const COUNTY_SELECT = {
  id: true, state: true, name: true, population: true, laborForce: true, unemploymentRate: true, unemploymentRatePrior: true,
  unemploymentAsOf: true, medianHouseholdIncome: true, perCapitaIncome: true, whiteCollarShare: true, wcUnemploymentEst: true,
  bcUnemploymentEst: true, higherEdCount: true, higherEdEnrollmentEst: true, dataBuiltAt: true,
} satisfies Prisma.GeoAreaSelect

/** A state's county rows (alphabetical) as pages: a slug unique within the state. */
function toCounties(rows: Prisma.GeoAreaGetPayload<{ select: typeof COUNTY_SELECT }>[]): County[] {
  const count = new Map<string, number>()
  for (const r of rows) count.set(slugify(r.name), (count.get(slugify(r.name)) ?? 0) + 1)
  return rows.map((r) => ({
    fips: r.id, state: r.state, name: r.name,
    slug: (count.get(slugify(r.name)) ?? 0) > 1 ? `${slugify(r.name)}-${r.id}` : slugify(r.name),
    population: r.population, laborForce: r.laborForce, unemploymentRate: r.unemploymentRate, unemploymentRatePrior: r.unemploymentRatePrior,
    asOf: r.unemploymentAsOf, medianHouseholdIncome: r.medianHouseholdIncome, perCapitaIncome: r.perCapitaIncome,
    whiteCollarShare: r.whiteCollarShare, wcUnemploymentEst: r.wcUnemploymentEst, bcUnemploymentEst: r.bcUnemploymentEst,
    higherEdCount: r.higherEdCount, higherEdEnrollmentEst: r.higherEdEnrollmentEst, builtAt: r.dataBuiltAt,
  }))
}

/** Every county in a state, alphabetical, with a slug unique within the state. */
export const getStateCounties = cache(async (state: string): Promise<County[]> => {
  const rows = await prisma.geoArea.findMany({ where: { level: 'COUNTY', state }, select: COUNTY_SELECT, orderBy: { name: 'asc' } })
  return toCounties(rows)
})

/** Every county in every state, in one query (the sitemap: 51 queries at once would exhaust the connection pool). */
export async function getAllCounties(): Promise<Map<string, County[]>> {
  const rows = await prisma.geoArea.findMany({ where: { level: 'COUNTY' }, select: COUNTY_SELECT, orderBy: [{ state: 'asc' }, { name: 'asc' }] })
  const byState = new Map<string, typeof rows>()
  for (const r of rows) byState.set(r.state, [...(byState.get(r.state) ?? []), r])
  return new Map([...byState].map(([state, list]) => [state, toCounties(list)]))
}

export interface StateArea {
  code: string
  name: string
  population: number | null
  laborForce: number | null
  unemploymentRate: number | null
  unemploymentRatePrior: number | null
  asOf: string | null
  medianHouseholdIncome: number | null
  whiteCollarShare: number | null
  higherEdCount: number
  higherEdEnrollmentEst: number
}

export const getStateArea = cache(async (state: string): Promise<StateArea | null> => {
  const r = await prisma.geoArea.findFirst({ where: { level: 'STATE', state } })
  if (!r) return null
  return {
    code: state, name: r.name, population: r.population, laborForce: r.laborForce, unemploymentRate: r.unemploymentRate,
    unemploymentRatePrior: r.unemploymentRatePrior, asOf: r.unemploymentAsOf, medianHouseholdIncome: r.medianHouseholdIncome,
    whiteCollarShare: r.whiteCollarShare, higherEdCount: r.higherEdCount, higherEdEnrollmentEst: r.higherEdEnrollmentEst,
  }
})

// ---------------------------------------------------------------------------------------------
// Cities

export interface CityPlace {
  id: string
  state: string
  name: string
  slug: string
  /** placeKey of the Census name: how filings, jobs and centers spell it. */
  key: string
  population: number | null
  county: string | null
  lat: number
  lon: number
}

/** Census places in a state (not county subdivisions), one per name key — the biggest wins a shared name. */
export const getStateCityPlaces = cache(async (state: string): Promise<CityPlace[]> => {
  const rows = await prisma.geoPlace.findMany({
    where: { state, NOT: { name: { endsWith: 'CCD' } } },
    select: { id: true, state: true, name: true, nameKey: true, population: true, county: true, lat: true, lon: true },
    orderBy: [{ population: { sort: 'desc', nulls: 'last' } }, { name: 'asc' }],
  })
  const seen = new Set<string>()
  const slugs = new Set<string>()
  const out: CityPlace[] = []
  for (const r of rows) {
    if (seen.has(r.nameKey)) continue
    seen.add(r.nameKey)
    const name = cityDisplayName(r.name)
    let slug = slugify(name)
    if (!slug) continue
    if (slugs.has(slug)) slug = `${slug}-${slugify(r.county ?? r.id)}`
    if (slugs.has(slug)) continue
    slugs.add(slug)
    out.push({ id: r.id, state: r.state, name, slug, key: r.nameKey, population: r.population, county: r.county, lat: r.lat, lon: r.lon })
  }
  return out
})

// ---------------------------------------------------------------------------------------------
// Jobs, job centers, colleges

const jobsWhere = (extra: Prisma.Sql) => Prisma.sql`WHERE ${PUBLIC_JOB_STATIC_SQL} AND ${PUBLIC_JOB_LIVE_SQL} ${extra}`

/** Open public roles: for each state its total, and the count for each city (placeKey), from one scan of the board. */
type JobAggregate = [state: string, total: number, cities: [key: string, n: number][]][]

async function loadJobAggregate(): Promise<JobAggregate> {
  const rows = await prisma.$queryRaw<{ st: string; city: string | null; n: number }[]>`
    SELECT "locationState" AS st, lower("locationCity") AS city, count(*)::int AS n
    FROM "ExclusiveJobPosting"
    ${jobsWhere(Prisma.sql`AND "locationState" IS NOT NULL`)}
    GROUP BY 1, 2`
  const by = new Map<string, { total: number; cities: Map<string, number> }>()
  for (const r of rows) {
    const e = by.get(r.st) ?? { total: 0, cities: new Map<string, number>() }
    e.total += r.n
    const k = r.city ? placeKey(r.city) : ''
    if (k) e.cities.set(k, (e.cities.get(k) ?? 0) + r.n)
    by.set(r.st, e)
  }
  return [...by].map(([st, e]) => [st, e.total, [...e.cities]])
}

// One scan of the board serves every place page: a state's job counts used to be a scan each, and Texas's timed out (the
// database's statement timeout) while crawlers asked for county and city pages. The result is kept in the data cache for six
// hours, shared by every instance, and rebuilt into maps once per instance per ten minutes. The scan runs through heavy().
const cachedJobAggregate = unstable_cache(() => heavy(loadJobAggregate), ['places-job-aggregate-v1'], { revalidate: 6 * 60 * 60 })
const sharedJobAggregate = memoTtl(
  10 * 60_000,
  () => '*',
  async () => new Map((await cachedJobAggregate()).map(([st, total, cities]) => [st, { total, cities: new Map(cities) }] as const)),
)
const getJobAggregate = cache(() => sharedJobAggregate())

/** Open public roles by city key for one state, or every state when none is given. */
const getJobCounts = cache(async (state: string | null): Promise<Map<string, Map<string, number>>> => {
  const all = await getJobAggregate()
  const out = new Map<string, Map<string, number>>()
  for (const [st, e] of all) if (!state || st === state) out.set(st, e.cities)
  return out
})

const getStateJobTotal = cache(async (state: string): Promise<number> => (await getJobAggregate()).get(state)?.total ?? 0)

export interface PlaceCenter { id: string; name: string; kind: string | null; city: string | null; phone: string | null; hours: string | null; detailsUrl: string | null; boardId: string | null; countyFips: string | null; state: string }
export interface PlaceCollege { id: string; name: string; city: string | null; sector: number | null; size: number | null; website: string | null; countyFips: string | null; state: string }

const loadCenters = cache(async (state: string | null): Promise<PlaceCenter[]> => {
  const rows = await prisma.americanJobCenter.findMany({
    where: state ? { state } : {},
    select: { id: true, name: true, centerType: true, city: true, phone: true, hours: true, detailsUrl: true, workforceBoardId: true, countyFips: true, state: true },
    orderBy: [{ city: 'asc' }, { name: 'asc' }],
  })
  return rows.map((r) => ({ id: r.id, name: r.name, kind: r.centerType, city: r.city, phone: r.phone, hours: r.hours, detailsUrl: r.detailsUrl, boardId: r.workforceBoardId, countyFips: r.countyFips, state: r.state }))
})

const loadColleges = cache(async (state: string | null): Promise<PlaceCollege[]> => {
  const rows = await prisma.localCollege.findMany({
    where: { ...(state ? { state } : {}), sector: { in: [1, 2, 4, 5] } },
    select: { id: true, name: true, city: true, sector: true, size: true, website: true, countyFips: true, state: true },
    orderBy: [{ size: { sort: 'desc', nulls: 'last' } }, { name: 'asc' }],
  })
  return rows
})

// ---------------------------------------------------------------------------------------------
// Layoffs (WARN)

const cutoff12 = () => Date.now() - TWELVE_MONTHS_MS
const cutoff24 = () => Date.now() - TWENTY_FOUR_MONTHS_MS

const isCountyPlace = (p: string | null): p is string => !!p && /\s(County|Parish)$/i.test(p)

/**
 * Which county and/or city a notice's "place" text names. States write it three ways: "Harris County", "Jefferson County -
 * Louisville" (both), or a bare name ("Boone", "Louisville") that is a city when the state has a city of that name and a
 * county otherwise.
 */
export function noticeAreas(place: string | null, cityKeys: Set<string>): { county: string | null; city: string | null } {
  if (!place) return { county: null, city: null }
  const both = place.match(/^(.+?)\s+(?:County|Parish)\s*[-–,]\s*(.+)$/i)
  if (both) return { county: both[1], city: both[2] }
  if (isCountyPlace(place)) return { county: place, city: null }
  return cityKeys.has(placeKey(place)) ? { county: null, city: place } : { county: place, city: null }
}

export interface LayoffStats { notices: number; workers: number; employers: number }
export function layoffStats(notices: PublicNotice[]): LayoffStats {
  const recent = notices.filter((n) => n.noticeDate.getTime() >= cutoff12())
  return { notices: recent.length, workers: recent.reduce((s, n) => s + (n.workers ?? 0), 0), employers: new Set(recent.map((n) => n.slug)).size }
}

// ---------------------------------------------------------------------------------------------
// City index: the cities in a state that pass the bar, with what each has

export interface CityEntry {
  state: string
  slug: string
  name: string
  population: number | null
  county: string | null
  jobs: number
  notices: number
  workers: number
  centers: number
  colleges: number
}

function buildCityEntries(
  places: CityPlace[], jobs: Map<string, number>, notices: PublicNotice[], centers: PlaceCenter[], colleges: PlaceCollege[],
): CityEntry[] {
  const byKey = new Map(places.map((p) => [p.key, p]))
  const keySet = new Set(byKey.keys())
  const tally = new Map<string, { notices: number; workers: number; centers: number; colleges: number }>()
  const at = (k: string) => tally.get(k) ?? tally.set(k, { notices: 0, workers: 0, centers: 0, colleges: 0 }).get(k)!
  const c24 = cutoff24()
  for (const n of notices) {
    if (n.noticeDate.getTime() < c24) continue
    const city = noticeAreas(n.place, keySet).city
    if (!city) continue
    const k = placeKey(city)
    if (!byKey.has(k)) continue
    const t = at(k)
    t.notices++
    t.workers += n.workers ?? 0
  }
  for (const c of centers) if (c.city && byKey.has(placeKey(c.city))) at(placeKey(c.city)).centers++
  for (const c of colleges) if (c.city && byKey.has(placeKey(c.city))) at(placeKey(c.city)).colleges++
  const out: CityEntry[] = []
  for (const p of places) {
    const t = tally.get(p.key)
    const j = jobs.get(p.key) ?? 0
    const passes = j >= CITY_MIN_JOBS || (t && (t.notices > 0 || t.centers > 0 || t.colleges > 0))
    if (!passes) continue
    out.push({ state: p.state, slug: p.slug, name: p.name, population: p.population, county: p.county, jobs: j, notices: t?.notices ?? 0, workers: t?.workers ?? 0, centers: t?.centers ?? 0, colleges: t?.colleges ?? 0 })
  }
  return out
}

const byActivity = (a: CityEntry, b: CityEntry) => b.jobs + b.notices * 5 - (a.jobs + a.notices * 5) || (b.population ?? 0) - (a.population ?? 0) || a.name.localeCompare(b.name)

async function loadStateCities(state: string): Promise<CityEntry[]> {
  const [places, jobs, notices, centers, colleges] = await Promise.all([
    getStateCityPlaces(state), getJobCounts(state), getPublicNotices(), loadCenters(state), loadColleges(state),
  ])
  return buildCityEntries(places, jobs.get(state) ?? new Map(), notices.filter((n) => n.state === state), centers, colleges).sort(byActivity)
}
const sharedStateCities = memoTtl(10 * 60_000, (state: string) => state, loadStateCities)
/** The cities in a state that have a page, most active first. */
export const getStateCities = cache((state: string) => sharedStateCities(state))

/** Every state's cities with a page, for the sitemap. */
export async function getAllCityEntries(): Promise<CityEntry[]> {
  const [jobs, notices, centers, colleges] = await Promise.all([getJobCounts(null), getPublicNotices(), loadCenters(null), loadColleges(null)])
  const out: CityEntry[] = []
  for (const state of ALL_STATE_CODES) {
    const places = await getStateCityPlaces(state)
    out.push(...buildCityEntries(places, jobs.get(state) ?? new Map(), notices.filter((n) => n.state === state), centers.filter((c) => c.state === state), colleges.filter((c) => c.state === state)))
  }
  return out
}

// ---------------------------------------------------------------------------------------------
// Employers and jobs in a place

export interface PlaceEmployer { name: string; openRoles: number; href: string | null }
export interface PlaceJob { id: string; title: string; company: string; verifiedAt: Date | null }

/** Employers with the most open public roles in a state, optionally limited to some cities (lowercase spellings). */
async function loadTopHiringEmployers(state: string, cityNames: string[] | null, limit: number): Promise<PlaceEmployer[]> {
  const rows = await prisma.$queryRaw<{ name: string; n: number; cn: string | null; cid: string | null; linkable: boolean | null }[]>`
    SELECT g.name, g.n, c."canonicalNameNormalized" AS cn, c.id AS cid, (p."openNow" >= 3) AS linkable
    FROM (
      SELECT "companyName" AS name, "companyId" AS cid, count(*)::int AS n
      FROM "ExclusiveJobPosting"
      ${jobsWhere(Prisma.sql`AND "locationState" = ${state} ${cityNames ? Prisma.sql`AND lower("locationCity") = ANY(${cityNames})` : Prisma.empty}`)}
      GROUP BY 1, 2 ORDER BY n DESC, name LIMIT ${limit}
    ) g
    LEFT JOIN "Company" c ON c.id = g.cid
    LEFT JOIN "CompanyHiringProfile" p ON p."companyId" = c.id
    ORDER BY g.n DESC, g.name`
  return rows.map((r) => ({ name: r.name, openRoles: r.n, href: r.linkable && r.cn && r.cid ? `/employers/${employerSlug(r.cn, r.cid)}` : null }))
}

async function loadRecentJobs(state: string, cityNames: string[], limit: number): Promise<PlaceJob[]> {
  const rows = await prisma.$queryRaw<{ id: string; title: string; company: string; at: Date | null }[]>`
    SELECT id, title, "companyName" AS company, "lastVerifiedAt" AS at
    FROM "ExclusiveJobPosting"
    ${jobsWhere(Prisma.sql`AND "locationState" = ${state} AND lower("locationCity") = ANY(${cityNames})`)}
    ORDER BY "lastVerifiedAt" DESC NULLS LAST, id LIMIT ${limit}`
  return rows.map((r) => ({ id: r.id, title: r.title, company: r.company, verifiedAt: r.at }))
}

const SIZE_LABEL: Record<string, string> = { MID_LARGE: '1,001–5,000 employees', LARGE: '5,001–20,000 employees', ENTERPRISE: '20,001–100,000 employees', MEGA: '100,000+ employees' }

export interface HqEmployer { name: string; size: string; href: string | null; employees: number | null }

const roundedCount = (n: number) => (n >= 10_000 ? Math.round(n / 1000) * 1000 : n >= 1000 ? Math.round(n / 100) * 100 : n)

/**
 * Large employers headquartered in a state (or a city in it). Ranked by a published employee count where we have one
 * (CompanyHeadcount: figure, year and source), then by the company directory's estimated size band.
 */
async function loadLargeEmployersHeadquartered(state: string, cityKeyNames: string[] | null, limit: number): Promise<HqEmployer[]> {
  const rows = await prisma.$queryRaw<{ name: string; band: string | null; cn: string; cid: string; linkable: boolean | null; emp: number | null; yr: number | null }[]>`
    SELECT c.name, c."sizeBand"::text AS band, c."canonicalNameNormalized" AS cn, c.id AS cid, (p."openNow" >= 3) AS linkable,
           hc.employees AS emp, hc."asOfYear" AS yr
    FROM "CompanyHq" h
    JOIN "Company" c ON c.id = h."companyId"
    LEFT JOIN "CompanyHiringProfile" p ON p."companyId" = c.id
    LEFT JOIN "CompanyHeadcount" hc ON hc."companyId" = c.id
    WHERE h.state = ${state} AND h.confidence IN ('high', 'medium')
      AND (c."sizeBand"::text IN ('MID_LARGE', 'LARGE', 'ENTERPRISE', 'MEGA') OR hc.employees >= 1000)
      ${cityKeyNames ? Prisma.sql`AND lower(h.city) = ANY(${cityKeyNames})` : Prisma.empty}
    ORDER BY hc.employees DESC NULLS LAST,
             array_position(ARRAY['MEGA','ENTERPRISE','LARGE','MID_LARGE'], c."sizeBand"::text), c.name
    LIMIT ${limit}`
  return rows.map((r) => ({
    name: r.name,
    employees: r.emp,
    size: r.emp ? `about ${roundedCount(r.emp).toLocaleString('en-US')} employees (${r.yr})` : SIZE_LABEL[r.band ?? ''] ?? '',
    href: r.linkable ? `/employers/${employerSlug(r.cn, r.cid)}` : null,
  }))
}

const key = (...parts: (string | number | string[] | null)[]) => parts.map((p) => (Array.isArray(p) ? p.join(',') : String(p))).join('|')
const sharedTop = memoTtl(10 * 60_000, (a: string, b: string[] | null, c: number) => key(a, b, c), (a: string, b: string[] | null, c: number) => heavy(() => loadTopHiringEmployers(a, b, c)))
const sharedJobs = memoTtl(10 * 60_000, (a: string, b: string[], c: number) => key(a, b, c), (a: string, b: string[], c: number) => heavy(() => loadRecentJobs(a, b, c)))
const sharedHq = memoTtl(10 * 60_000, (a: string, b: string[] | null, c: number) => key(a, b, c), (a: string, b: string[] | null, c: number) => heavy(() => loadLargeEmployersHeadquartered(a, b, c)))
// A state's own lists are one scan of the board each, so they are shared across instances in the data cache for six hours.
const cachedStateTop = unstable_cache((state: string, limit: number) => heavy(() => loadTopHiringEmployers(state, null, limit)), ['places-state-top-hiring-v1'], { revalidate: 6 * 60 * 60 })
const cachedStateHq = unstable_cache((state: string, limit: number) => heavy(() => loadLargeEmployersHeadquartered(state, null, limit)), ['places-state-hq-v1'], { revalidate: 6 * 60 * 60 })
const topHiringEmployers = (state: string, cityNames: string[] | null, limit = 12) => (cityNames ? sharedTop(state, cityNames, limit) : cachedStateTop(state, limit))
const recentJobs = (state: string, cityNames: string[], limit = 10) => sharedJobs(state, cityNames, limit)
const largeEmployersHeadquartered = (state: string, cityKeyNames: string[] | null, limit = 12) => (cityKeyNames ? sharedHq(state, cityKeyNames, limit) : cachedStateHq(state, limit))

/** Lowercase spellings a city might carry on a job: Census key and display name. */
const citySpellings = (p: CityPlace) => [...new Set([p.key, p.name.toLowerCase(), p.name.toLowerCase().replace(/\bsaint\b/g, 'st').replace(/\bst\.\s*/g, 'st ')])]

// ---------------------------------------------------------------------------------------------
// Boards that serve a place

function boardsForCounty(boards: PublicBoard[], county: { name: string }): PublicBoard[] {
  const key = countyKey(county.name).replace(/\s+/g, '')
  return boards.filter((b) => {
    const keys = boardCountyKeys(b)
    return keys === 'all' || keys.includes(key)
  })
}

function boardsForCity(boards: PublicBoard[], city: CityPlace): PublicBoard[] {
  if (city.county) return boardsForCounty(boards, { name: city.county })
  return boards.filter((b) => !b.statewide && areaPlaces(b.serviceArea).includes(city.key))
}

// ---------------------------------------------------------------------------------------------
// Page loaders

export interface StatePage {
  area: StateArea | null
  counties: County[]
  cities: CityEntry[]
  layoffs: LayoffStats
  recentNotices: PublicNotice[]
  jobsOpen: number
  hiring: PlaceEmployer[]
  headquartered: HqEmployer[]
  colleges: PlaceCollege[]
  collegeCount: number
  boards: PublicBoard[]
  centerCount: number
}

export const getStatePage = cache(async (state: string): Promise<StatePage> => {
  const [area, counties, cities, notices, jobsOpen, hiring, headquartered, colleges, boards, centers] = await Promise.all([
    getStateArea(state), getStateCounties(state), getStateCities(state), getPublicNotices(), getStateJobTotal(state),
    topHiringEmployers(state, null), largeEmployersHeadquartered(state, null), loadColleges(state), getStateBoards(state), loadCenters(state),
  ])
  const mine = notices.filter((n) => n.state === state)
  return {
    area, counties, cities, layoffs: layoffStats(mine),
    recentNotices: mine.filter((n) => n.noticeDate.getTime() >= cutoff12()).slice(0, 10),
    jobsOpen, hiring, headquartered, colleges: colleges.slice(0, 12), collegeCount: colleges.length, boards, centerCount: centers.length,
  }
})

export interface CountyPage {
  county: County
  stateName: string
  layoffs: LayoffStats
  notices: PublicNotice[]
  cities: CityEntry[]
  jobsOpen: number
  hiring: PlaceEmployer[]
  headquartered: HqEmployer[]
  colleges: PlaceCollege[]
  centers: PlaceCenter[]
  boards: PublicBoard[]
  neighbors: County[]
}

export async function getCountyPage(state: string, slug: string): Promise<CountyPage | null> {
  const counties = await getStateCounties(state)
  const county = counties.find((c) => c.slug === slug)
  if (!county) return null
  const [places, cityEntries, jobs, notices, colleges, centers, boards] = await Promise.all([
    getStateCityPlaces(state), getStateCities(state), getJobCounts(state), getPublicNotices(), loadColleges(state), loadCenters(state), getStateBoards(state),
  ])
  const inCounty = places.filter((p) => p.county === county.name)
  const cKey = countyKey(county.name)
  const cityKeys = new Set(inCounty.map((p) => p.key))
  const stateKeys = new Set(places.map((p) => p.key))
  const mine = notices.filter((n) => {
    if (n.state !== state) return false
    const a = noticeAreas(n.place, stateKeys)
    return (!!a.county && countyKey(a.county) === cKey) || (!!a.city && cityKeys.has(placeKey(a.city)))
  })
  const stateJobs = jobs.get(state) ?? new Map<string, number>()
  const jobsOpen = inCounty.reduce((s, p) => s + (stateJobs.get(p.key) ?? 0), 0)
  const spellings = [...new Set(inCounty.flatMap(citySpellings))]
  const [hiring, headquartered] = await Promise.all([
    spellings.length && jobsOpen ? topHiringEmployers(state, spellings, 10) : Promise.resolve([]),
    inCounty.length ? largeEmployersHeadquartered(state, [...new Set(inCounty.map((p) => p.name.toLowerCase()))], 10) : Promise.resolve([]),
  ])
  const countyColleges = colleges.filter((c) => c.countyFips === county.fips)
  return {
    county, stateName: state, layoffs: layoffStats(mine), notices: mine.filter((n) => n.noticeDate.getTime() >= cutoff12()),
    cities: cityEntries.filter((c) => c.county === county.name),
    jobsOpen, hiring, headquartered, colleges: countyColleges,
    centers: centers.filter((c) => c.countyFips === county.fips),
    boards: boardsForCounty(boards, county),
    neighbors: [...counties].filter((c) => c.fips !== county.fips).sort((a, b) => (b.population ?? 0) - (a.population ?? 0)).slice(0, 12),
  }
}

export interface CityPage {
  place: CityPlace
  entry: CityEntry
  county: County | null
  layoffs: LayoffStats
  notices: PublicNotice[]
  jobsOpen: number
  jobs: PlaceJob[]
  hiring: PlaceEmployer[]
  headquartered: HqEmployer[]
  colleges: PlaceCollege[]
  centers: PlaceCenter[]
  boards: PublicBoard[]
  nearby: CityEntry[]
}

export async function getCityPage(state: string, slug: string): Promise<CityPage | null> {
  const [places, cityEntries, counties] = await Promise.all([getStateCityPlaces(state), getStateCities(state), getStateCounties(state)])
  const place = places.find((p) => p.slug === slug)
  const entry = cityEntries.find((c) => c.slug === slug)
  if (!place || !entry) return null
  const [notices, colleges, centers, boards] = await Promise.all([getPublicNotices(), loadColleges(state), loadCenters(state), getStateBoards(state)])
  const spellings = citySpellings(place)
  const stateKeys = new Set(places.map((p) => p.key))
  const mine = notices.filter((n) => {
    if (n.state !== state) return false
    const a = noticeAreas(n.place, stateKeys)
    return !!a.city && placeKey(a.city) === place.key
  })
  const county = place.county ? counties.find((c) => c.name === place.county) ?? null : null
  const [hiring, jobs, headquartered] = await Promise.all([
    entry.jobs ? topHiringEmployers(state, spellings, 10) : Promise.resolve([]),
    entry.jobs ? recentJobs(state, spellings, 10) : Promise.resolve([]),
    largeEmployersHeadquartered(state, [place.name.toLowerCase()], 10),
  ])
  return {
    place, entry, county, layoffs: layoffStats(mine), notices: mine.filter((n) => n.noticeDate.getTime() >= cutoff12()),
    jobsOpen: entry.jobs, jobs, hiring, headquartered,
    colleges: colleges.filter((c) => c.city && placeKey(c.city) === place.key),
    centers: centers.filter((c) => c.city && placeKey(c.city) === place.key),
    boards: boardsForCity(boards, place),
    nearby: cityEntries.filter((c) => c.slug !== slug && (place.county ? c.county === place.county : true)).slice(0, 12),
  }
}

/**
 * Turns the "City or county" text on a WARN notice into a link to that place's page, when the place has one.
 * Built once per state page.
 */
export async function getPlaceLinker(state: string): Promise<(place: string | null) => string | null> {
  const [counties, cities] = await Promise.all([getStateCounties(state), getStateCities(state)])
  const stateSlugValue = (await import('@/lib/seo/states')).stateSlug(state)
  const countyBy = new Map(counties.map((c) => [countyKey(c.name), c.slug]))
  const cityBy = new Map<string, string>()
  const places = await getStateCityPlaces(state)
  const hasPage = new Set(cities.map((c) => c.slug))
  const stateKeys = new Set(places.map((p) => p.key))
  for (const p of places) if (hasPage.has(p.slug)) cityBy.set(p.key, p.slug)
  return (place) => {
    const a = noticeAreas(place, stateKeys)
    const city = a.city ? cityBy.get(placeKey(a.city)) : null
    if (city) return `/places/${stateSlugValue}/city/${city}`
    const county = a.county ? countyBy.get(countyKey(a.county)) : null
    return county ? `/places/${stateSlugValue}/county/${county}` : null
  }
}

/** The counties a board serves, with their page slugs (for the board page). */
export async function getBoardCounties(board: PublicBoard): Promise<County[]> {
  const counties = await getStateCounties(board.state)
  const keys = boardCountyKeys(board)
  if (keys === 'all') return []
  return counties.filter((c) => keys.includes(countyKey(c.name).replace(/\s+/g, '')))
}

/** States with data, for the /places index and the sitemap. */
export const getStateIndex = cache(async (): Promise<{ code: string; counties: number; population: number | null }[]> => {
  const rows = await prisma.geoArea.findMany({ where: { level: 'STATE' }, select: { state: true, population: true } })
  const counts = await prisma.geoArea.groupBy({ by: ['state'], where: { level: 'COUNTY' }, _count: { _all: true } })
  const c = new Map(counts.map((x) => [x.state, x._count._all]))
  return rows.filter((r) => ALL_STATE_CODES.includes(r.state)).map((r) => ({ code: r.state, counties: c.get(r.state) ?? 0, population: r.population }))
})

export const placeUrl = {
  state: (stateSlugValue: string) => `/places/${stateSlugValue}`,
  county: (stateSlugValue: string, slug: string) => `/places/${stateSlugValue}/county/${slug}`,
  city: (stateSlugValue: string, slug: string) => `/places/${stateSlugValue}/city/${slug}`,
}
