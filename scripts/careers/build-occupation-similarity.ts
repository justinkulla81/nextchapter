// Fills OccupationSimilarity (the board's skills-adjacent backbone) from the O*NET occupations
// file the crawler keeps (~/nextchapter-jobs/data/onet/occupations.json, built by its
// scripts/onet_import.py from O*NET Web Services). Reads a local file only: no API call, no key.
// Re-runnable: replaces every row in one transaction. Table DDL: prisma/manual/2026-10-16-search-breadth.sql.
//
//   npm run careers:build-similarity -- --file ~/nextchapter-jobs/data/onet/occupations.json [--dry-run]
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { prisma } from '../../src/lib/prisma'
import { buildSimilarityRows, type OnetFileOccupation } from '../../src/lib/careers/occupation-similarity'

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}

async function main() {
  const file = (arg('file') ?? '~/nextchapter-jobs/data/onet/occupations.json').replace(/^~/, homedir())
  const occ = JSON.parse(readFileSync(file, 'utf8')) as Record<string, OnetFileOccupation>
  const rows = buildSimilarityRows(occ)
  const sources = new Set(rows.map((r) => r.socCode)).size
  console.log(`${Object.keys(occ).length} occupations, ${sources} with neighbours, ${rows.length} rows`)
  if (process.argv.includes('--dry-run')) return
  await prisma.$transaction(
    async (tx) => {
      await tx.occupationSimilarity.deleteMany({})
      for (let i = 0; i < rows.length; i += 2000) await tx.occupationSimilarity.createMany({ data: rows.slice(i, i + 2000) })
    },
    { timeout: 300_000 }
  )
  console.log('written')
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
