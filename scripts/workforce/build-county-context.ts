/**
 * Builds the two bundled files behind the Workforce boards table's local-economy columns:
 *
 *   src/lib/workforce/data/county-context.json  per-county population (Census, 2020 and 2024) and private-sector
 *                                               employment by NAICS sector (BLS QCEW, 2022 and 2024; both NAICS 2022, so a reclassified
 *                                               industry is not mistaken for a gain or loss)
 *   src/lib/workforce/data/place-county.json    "ST|place" → county FIPS for every city a posting on the job board
 *                                               names, so open roles can be counted by county
 *
 * Every source is a free public download; nothing here calls a metered API. Download the inputs into one folder
 * each (never run this from inside them), then:
 *
 *   npx tsx --env-file=.env.local scripts/workforce/build-county-context.ts \
 *     --qcew24 <dir with 2024.annual.singlefile.csv> --qcew22 <dir with 2022.annual.singlefile.csv> \
 *     --census <co-est2024-alldata.csv> --places <national_place_by_county2020.txt> --gaz <2020_Gaz_counties_national.txt>
 *
 * Sources: https://data.bls.gov/cew/data/files/{year}/csv/{year}_annual_singlefile.zip (2022 and 2024),
 * https://www2.census.gov/programs-surveys/popest/datasets/2020-2024/counties/totals/co-est2024-alldata.csv,
 * https://www2.census.gov/geo/docs/reference/codes2020/national_place_by_county2020.txt,
 * https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2020_Gazetteer/2020_Gaz_counties_national.zip
 */
import fs from 'node:fs'
import readline from 'node:readline'
import path from 'node:path'
import { PrismaClient } from '@prisma/client'
import { placeKey, placeKeys } from '../../src/lib/workforce/places'
import { COUNTY_SECTORS } from '../../src/lib/workforce/county-context'

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`)
  if (i < 0 || !process.argv[i + 1]) throw new Error(`missing --${name}`)
  return process.argv[i + 1]
}
const OUT = path.join(__dirname, '../../src/lib/workforce/data')
const SECTOR_CODES = COUNTY_SECTORS.map((s) => s.code)

/** Private-sector employment by sector for one year: fips → sector → employment, plus the private total. */
async function readQcew(file: string): Promise<Map<string, Map<string, number>>> {
  const out = new Map<string, Map<string, number>>()
  const rl = readline.createInterface({ input: fs.createReadStream(file) })
  for await (const line of rl) {
    const f = line.split(',', 11).map((x) => x.replace(/"/g, ''))
    const [fips, own, industry, agglvl, , , , disclosure, , emp] = f
    if (own !== '5' || !/^\d{5}$/.test(fips) || fips.endsWith('000')) continue
    const total = agglvl === '71' && industry === '10'
    if (!total && !(agglvl === '74' && SECTOR_CODES.includes(industry))) continue
    // A suppressed cell (disclosure N) reports zero: unknown, not zero.
    if (disclosure) continue
    const n = Number(emp)
    if (!Number.isFinite(n)) continue
    const m = out.get(fips) ?? new Map<string, number>()
    m.set(total ? 'total' : industry, n)
    out.set(fips, m)
  }
  return out
}

async function main() {
  const dir24 = path.join(arg('qcew24'), '2024.annual.singlefile.csv')
  const dir22 = path.join(arg('qcew22'), '2022.annual.singlefile.csv')
  const [q24, q22] = [await readQcew(dir24), await readQcew(dir22)]

  const pop = new Map<string, [number, number]>()
  const lines = fs.readFileSync(arg('census'), 'latin1').split('\n')
  const head = lines[0].split(',')
  const col = (n: string) => head.indexOf(n)
  for (const line of lines.slice(1)) {
    const f = line.split(',')
    if (f[col('SUMLEV')] !== '050') continue
    pop.set(f[col('STATE')] + f[col('COUNTY')], [Number(f[col('POPESTIMATE2020')]), Number(f[col('POPESTIMATE2024')])])
  }

  const counties: Record<string, { p?: [number, number]; t?: [number, number]; e: number[] }> = {}
  for (const fips of new Set([...pop.keys(), ...q24.keys()])) {
    const a = q22.get(fips), b = q24.get(fips)
    counties[fips] = {
      ...(pop.has(fips) ? { p: pop.get(fips) } : {}),
      ...(a?.has('total') && b?.has('total') ? { t: [a.get('total')!, b.get('total')!] as [number, number] } : {}),
      e: SECTOR_CODES.flatMap((s) => [a?.get(s) ?? -1, b?.get(s) ?? -1]),
    }
  }
  fs.mkdirSync(OUT, { recursive: true })
  fs.writeFileSync(path.join(OUT, 'county-context.json'), JSON.stringify({ sectors: SECTOR_CODES, years: [2022, 2024], popYears: [2020, 2024], counties }))
  console.log(`county-context.json: ${Object.keys(counties).length} counties`)

  // Counties' centres, to pick between the counties a city spans.
  const centre = new Map<string, [number, number]>()
  for (const line of fs.readFileSync(arg('gaz'), 'latin1').split('\n').slice(1)) {
    const f = line.split('\t').map((x) => x.trim())
    if (f[1]) centre.set(f[1], [Number(f[8]), Number(f[9])])
  }
  const byPlace = new Map<string, Set<string>>()
  for (const line of fs.readFileSync(arg('places'), 'latin1').split('\n').slice(1)) {
    const f = line.split('|')
    if (f.length < 7) continue
    const k = `${f[0]}|${placeKey(f[6])}`
    byPlace.set(k, (byPlace.get(k) ?? new Set()).add(f[1] + f[2]))
  }

  const prisma = new PrismaClient()
  try {
    const cities = await prisma.$queryRaw<{ st: string; city: string }[]>`
      select "locationState" st, "locationCity" city from "ExclusiveJobPosting"
       where status = 'approved' and "archivedAt" is null and "locationState" is not null and "locationCity" is not null
       group by 1, 2`
    const geo = await prisma.geoPlace.findMany({ select: { state: true, nameKey: true, lat: true, lon: true, population: true }, orderBy: { population: 'asc' } })
    const at = new Map(geo.map((g) => [`${g.state}|${g.nameKey}`, g])) // biggest place of a name wins (sorted ascending, last write)
    const dist = (a: [number, number], b: [number, number]) => (a[0] - b[0]) ** 2 + ((a[1] - b[1]) * Math.cos((a[0] * Math.PI) / 180)) ** 2
    // Consolidated city-counties and boroughs the Census place list names differently.
    const map: Record<string, string> = {
      'TN|nashville': '47037', 'NY|brooklyn': '36047', 'NY|queens': '36081', 'NY|bronx': '36005', 'NY|manhattan': '36061',
      'NY|staten island': '36085', 'ID|boise': '16001', 'HI|honolulu': '15003', 'KY|lexington': '21067', 'GA|augusta': '13245', 'GA|macon': '13021',
    }
    let missed = 0
    for (const { st, city } of cities) {
      const keys = placeKeys(city)
      const hit = keys.map((k) => ({ k, set: byPlace.get(`${st}|${k}`) })).find((x) => x.set)
      if (!hit?.set) { missed++; continue }
      let fips = [...hit.set][0]
      if (hit.set.size > 1) {
        const g = keys.map((k) => at.get(`${st}|${k}`)).find(Boolean)
        if (g) fips = [...hit.set].sort((x, y) => dist([g.lat, g.lon], centre.get(x) ?? [0, 0]) - dist([g.lat, g.lon], centre.get(y) ?? [0, 0]))[0]
      }
      for (const k of keys) map[`${st}|${k}`] ??= fips
    }
    fs.writeFileSync(path.join(OUT, 'place-county.json'), JSON.stringify(map))
    console.log(`place-county.json: ${Object.keys(map).length} keys; ${missed} of ${cities.length} job cities had no match`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
