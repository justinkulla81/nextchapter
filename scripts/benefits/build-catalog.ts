/**
 * Rebuilds src/lib/benefits/catalog.json from data/benefits/*.md. The Benefits tab seeds an
 * empty BenefitProgram table from that file, so a catalog update is: edit the .md, run this, commit.
 *   npx tsx scripts/benefits/build-catalog.ts
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseCatalog } from '../../src/lib/benefits/parse'
import type { BenefitCategory } from '../../src/lib/benefits/types'

const DIR = join(__dirname, '../../data/benefits')
const CAT: Record<string, BenefitCategory> = { 'relocation.md': 'RELOCATION', 'state-training.md': 'STATE_TRAINING', 'federal.md': 'FEDERAL', 'courses.md': 'COURSES', 'private.md': 'PRIVATE', 'segments.md': 'SEGMENT' }
const cut = (s: string | null, n: number) => (s ? s.slice(0, n) : null)

const rows = readdirSync(DIR).filter((f) => CAT[f]).flatMap((f) => parseCatalog(readFileSync(join(DIR, f), 'utf8'), CAT[f], f, new Date('2026-10-22T00:00:00Z')))
const slim = rows.map((r) => ({
  ...r, id: r.id.slice(0, 120), name: r.name.slice(0, 140), provider: cut(r.provider, 90), locality: cut(r.locality, 60), amount: cut(r.amount, 160),
  eligibility: cut(r.eligibility, 200), statusNote: cut(r.statusNote, 100), url: cut(r.url, 220), checkedAt: r.checkedAt ? r.checkedAt.toISOString() : null,
}))
writeFileSync(join(__dirname, '../../src/lib/benefits/catalog.json'), JSON.stringify(slim))
console.log(`${slim.length} programs, ${slim.filter((r) => r.verified).length} verified`)
