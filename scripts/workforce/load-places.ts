/**
 * Loads the Census Bureau's list of places (cities, towns, CDPs) with their
 * coordinates into GeoPlace, for finding the county a WARN notice's city is
 * in. Run once, and again if the Census publishes a new year:
 *
 *   npx tsx --env-file=.env.local scripts/workforce/load-places.ts
 */
import { execSync } from 'child_process'
import { PrismaClient } from '@prisma/client'
import { placeKey } from '../../src/lib/workforce/places'

const URL = 'https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2024_Gazetteer/2024_Gaz_place_national.zip'

async function main() {
  const prisma = new PrismaClient()
  const zip = '/tmp/gaz_place.zip'
  execSync(`curl -s -L -o ${zip} ${URL}`)
  const text = execSync(`unzip -p ${zip}`, { maxBuffer: 64 * 1024 * 1024 }).toString('utf8')
  const lines = text.split('\n').slice(1).filter((l) => l.trim())
  const rows = lines.map((l) => {
    const c = l.split('\t').map((x) => x.trim())
    // USPS GEOID ANSICODE NAME LSAD FUNCSTAT ALAND AWATER ALAND_SQMI AWATER_SQMI INTPTLAT INTPTLONG
    return { id: c[1], state: c[0], name: c[3], nameKey: placeKey(c[3]), lat: Number(c[10]), lon: Number(c[11]), population: Math.round(Number(c[6]) / 1000) }
  }).filter((r) => r.id && Number.isFinite(r.lat) && Number.isFinite(r.lon))
  for (let i = 0; i < rows.length; i += 2000) {
    await prisma.geoPlace.createMany({ data: rows.slice(i, i + 2000), skipDuplicates: true })
  }
  console.log(`loaded ${rows.length} places`)
  await prisma.$disconnect()
}
main().catch((e) => { console.error(e); process.exit(1) })
