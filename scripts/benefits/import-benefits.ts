/**
 * Loads the benefits catalog (data/benefits/*.md) into the BenefitProgram table.
 * Dry run by default; --apply writes. Apply prisma/manual/benefit-programs.sql first.
 *   npx tsx scripts/benefits/import-benefits.ts [--apply]
 */
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { parseCatalog } from '../../src/lib/benefits/parse'
import { upsertProgramRows } from '../../src/lib/benefits/upsert'
import type { BenefitCategory } from '../../src/lib/benefits/types'

const DIR = join(__dirname, '../../data/benefits')
const CATEGORY_BY_FILE: Record<string, BenefitCategory> = {
  'relocation.md': 'RELOCATION', 'state-training.md': 'STATE_TRAINING', 'federal.md': 'FEDERAL', 'courses.md': 'COURSES', 'private.md': 'PRIVATE', 'segments.md': 'SEGMENT',
}

async function main() {
  const apply = process.argv.includes('--apply')
  const checkedAt = new Date('2026-10-22T00:00:00Z')
  const rows = readdirSync(DIR).filter((f) => f.endsWith('.md')).flatMap((f) => {
    const category = CATEGORY_BY_FILE[f] ?? (/^state-training/.test(f) ? 'STATE_TRAINING' : null)
    return category ? parseCatalog(readFileSync(join(DIR, f), 'utf8'), category, f, checkedAt) : []
  })
  const by = (k: (r: (typeof rows)[number]) => string) => rows.reduce<Record<string, number>>((m, r) => ((m[k(r)] = (m[k(r)] ?? 0) + 1), m), {})
  console.log(`${rows.length} programs; verified ${rows.filter((r) => r.verified).length}`, by((r) => r.category), by((r) => r.status))
  if (!apply) return console.log('Dry run. Pass --apply to write.')
  const prisma = new PrismaClient()
  console.log('wrote', await upsertProgramRows(prisma, rows))
  await prisma.$disconnect()
}
main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1) })
