/**
 * Builds the two bundled files behind the Workforce boards table's local-economy columns:
 *
 *   src/lib/workforce/data/county-context.json  per-county population (Census, 2020 and 2025) and private-sector
 *                                               employment by NAICS sector (BLS QCEW, 2022 and 2025; both NAICS 2022, so a reclassified
 *                                               industry is not mistaken for a gain or loss)
 *   src/lib/workforce/data/place-county.json    "ST|place" → county FIPS for every city a posting on the job board
 *                                               names, so open roles can be counted by county
 *
 * Every source is a free public download; nothing here calls a metered API. Download the inputs into one folder
 * each (never run this from inside them), then:
 *
 *   npx tsx --env-file=.env.local scripts/workforce/build-county-context.ts \
 *     --qcew25 <dir with 2025.annual.singlefile.csv> --qcew22 <dir with 2022.annual.singlefile.csv> \
 *     --census <co-est2025-alldata.csv> --places <national_place_by_county2020.txt> --gaz <2020_Gaz_counties_national.txt> \
 *     --ct <ct_cou_to_cousub_crosswalk.txt>
 *
 * Sources: https://data.bls.gov/cew/data/files/{year}/csv/{year}_annual_singlefile.zip (2022 and 2025),
 * https://www2.census.gov/programs-surveys/popest/datasets/2020-2025/counties/totals/co-est2025-alldata.csv,
 * https://www2.census.gov/geo/docs/reference/codes2020/national_place_by_county2020.txt,
 * https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2020_Gazetteer/2020_Gaz_counties_national.zip,
 * https://www2.census.gov/geo/docs/reference/ct_change/ct_cou_to_cousub_crosswalk.txt (Connecticut's towns in its nine planning regions,
 * which replaced its counties in Census and BLS data; the labor rows use the regions)
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

const STATE_FIPS: Record<string, string> = {
  AL: '01', AK: '02', AZ: '04', AR: '05', CA: '06', CO: '08', CT: '09', DE: '10', DC: '11', FL: '12', GA: '13', HI: '15', ID: '16',
  IL: '17', IN: '18', IA: '19', KS: '20', KY: '21', LA: '22', ME: '23', MD: '24', MA: '25', MI: '26', MN: '27', MS: '28', MO: '29',
  MT: '30', NE: '31', NV: '32', NH: '33', NJ: '34', NM: '35', NY: '36', NC: '37', ND: '38', OH: '39', OK: '40', OR: '41', PA: '42',
  RI: '44', SC: '45', SD: '46', TN: '47', TX: '48', UT: '49', VT: '50', VA: '51', WA: '53', WV: '54', WI: '55', WY: '56',
}

/**
 * Job openings by state, the whole market, from BLS JOLTS (thousands, seasonally adjusted): the average of the latest
 * twelve months. Shown beside a board's own open-roles count so that count is read as a slice, not the market.
 */
async function readJolts(): Promise<Record<string, number>> {
  const codes = Object.keys(STATE_FIPS)
  const out: Record<string, number> = {}
  const year = new Date().getFullYear()
  for (let i = 0; i < codes.length; i += 25) {
    const batch = codes.slice(i, i + 25)
    const res = await fetch('https://api.bls.gov/publicAPI/v2/timeseries/data/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        seriesid: batch.map((c) => `JTS000000${STATE_FIPS[c]}0000000JOL`),
        startyear: String(year - 2), endyear: String(year),
        ...(process.env.BLS_API_KEY ? { registrationkey: process.env.BLS_API_KEY } : {}),
      }),
    })
    const data = (await res.json()) as { Results?: { series?: { seriesID: string; data?: { year: string; period: string; value: string }[] }[] } }
    for (const s of data.Results?.series ?? []) {
      const fips = s.seriesID.slice(9, 11)
      const st = codes.find((c) => STATE_FIPS[c] === fips)
      const vals = (s.data ?? []).filter((d) => /^M(0[1-9]|1[0-2])$/.test(d.period)).sort((a, b) => (b.year + b.period).localeCompare(a.year + a.period)).slice(0, 12).map((d) => Number(d.value)).filter(Number.isFinite)
      if (st && vals.length >= 6) out[st] = Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 1000)
    }
    await new Promise((r) => setTimeout(r, 1000))
  }
  return out
}

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
  const dir25 = path.join(arg('qcew25'), '2025.annual.singlefile.csv')
  const dir22 = path.join(arg('qcew22'), '2022.annual.singlefile.csv')
  const [q25, q22] = [await readQcew(dir25), await readQcew(dir22)]

  const pop = new Map<string, [number, number]>()
  const lines = fs.readFileSync(arg('census'), 'latin1').split('\n')
  const head = lines[0].split(',')
  const col = (n: string) => head.indexOf(n)
  for (const line of lines.slice(1)) {
    const f = line.split(',')
    if (f[col('SUMLEV')] !== '050') continue
    pop.set(f[col('STATE')] + f[col('COUNTY')], [Number(f[col('POPESTIMATE2020')]), Number(f[col('POPESTIMATE2025')])])
  }

  const counties: Record<string, { p?: [number, number]; t?: [number, number]; e: number[] }> = {}
  for (const fips of new Set([...pop.keys(), ...q25.keys()])) {
    const a = q22.get(fips), b = q25.get(fips)
    counties[fips] = {
      ...(pop.has(fips) ? { p: pop.get(fips) } : {}),
      // -1 for the base year where the county did not exist then (Connecticut's planning regions): the share still reads from the latest year.
      ...(b?.has('total') ? { t: [a?.get('total') ?? -1, b.get('total')!] as [number, number] } : {}),
      e: SECTOR_CODES.flatMap((s) => [a?.get(s) ?? -1, b?.get(s) ?? -1]),
    }
  }
  fs.mkdirSync(OUT, { recursive: true })
  fs.writeFileSync(path.join(OUT, 'county-context.json'), JSON.stringify({ sectors: SECTOR_CODES, years: [2022, 2025], popYears: [2020, 2025], counties }))
  console.log(`county-context.json: ${Object.keys(counties).length} counties`)
  const jolts = await readJolts()
  fs.writeFileSync(path.join(OUT, 'state-openings.json'), JSON.stringify(jolts))
  console.log(`state-openings.json: ${Object.keys(jolts).length} states`)

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

  // Connecticut: BLS and the Census now use planning regions; the place-by-county file still has the old counties.
  const ctTowns = new Map<string, string>()
  const ctIdx = process.argv.indexOf('--ct')
  if (ctIdx > 0 && process.argv[ctIdx + 1]) {
    // The header cells contain line breaks, so read the data rows by position:
    // STATEFP | OLD_COUNTYFP | OLD_COUNTY_NAME | NEW_COUNTYFP | NEW_COUNTY_NAME | COUSUBFP | OLD_GEOID | NEW_GEOID | COUSUB_NAMELSAD
    for (const line of fs.readFileSync(process.argv[ctIdx + 1], 'utf8').split('\n')) {
      const f = line.split('|')
      if (f[0] === '09' && /^\d{3}$/.test(f[3] ?? '') && f[8]) ctTowns.set(placeKey(f[8]), `09${f[3]}`)
    }
    console.log(`ct crosswalk: ${ctTowns.size} towns`)
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
      if (st === 'CT') {
        const town = keys.map((k) => ctTowns.get(k)).find(Boolean)
        if (town) { for (const k of keys) map[`CT|${k}`] ??= town; continue }
      }
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
