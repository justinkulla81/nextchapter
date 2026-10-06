/**
 * Loads every county (and county-equivalent: parishes, boroughs, Virginia's
 * independent cities, Connecticut's planning regions) from the Census
 * gazetteer into CountyLabor, ready for the BLS figures. Run once, and again
 * when the Census redraws counties:
 *
 *   npx tsx --env-file=.env.local scripts/workforce/load-counties.ts
 */
import { execSync } from 'child_process'
import { PrismaClient } from '@prisma/client'
import { countyKey } from '../../src/lib/workforce/places'

const URL = 'https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2024_Gazetteer/2024_Gaz_counties_national.zip'

async function main() {
  const prisma = new PrismaClient()
  const zip = '/tmp/gaz_counties.zip'
  execSync(`curl -s -L -o ${zip} ${URL}`)
  const text = execSync(`unzip -p ${zip}`, { maxBuffer: 64 * 1024 * 1024 }).toString('utf8')
  const [header, ...lines] = text.split('\n').filter((l) => l.trim())
  const col = Object.fromEntries(header.split('\t').map((h, i) => [h.trim(), i]))
  const rows = lines.map((l) => {
    const c = l.split('\t').map((x) => x.trim())
    return { fips: c[col.GEOID], state: c[col.USPS], name: c[col.NAME], nameKey: countyKey(c[col.NAME]) }
  }).filter((r) => /^\d{5}$/.test(r.fips))
  const res = await prisma.countyLabor.createMany({ data: rows, skipDuplicates: true })
  console.log(`${rows.length} counties, ${res.count} new`)
  await prisma.$disconnect()
}
main().catch((e) => { console.error(e); process.exit(1) })
