/**
 * Loads the Census Bureau's lists of places (cities, towns, CDPs) and county
 * subdivisions (the townships and towns of New Jersey, Pennsylvania, New
 * England and the Midwest, which are not "places") with their coordinates
 * into GeoPlace, for finding the county a WARN notice's city is in. Run
 * once, and again if the Census publishes a new year:
 *
 *   npx tsx --env-file=.env.local scripts/workforce/load-places.ts
 */
import { execSync } from 'child_process'
import { PrismaClient } from '@prisma/client'
import { placeKey } from '../../src/lib/workforce/places'

const BASE = 'https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2024_Gazetteer'
const FILES = [
  { file: '2024_Gaz_place_national.zip', prefix: '' },
  { file: '2024_Gaz_cousubs_national.zip', prefix: 'cs' },
]

async function main() {
  const prisma = new PrismaClient()
  for (const { file, prefix } of FILES) {
    const zip = `/tmp/${file}`
    execSync(`curl -s -L -o ${zip} ${BASE}/${file}`)
    const text = execSync(`unzip -p ${zip}`, { maxBuffer: 64 * 1024 * 1024 }).toString('utf8')
    const [header, ...lines] = text.split('\n').filter((l) => l.trim())
    const col = Object.fromEntries(header.split('\t').map((h, i) => [h.trim(), i]))
    const rows = lines.map((l) => {
      const c = l.split('\t').map((x) => x.trim())
      return {
        id: `${prefix}${c[col.GEOID]}`, state: c[col.USPS], name: c[col.NAME], nameKey: placeKey(c[col.NAME]),
        lat: Number(c[col.INTPTLAT]), lon: Number(c[col.INTPTLONG]),
        // Land area in thousands of square metres — the tie-breaker between two places of one name.
        population: Math.round(Number(c[col.ALAND]) / 1000),
      }
    }).filter((r) => r.id && r.nameKey && !/not defined/i.test(r.name) && Number.isFinite(r.lat) && Number.isFinite(r.lon))
    for (let i = 0; i < rows.length; i += 2000) {
      await prisma.geoPlace.createMany({ data: rows.slice(i, i + 2000), skipDuplicates: true })
    }
    // Rows already here keep their looked-up county; only a key that the
    // normalising has since changed is rewritten.
    const existing = new Map((await prisma.geoPlace.findMany({ select: { id: true, nameKey: true } })).map((r) => [r.id, r.nameKey]))
    const changed = rows.filter((r) => existing.has(r.id) && existing.get(r.id) !== r.nameKey)
    for (const r of changed) await prisma.geoPlace.update({ where: { id: r.id }, data: { nameKey: r.nameKey } })
    console.log(`${file}: ${rows.length} rows, ${changed.length} keys updated`)
  }
  await prisma.$disconnect()
}
main().catch((e) => { console.error(e); process.exit(1) })
