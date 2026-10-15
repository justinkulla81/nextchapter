// Loads the occupation skills layer: O*NET (skills, knowledge, abilities, work activities,
// technology skills, titles, related occupations) and BLS (OEWS national pay, Employment
// Projections). Each source is optional and replaces its own tables, so it is safe to
// re-run. Reads files you have downloaded; nothing is fetched here.
//
//   O*NET: onetcenter.org/database.html -> "Text" format, unzip. Pass the folder.
//   OEWS:  bls.gov/oes/tables.htm -> the national workbook (national_M<year>_dl.xlsx);
//          export its sheet to CSV.
//   Projections: bls.gov/emp/tables.htm -> Table 1.2 (occupation.xlsx); export to CSV.
//
//   npm run import:occupations -- --onet ./db_29_3_text --onet-version 29.3 \
//       --oews ./national_M2024_dl.csv --oews-year 2024 --top-code-annual 239200 \
//       --projections ./occupation.csv [--dry-run]
//
// --top-code-annual is the year's wage ceiling from the OEWS workbook notes. Without it a
// median reported only as a floor ("#") is stored empty, so no pay is shown for that role.
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { PrismaClient } from '@prisma/client'
import { buildOnetImport, type OnetFiles } from '../src/lib/occupations/import/onet'
import { parseOewsNational, parseProjections } from '../src/lib/occupations/import/bls'

const prisma = new PrismaClient()

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}
const dry = process.argv.includes('--dry-run')
const BATCH = 5000

const ONET_FILES: [keyof OnetFiles, string, boolean][] = [
  ['occupationData', 'Occupation Data.txt', true],
  ['jobZones', 'Job Zones.txt', true],
  ['skills', 'Skills.txt', true],
  ['knowledge', 'Knowledge.txt', false],
  ['abilities', 'Abilities.txt', false],
  ['workActivities', 'Work Activities.txt', false],
  ['technologySkills', 'Technology Skills.txt', false],
  ['alternateTitles', 'Alternate Titles.txt', false],
  ['relatedOccupations', 'Related Occupations.txt', false],
]

function readOnetFiles(dir: string): OnetFiles {
  const files: Partial<OnetFiles> = {}
  for (const [key, name, required] of ONET_FILES) {
    const file = path.join(dir, name)
    if (existsSync(file)) files[key] = readFileSync(file, 'utf8')
    else if (required) throw new Error(`${name} not found in ${dir}`)
    else console.warn(`  skipping ${name}: not found`)
  }
  return files as OnetFiles
}

async function chunked<T>(rows: T[], write: (batch: T[]) => Promise<unknown>) {
  for (let i = 0; i < rows.length; i += BATCH) await write(rows.slice(i, i + BATCH))
}

async function importOnet(dir: string, version: string | undefined) {
  const data = buildOnetImport(readOnetFiles(dir))
  const targets = data.occupations.filter((o) => o.isTarget)
  console.log(`O*NET: ${data.occupations.length} occupations, ${targets.length} in scope (white-collar, Job Zone 4+)`)
  console.log(`  ${data.elements.length} elements, ${data.techSkills.length} technologies, ${data.altTitles.length} titles, ${data.related.length} related links`)
  if (targets.length === 0) throw new Error('No occupation is in scope; check Job Zones.txt and Occupation Data.txt are from the same release.')
  const noElements = targets.filter((o) => !data.elements.some((e) => e.onetSocCode === o.onetSocCode)).length
  if (noElements > 0) console.warn(`  ${noElements} in-scope occupations have no skill scores`)
  if (dry) return

  // One transaction: readers see the old data until the new set is complete.
  await prisma.$transaction(
    async (tx) => {
      await tx.onetOccupation.deleteMany() // children cascade
      await chunked(data.occupations, (b) =>
        tx.onetOccupation.createMany({
          data: b.map((o) => ({ onetSocCode: o.onetSocCode, socCode: o.socCode, title: o.title, description: o.description, jobZone: o.jobZone, isTarget: o.isTarget, dataVersion: version ?? null })),
        })
      )
      await chunked(data.elements, (b) => tx.onetOccupationElement.createMany({ data: b }))
      await chunked(data.techSkills, (b) => tx.onetTechSkill.createMany({ data: b }))
      await chunked(data.altTitles, (b) => tx.onetAlternateTitle.createMany({ data: b }))
      await chunked(data.related, (b) => tx.onetRelatedOccupation.createMany({ data: b }))
    },
    { timeout: 10 * 60 * 1000, maxWait: 60 * 1000 }
  )
  console.log('  written')
}

async function importOews(file: string, year: number, topCodeAnnual: number | undefined) {
  const rows = parseOewsNational(readFileSync(file, 'utf8'), { topCodeAnnual })
  const topCoded = rows.filter((r) => r.topCoded)
  console.log(`OEWS ${year}: ${rows.length} occupations, ${topCoded.length} with a top-coded median${topCoded.length > 0 && topCodeAnnual === undefined ? ' (stored without a median; pass --top-code-annual)' : ''}`)
  if (rows.length === 0) throw new Error('No detailed occupations were read from the OEWS file.')
  if (dry) return
  await prisma.$transaction(async (tx) => {
    await tx.occupationWage.deleteMany({ where: { areaType: 'NATIONAL', year } })
    await chunked(rows, (b) => tx.occupationWage.createMany({ data: b.map((r) => ({ ...r, areaType: 'NATIONAL', areaCode: 'US', year })) }))
  })
  console.log('  written')
}

async function importProjections(file: string) {
  const rows = parseProjections(readFileSync(file, 'utf8'))
  console.log(`Projections: ${rows.length} occupations (${rows[0]?.baseYear}-${rows[0]?.projectedYear})`)
  if (rows.length === 0) throw new Error('No occupations were read from the projections file.')
  if (dry) return
  await prisma.$transaction(async (tx) => {
    await tx.occupationProjection.deleteMany()
    await chunked(rows, (b) => tx.occupationProjection.createMany({ data: b }))
  })
  console.log('  written')
}

async function main() {
  const onet = arg('onet')
  const oews = arg('oews')
  const projections = arg('projections')
  if (!onet && !oews && !projections) throw new Error('usage: import-occupations.ts [--onet <dir>] [--oews <csv> --oews-year <yyyy>] [--projections <csv>] [--dry-run]')
  if (dry) console.log('Dry run: nothing is written.')
  if (onet) await importOnet(onet, arg('onet-version'))
  if (oews) {
    const year = Number(arg('oews-year'))
    if (!Number.isInteger(year)) throw new Error('--oews-year <yyyy> is required with --oews')
    const cap = arg('top-code-annual')
    await importOews(oews, year, cap ? Number(cap) : undefined)
  }
  if (projections) await importProjections(projections)
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
