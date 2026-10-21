// Loads one state's approved-training list (WIOA Eligible Training Provider List) from a
// CSV. Re-runnable: rows upsert on (state, provider, program). States publish these in
// their own formats; rename the file's headers to common names (provider, program, url,
// soc codes, delivery, cost, weeks, credential) if needed. See parseTrainingPrograms.
//
//   npm run careers:import-training -- --file ma-etpl.csv --state MA --source "Massachusetts ETPL, September 2026" [--dry-run]
import { readFileSync } from 'node:fs'
import { prisma } from '../../src/lib/prisma'
import { parseTrainingPrograms } from '../../src/lib/careers/import-parsers'

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}

async function main() {
  const file = arg('file')
  const state = arg('state')?.toUpperCase()
  const source = arg('source')
  const dryRun = process.argv.includes('--dry-run')
  if (!file || !state || !/^[A-Z]{2}$/.test(state) || !source) {
    console.error('Usage: import-training-programs --file <csv> --state <2-letter> --source "<list name and date>" [--dry-run]')
    process.exit(1)
  }

  const rows = parseTrainingPrograms(readFileSync(file, 'utf8'))
  const withSoc = rows.filter((r) => r.socCodes.length > 0).length
  console.log(`${rows.length} programs read, ${withSoc} with occupation codes (only those can be matched to a role).`)
  if (dryRun) return

  const now = new Date()
  for (let i = 0; i < rows.length; i += 200) {
    await prisma.$transaction(
      rows.slice(i, i + 200).map((r) =>
        prisma.trainingProgram.upsert({
          where: { state_providerName_programName: { state, providerName: r.providerName, programName: r.programName } },
          create: { state, ...r, sourceName: source, importedAt: now },
          update: { ...r, sourceName: source, importedAt: now },
        })
      )
    )
  }
  // A program missing from this release is no longer on the state's approved list: remove it, so
  // withdrawn programs are not shown as publicly funded. Only this state's WIOA list is touched.
  const removed = await prisma.trainingProgram.deleteMany({ where: { state, fundingSource: 'WIOA_ETPL', importedAt: { lt: now } } })
  console.log(`Removed ${removed.count} programs no longer on the ${state} list.`)
  console.log('Done.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
