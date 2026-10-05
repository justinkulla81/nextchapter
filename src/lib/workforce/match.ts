import 'server-only'
import { prisma } from '@/lib/prisma'
import { areaPlaces, cityFromAddress, countyKey, placeKey, placeKeys, trailingStreetAddress } from './places'

const MAX_AGE_DAYS = 540
const GEOCODER = 'https://geocoding.geo.census.gov/geocoder/geographies'
const LAYERS = 'benchmark=Public_AR_Current&vintage=Current_Current&layers=Counties&format=json'

type CountyResult = { NAME?: string }[] | undefined

/** The county a coordinate sits in, from the Census Bureau's free geocoder. */
async function countyAt(lat: number, lon: number): Promise<string | null> {
  const res = await fetch(`${GEOCODER}/coordinates?x=${lon}&y=${lat}&${LAYERS}`, { signal: AbortSignal.timeout(15_000) })
  if (!res.ok) return null
  const data = (await res.json()) as { result?: { geographies?: { Counties?: CountyResult } } }
  return data.result?.geographies?.Counties?.[0]?.NAME ?? null
}

/** The county a street address is in — for places too small for the Census place list. */
async function countyAtAddress(address: string): Promise<string | null> {
  const res = await fetch(`${GEOCODER}/onelineaddress?address=${encodeURIComponent(address)}&${LAYERS}`, { signal: AbortSignal.timeout(15_000) })
  if (!res.ok) return null
  const data = (await res.json()) as { result?: { addressMatches?: { geographies?: { Counties?: CountyResult } }[] } }
  return data.result?.addressMatches?.[0]?.geographies?.Counties?.[0]?.NAME ?? null
}

/** The county a city is in: from the Census place list, then the geocoder, kept once found. */
async function countyForCity(city: string, state: string): Promise<string | null> {
  const places = await prisma.geoPlace.findMany({ where: { state, nameKey: { in: placeKeys(city) } }, orderBy: { population: 'desc' }, take: 1 })
  const place = places[0]
  if (!place) return null
  if (place.countyCheckedAt) return place.county
  const county = await countyAt(place.lat, place.lon).catch(() => null)
  await prisma.geoPlace.update({ where: { id: place.id }, data: { county, countyCheckedAt: new Date() } })
  return county
}

type Board = { id: string; name: string; counties: string[]; serviceArea: string | null; statewide: boolean }

/**
 * The board for a place. A city or town a board names in its service area
 * is that board's — Los Angeles, Oakland, Phoenix and Denver have their own
 * boards inside a county another board serves, and Massachusetts draws every
 * area by town. Otherwise the board whose area lists the county; where
 * several do, one that is not a single city's.
 */
export function pickBoard(boards: Board[], county: string | null, city: string | null): Board | null {
  if (city) {
    const keys = placeKeys(city)
    const own = boards.find((b) => !b.statewide && areaPlaces(b.serviceArea).some((p) => keys.includes(p)))
    if (own) return own
  }
  if (county) {
    const key = countyKey(county)
    const covering = boards.filter((b) => !b.statewide && b.counties.includes(key))
    if (covering.length === 1) return covering[0]
    if (covering.length > 1) {
      return covering.find((b) => areaPlaces(b.serviceArea).length === 0 && !/^city of\b/i.test(b.name)) ?? covering[0]
    }
  }
  // A state run as one workforce area has one board for everywhere.
  const local = boards.filter((b) => !b.statewide)
  if (local.length === 1) return local[0]
  if (local.length === 0 && boards.length === 1) return boards[0]
  return null
}

/**
 * Some states put the workforce area itself where the address goes —
 * Colorado writes "Adams", "Denver/Adams", "Pikes Peak", "Pueblo (Rural
 * Alliance)". A part that is a county one board serves, or that names one
 * board, settles it.
 */
/** The pieces of a field that may each name a place: "Rural Alliance: Pueblo" → ["Rural Alliance", "Pueblo"]. */
export function addressParts(text: string): string[] {
  return text
    .split(/[/,():&]|\band\b/i)
    .map((p) => p.trim())
    .filter((p) => p.length >= 4 && !/^[A-Z]{2}$/.test(p) && !/^(statewide|remote|multiple|various|united states)/i.test(p))
}

export function boardFromNamedArea(boards: Board[], text: string | null): Board | null {
  if (!text) return null
  const parts = addressParts(text)
  const local = boards.filter((b) => !b.statewide)
  for (const part of parts) {
    const byCounty = local.filter((b) => b.counties.includes(countyKey(part)))
    if (byCounty.length === 1) return byCounty[0]
  }
  for (const part of parts) {
    const k = placeKey(part)
    const byName = local.filter((b) => placeKey(b.name).includes(k))
    if (byName.length === 1) return byName[0]
  }
  return null
}

/**
 * Finds the local workforce board for notices that have not been checked,
 * newest first, until the time budget is spent.
 *
 * The county comes from the filing when the state publishes one (California,
 * Texas, Iowa, Mississippi); otherwise from the street address through the
 * Census geocoder, or the city through the Census place list.
 * A notice whose place cannot be pinned down — "SF Bay Area", a
 * headquarters in another state — is marked checked with no board, and
 * shows the state's board list instead.
 */
export async function matchNoticesToBoards(budgetMs = 60_000): Promise<{ checked: number; matched: number }> {
  const started = Date.now()
  const boardsByState = new Map<string, Board[]>()
  const all = await prisma.workforceBoard.findMany({ select: { id: true, name: true, counties: true, serviceArea: true, statewide: true, state: true } })
  for (const b of all) boardsByState.set(b.state, [...(boardsByState.get(b.state) ?? []), b])
  if (all.length === 0) return { checked: 0, matched: 0 }

  const notices = await prisma.warnNotice.findMany({
    // Only states whose directory is loaded — a notice checked before its
    // state's boards arrive would otherwise be marked "no board" for good.
    where: { boardCheckedAt: null, dismissedAt: null, state: { in: [...boardsByState.keys()] }, noticeDate: { gte: new Date(Date.now() - MAX_AGE_DAYS * 86_400_000) } },
    orderBy: { noticeDate: 'desc' },
    select: { id: true, state: true, county: true, address: true, employer: true },
    take: 2000,
  })
  let checked = 0
  let matched = 0
  const cache = new Map<string, string | null>()
  const cached = async (key: string, find: () => Promise<string | null>) => {
    if (!cache.has(key)) cache.set(key, await find().catch(() => null))
    return cache.get(key) ?? null
  }
  for (const n of notices) {
    if (Date.now() - started > budgetMs) break
    const state = n.state!
    const boards = boardsByState.get(state) ?? []
    // Florida files the address inside the employer name.
    const street = trailingStreetAddress(n.address) ?? (n.address ? null : trailingStreetAddress(n.employer))
    const city = cityFromAddress(n.address, state) ?? cityFromAddress(street ?? (n.address ? null : n.employer), state)
    let county = n.county
    let how: string | null = county ? 'county' : null
    // A street address first: the city in it is the post office's, which is
    // often not the county's — "Baltimore, MD 21227" is Baltimore County.
    if (!county && street && cityFromAddress(street, state)) {
      county = await cached(`addr|${street}`, () => countyAtAddress(street))
      if (county) how = 'address'
    }
    if (!county && city) {
      county = await cached(`${state}|${placeKey(city)}`, () => countyForCity(city, state))
      if (county) how = 'city'
    }
    let board = pickBoard(boards, county, city)
    if (board && !how) how = city && areaPlaces(board.serviceArea).length ? 'city' : 'statewide'
    if (!board) {
      board = boardFromNamedArea(boards, n.address)
      if (board) how = 'area'
    }
    // Several places in one field — "Worcester and Leominster, MA",
    // "ADW (Littleton)": the first that is a city with a board.
    if (!board && n.address) {
      for (const part of addressParts(n.address)) {
        const partCounty = await cached(`${state}|${placeKey(part)}`, () => countyForCity(part, state))
        board = pickBoard(boards, partCounty, part)
        if (board) { how = 'city'; break }
      }
    }
    await prisma.warnNotice.update({
      where: { id: n.id },
      data: { boardCheckedAt: new Date(), workforceBoardId: board?.id ?? null, boardMatch: board ? how : null },
    })
    checked++
    if (board) matched++
  }
  return { checked, matched }
}
