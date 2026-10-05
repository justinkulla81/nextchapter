import 'server-only'
import { prisma } from '@/lib/prisma'
import { cityFromAddress, countyKey, placeKey } from './places'

const MAX_AGE_DAYS = 540

/** The county a coordinate sits in, from the Census Bureau's free geocoder. */
async function countyAt(lat: number, lon: number): Promise<string | null> {
  const url = `https://geocoding.geo.census.gov/geocoder/geographies/coordinates?x=${lon}&y=${lat}&benchmark=Public_AR_Current&vintage=Current_Current&layers=Counties&format=json`
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) })
  if (!res.ok) return null
  const data = (await res.json()) as { result?: { geographies?: { Counties?: { NAME?: string }[] } } }
  return data.result?.geographies?.Counties?.[0]?.NAME ?? null
}

/** The county a city is in: from the Census place list, then the geocoder, kept once found. */
async function countyForCity(city: string, state: string): Promise<string | null> {
  const places = await prisma.geoPlace.findMany({ where: { state, nameKey: placeKey(city) }, orderBy: { population: 'desc' }, take: 1 })
  const place = places[0]
  if (!place) return null
  if (place.countyCheckedAt) return place.county
  const county = await countyAt(place.lat, place.lon).catch(() => null)
  await prisma.geoPlace.update({ where: { id: place.id }, data: { county, countyCheckedAt: new Date() } })
  return county
}

type Board = { id: string; name: string; counties: string[]; serviceArea: string | null; statewide: boolean }

/**
 * The board for a county: the one whose service area lists it. Where
 * several do — Los Angeles County has a county board and several city ones —
 * a board whose area names the notice's city wins, then one that is not a
 * single city's.
 */
export function pickBoard(boards: Board[], county: string | null, city: string | null): Board | null {
  // A city with its own board (Los Angeles, Oakland, Phoenix, Denver) is
  // served by it, whatever county board also covers the ground around it.
  const cities = (b: Board) => [...(b.serviceArea ?? '').matchAll(/City:\s*([^;]+)/gi)].map((m) => placeKey(m[1].replace(/^city of\s+/i, '')))
  const c = city ? placeKey(city) : null
  if (c) {
    const own = boards.find((b) => !b.statewide && cities(b).includes(c))
    if (own) return own
  }
  if (county) {
    const key = countyKey(county)
    const covering = boards.filter((b) => !b.statewide && b.counties.includes(key))
    if (covering.length === 1) return covering[0]
    if (covering.length > 1) {
      return covering.find((b) => cities(b).length === 0 && !/^city of\b/i.test(b.name)) ?? covering[0]
    }
  }
  // A state run as one workforce area has one board for everywhere.
  const local = boards.filter((b) => !b.statewide)
  if (local.length === 1) return local[0]
  if (local.length === 0 && boards.length === 1) return boards[0]
  return null
}

/**
 * Finds the local workforce board for notices that have not been checked,
 * newest first, until the time budget is spent.
 *
 * The county comes from the filing when the state publishes one (California,
 * Texas, Iowa, Mississippi); otherwise from the city in the address, through
 * the Census place list and geocoder. A notice whose place cannot be pinned
 * down — "Remote", a headquarters in another state — is marked checked with
 * no board, and shows the state's board list instead.
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
    select: { id: true, state: true, county: true, address: true },
    take: 2000,
  })
  let checked = 0
  let matched = 0
  const countyCache = new Map<string, string | null>()
  for (const n of notices) {
    if (Date.now() - started > budgetMs) break
    const boards = boardsByState.get(n.state!) ?? []
    const city = cityFromAddress(n.address, n.state)
    let county = n.county
    let how: 'county' | 'city' | 'statewide' | null = county ? 'county' : null
    if (!county && city) {
      const k = `${n.state}|${placeKey(city)}`
      if (!countyCache.has(k)) countyCache.set(k, await countyForCity(city, n.state!).catch(() => null))
      county = countyCache.get(k) ?? null
      if (county) how = 'city'
    }
    const board = pickBoard(boards, county, city)
    if (board && !how) how = 'statewide'
    await prisma.warnNotice.update({
      where: { id: n.id },
      data: { boardCheckedAt: new Date(), workforceBoardId: board?.id ?? null, boardMatch: board ? how : null },
    })
    checked++
    if (board) matched++
  }
  return { checked, matched }
}
