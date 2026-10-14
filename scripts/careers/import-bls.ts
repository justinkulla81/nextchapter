// Adds BLS pay, employment, growth and openings to the career taxonomy. Re-runnable.
//
// BLS publishes at the 6-digit SOC level, so each figure applies to every O*NET-SOC code that
// starts with it (13-2011 -> 13-2011.00, 13-2011.01, ...). Only occupations already loaded by
// import-onet.ts are kept, so loading the scoped (white-collar) taxonomy first keeps the big
// metro file down to the occupations we use.
//
// Free files, each saved as CSV (BLS ships Excel; open and "Save as CSV"):
//   OEWS national  national_M20XX_dl   https://www.bls.gov/oes/tables.htm
//   OEWS state     state_M20XX_dl      (same page)
//   OEWS metro     MSA_M20XX_dl        (same page; the metropolitan and nonmetropolitan area file)
//   Projections    Employment Projections table 1.2   https://www.bls.gov/emp/tables.htm
//
//   npm run careers:import-bls -- --oews national.csv --oews-state state.csv --oews-metro msa.csv \
//        --wage-year 2024 --projections table1_2.csv [--dry-run]
import { readFileSync } from 'node:fs'
import { prisma } from '../../src/lib/prisma'
import { parseOewsAreas, parseOews, parseProjections, type OewsAreaRow, type WageAreaType } from '../../src/lib/careers/import-parsers'

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}

function chunks<T>(rows: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size))
  return out
}

async function main() {
  const national = arg('oews')
  const state = arg('oews-state')
  const metro = arg('oews-metro')
  const projectionsPath = arg('projections')
  const wageYear = arg('wage-year') ? Number(arg('wage-year')) : null
  const dryRun = process.argv.includes('--dry-run')
  if (!national && !state && !metro && !projectionsPath) {
    console.error('Usage: import-bls [--oews national.csv] [--oews-state state.csv] [--oews-metro msa.csv] [--wage-year 2024] [--projections file.csv] [--dry-run]')
    process.exit(1)
  }

  const socs = await prisma.occupation.findMany({ select: { socCode: true } })
  if (socs.length === 0) {
    console.error('No occupations found. Run careers:import-onet first.')
    process.exit(1)
  }
  const bySoc6 = new Map<string, string[]>()
  for (const { socCode } of socs) {
    const six = socCode.slice(0, 7)
    bySoc6.set(six, [...(bySoc6.get(six) ?? []), socCode])
  }
  console.log(`${socs.length} occupations in the taxonomy cover ${bySoc6.size} six-digit SOC codes.`)

  // National file: also keeps the headline median and employment on the Occupation itself.
  if (national) {
    const text = readFileSync(national, 'utf8')
    const rows = parseOews(text)
    let matched = 0
    for (const r of rows) {
      const targets = bySoc6.get(r.soc6)
      if (!targets) continue
      matched += targets.length
      if (dryRun) continue
      await prisma.occupation.updateMany({ where: { socCode: { in: targets } }, data: { medianWage: r.medianWage, employment: r.employment, wageYear } })
    }
    console.log(`National: ${rows.length} rows read, ${matched} occupations updated.`)
  }

  const areaFiles: [string | undefined, WageAreaType][] = [
    [national, 'NATIONAL'],
    [state, 'STATE'],
    [metro, 'METRO'],
  ]
  for (const [path, areaType] of areaFiles) {
    if (!path) continue
    const all = parseOewsAreas(readFileSync(path, 'utf8'), areaType)
    const rows: OewsAreaRow[] = all.filter((r) => bySoc6.has(r.soc6))
    const areas = new Set(rows.map((r) => r.areaCode))
    const withMedian = rows.filter((r) => r.wageMedian !== null).length
    const ceiling = rows.filter((r) => r.ceilingHit).length
    console.log(
      `${areaType}: ${all.length} rows read, ${rows.length} kept for taxonomy occupations across ${areas.size} area(s); ` +
        `${withMedian} have a published median, ${ceiling} have a figure withheld at BLS's wage ceiling.`
    )
    if (all.length === 0) console.warn(`  Warning: nothing parsed from ${path}. Check it is the ${areaType.toLowerCase()} file saved as CSV with the OEWS column names.`)
    if (dryRun) continue

    // Replace this area type as a set, so a newer release fully supersedes an older one.
    await prisma.$transaction(
      async (tx) => {
        await tx.occupationWage.deleteMany({ where: { areaType } })
        for (const batch of chunks(rows, 5000)) {
          await tx.occupationWage.createMany({ data: batch.map((r) => ({ ...r, year: wageYear })), skipDuplicates: true })
        }
      },
      { timeout: 300_000, maxWait: 30_000 }
    )
  }

  if (projectionsPath) {
    const rows = parseProjections(readFileSync(projectionsPath, 'utf8'))
    let matched = 0
    for (const r of rows) {
      const targets = bySoc6.get(r.soc6)
      if (!targets) continue
      matched += targets.length
      if (dryRun) continue
      await prisma.occupation.updateMany({
        where: { socCode: { in: targets } },
        data: { growthPct: r.growthPct, annualOpenings: r.annualOpenings, typicalEducation: r.typicalEducation, projectionPeriod: r.period },
      })
    }
    console.log(`Projections: ${rows.length} rows read, ${matched} occupations updated.`)
  }
  if (dryRun) console.log('Dry run: nothing written.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
