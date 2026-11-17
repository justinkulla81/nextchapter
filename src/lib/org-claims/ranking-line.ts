import 'server-only'
import { prisma } from '@/lib/prisma'
import { memoTtl } from '@/lib/db/heavy'
import { getAllPlaceRanks, readRankingIndex } from '@/lib/rankings/store'
import { countyKey, placeKey } from '@/lib/workforce/places'
import { pickRanking, type AreaPlace, type RankingPick } from './ranking-pick'

// Which places a workforce board's email may name. A board drawn by whole counties: those counties and the cities in them. A board
// drawn by city or town (MassHire, Connecticut, city boards): only the places its service area names, never the county around them,
// which it shares with other boards. Statewide boards get nothing: "your state" is not their area.

const countiesIn = memoTtl(60 * 60_000, (state: string) => state, (state: string) =>
  prisma.geoArea.findMany({ where: { level: 'COUNTY', state }, select: { id: true, name: true } }))

const areaFor = memoTtl(60 * 60_000, (boardId: string) => boardId, async (boardId: string): Promise<AreaPlace[]> => {
  const b = await prisma.workforceBoard.findUnique({ where: { id: boardId }, select: { state: true, counties: true, serviceArea: true, statewide: true } })
  if (!b || b.statewide) return []
  if (b.counties.length === 0) {
    const names = (b.serviceArea ?? '').split(';').flatMap((seg) => seg.match(/^\s*(?:cities|city|towns?|townships?|municipalities|boroughs?):\s*(.*)$/i)?.[1].split(',') ?? [])
      .map((n) => n.trim().replace(/^city of\s+/i, '')).filter(Boolean)
    // Rankings file a city under its plain lower-case name or its place key; try both.
    const out = new Map<string, AreaPlace>()
    for (const name of names) for (const k of [name.toLowerCase(), placeKey(name)]) if (k) out.set(`${b.state}|${k}`, { key: `${b.state}|${k}`, name, level: 'city' })
    return [...out.values()]
  }
  const wanted = new Set(b.counties.map(countyKey))
  const counties = (await countiesIn(b.state)).filter((c) => wanted.has(countyKey(c.name)))
  if (counties.length === 0) return []
  const cities = await prisma.geoPlace.findMany({ where: { state: b.state, county: { in: counties.map((c) => c.name) } }, select: { name: true, nameKey: true } })
  return [
    ...counties.map((c) => ({ key: c.id, name: c.name, level: 'county' as const })),
    ...cities.map((c) => ({ key: `${b.state}|${c.nameKey}`, name: c.name, level: 'city' as const })),
  ]
})

/**
 * A city that spills into a board's county is not the board's city (a sliver of Chicago lies in DuPage County). A ranked city counts
 * only when the county its largest Census place sits in is one of the board's. Checked for ranked cities only, so it reads a few rows.
 */
async function ownCitiesOnly(boardId: string, area: AreaPlace[], ranks: Record<string, unknown[]>): Promise<AreaPlace[]> {
  const b = await prisma.workforceBoard.findUnique({ where: { id: boardId }, select: { state: true, counties: true } })
  if (!b || b.counties.length === 0) return area // a board drawn by town names its own places
  const ranked = area.filter((p) => p.level === 'city' && ranks[p.key]?.length)
  if (ranked.length === 0) return area
  const keys = [...new Set(ranked.map((p) => p.key.split('|')[1]))]
  const rows = await prisma.geoPlace.findMany({ where: { state: b.state, nameKey: { in: keys } }, select: { nameKey: true, county: true, population: true } })
  const home = new Map<string, { county: string | null; population: number }>()
  for (const r of rows) {
    const cur = home.get(r.nameKey)
    if (!cur || (r.population ?? 0) > cur.population) home.set(r.nameKey, { county: r.county, population: r.population ?? 0 })
  }
  const mine = new Set(b.counties.map(countyKey))
  return area.filter((p) => {
    if (p.level !== 'city' || !ranks[p.key]?.length) return true
    const county = home.get(p.key.split('|')[1])?.county
    return !!county && mine.has(countyKey(county))
  })
}

/** The workforce board a CRM organization is: the board itself by name, or a job center that belongs to one. */
async function boardIdForOrg(orgName: string): Promise<string | null> {
  const board = await prisma.workforceBoard.findFirst({
    where: { OR: [{ name: { equals: orgName, mode: 'insensitive' } }, { knownAs: { equals: orgName, mode: 'insensitive' } }] },
    select: { id: true },
  })
  if (board) return board.id
  const center = await prisma.americanJobCenter.findFirst({ where: { name: { equals: orgName, mode: 'insensitive' }, workforceBoardId: { not: null } }, select: { workforceBoardId: true } })
  return center?.workforceBoardId ?? null
}

/** The ranking a board's email can lead with, or null (not a board, a statewide board, or no placing worth telling them). */
export async function rankingPickForOrg(orgName: string): Promise<RankingPick | null> {
  try {
    const boardId = await boardIdForOrg(orgName)
    if (!boardId) return null
    const [area, ranks, index] = await Promise.all([areaFor(boardId), getAllPlaceRanks(), readRankingIndex()])
    return pickRanking(await ownCitiesOnly(boardId, area, ranks), ranks, index)
  } catch (e) {
    console.error('rankingPickForOrg failed', e)
    return null
  }
}
