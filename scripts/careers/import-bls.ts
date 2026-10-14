// Adds BLS pay, employment, growth and openings to the Occupation rows that
// import-onet.ts created. Re-runnable. BLS publishes at the 6-digit SOC level, so
// each figure applies to every O*NET-SOC code that starts with it (13-2011 ->
// 13-2011.00, 13-2011.01, ...).
//
// Free files, both saved as CSV (BLS ships them as Excel; open and "Save as CSV"):
//   OEWS national estimates (national_M20XX_dl):  https://www.bls.gov/oes/tables.htm
//   Employment Projections, Table 1.2:            https://www.bls.gov/emp/tables.htm
//
//   npm run careers:import-bls -- --oews /path/national.csv --wage-year 2024 [--projections /path/table1_2.csv] [--dry-run]
import { readFileSync } from 'node:fs'
import { prisma } from '../../src/lib/prisma'
import { parseOews, parseProjections } from '../../src/lib/careers/import-parsers'

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}

async function main() {
  const oewsPath = arg('oews')
  const projectionsPath = arg('projections')
  const wageYear = arg('wage-year') ? Number(arg('wage-year')) : null
  const dryRun = process.argv.includes('--dry-run')
  if (!oewsPath && !projectionsPath) {
    console.error('Usage: import-bls [--oews file.csv --wage-year 2024] [--projections file.csv] [--dry-run]')
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

  let oewsMatched = 0
  let projMatched = 0

  if (oewsPath) {
    const rows = parseOews(readFileSync(oewsPath, 'utf8'))
    for (const r of rows) {
      const targets = bySoc6.get(r.soc6)
      if (!targets) continue
      oewsMatched += targets.length
      if (dryRun) continue
      await prisma.occupation.updateMany({
        where: { socCode: { in: targets } },
        data: { medianWage: r.medianWage, employment: r.employment, wageYear },
      })
    }
    console.log(`OEWS: ${rows.length} rows read, ${oewsMatched} occupations updated.`)
  }

  if (projectionsPath) {
    const rows = parseProjections(readFileSync(projectionsPath, 'utf8'))
    for (const r of rows) {
      const targets = bySoc6.get(r.soc6)
      if (!targets) continue
      projMatched += targets.length
      if (dryRun) continue
      await prisma.occupation.updateMany({
        where: { socCode: { in: targets } },
        data: { growthPct: r.growthPct, annualOpenings: r.annualOpenings, typicalEducation: r.typicalEducation, projectionPeriod: r.period },
      })
    }
    console.log(`Projections: ${rows.length} rows read, ${projMatched} occupations updated.`)
  }
  if (dryRun) console.log('Dry run: nothing written.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
