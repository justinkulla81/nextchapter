/**
 * Looks up the county of every Census place that a company's job postings name as its main city and that has no county yet, from the Census
 * Bureau's free geocoder (coordinates in, county out), and saves it on the place so the CRM can put those companies in a county.
 * Dry run unless --apply. Free; about three requests a second per worker.
 *
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/geo/fill-place-counties.ts [--apply] [--limit N] [--place-pages]
 *
 * --place-pages: also look up every city that has a /places page (open jobs, a layoff notice, a job center or a college), so county pages
 * and county layoff and job counts can include it.
 */
import { PrismaClient } from '@prisma/client'
import { placeKeys } from '../../src/lib/workforce/places'
import { getAllCityEntries } from '../../src/lib/places/places'

const prisma = new PrismaClient()
const GEOCODER = 'https://geocoding.geo.census.gov/geocoder/geographies/coordinates'
const LAYERS = 'benchmark=Public_AR_Current&vintage=Current_Current&layers=Counties&format=json'

async function countyAt(lat: number, lon: number): Promise<string | null | 'error'> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`${GEOCODER}?x=${lon}&y=${lat}&${LAYERS}`, { signal: AbortSignal.timeout(20_000) })
      if (res.status === 429 || res.status >= 500) { await new Promise((r) => setTimeout(r, 2000 * (attempt + 1))); continue }
      if (!res.ok) return 'error'
      const data = (await res.json()) as { result?: { geographies?: { Counties?: { NAME?: string }[] } } }
      return data.result?.geographies?.Counties?.[0]?.NAME ?? null
    } catch { await new Promise((r) => setTimeout(r, 1500)) }
  }
  return 'error'
}

async function main() {
  const apply = process.argv.includes('--apply')
  const li = process.argv.indexOf('--limit')
  const limit = li > 0 ? Number(process.argv[li + 1]) : Infinity
  const cities = await prisma.$queryRaw<{ city: string; st: string }[]>`
    select distinct split_part(h."topLocations"->0->>'location', ', ', 1) city, split_part(h."topLocations"->0->>'location', ', ', 2) st
      from "CompanyHiringProfile" h where h."topLocations" is not null`
  const want = new Set(cities.filter((c) => c.city && /^[A-Z]{2}$/.test(c.st)).flatMap((c) => placeKeys(c.city).map((k) => `${c.st}|${k}`)))
  if (process.argv.includes('--place-pages')) {
    for (const c of await getAllCityEntries()) for (const k of placeKeys(c.name)) want.add(`${c.state}|${k}`)
  }
  const places = await prisma.geoPlace.findMany({ where: { countyCheckedAt: null }, select: { id: true, state: true, nameKey: true, lat: true, lon: true, population: true } })
  // One place per (state, name): the biggest, the way the resolver picks it.
  const best = new Map<string, (typeof places)[number]>()
  for (const p of places) {
    const k = `${p.state}|${p.nameKey}`
    if (want.has(k) && (!best.has(k) || (p.population ?? 0) > (best.get(k)!.population ?? 0))) best.set(k, p)
  }
  const todo = [...best.values()].slice(0, limit)
  console.log(`${cities.length} cities named by postings; ${todo.length} places to look up${apply ? '' : ' (dry run)'}`)
  if (!apply) return
  let found = 0, none = 0, failed = 0, done = 0
  const queue = [...todo]
  const worker = async () => {
    for (let p = queue.shift(); p; p = queue.shift()) {
      const county = await countyAt(p.lat, p.lon)
      if (county === 'error') failed++
      else {
        await prisma.geoPlace.update({ where: { id: p.id }, data: { county, countyCheckedAt: new Date() } })
        county ? found++ : none++
      }
      if (++done % 250 === 0) console.log(`${done}/${todo.length}: ${found} found, ${none} no county, ${failed} failed`)
    }
  }
  await Promise.all(Array.from({ length: 6 }, worker))
  console.log(`done: ${found} found, ${none} no county, ${failed} failed (re-run to retry failures)`)
}
main().finally(() => prisma.$disconnect())
