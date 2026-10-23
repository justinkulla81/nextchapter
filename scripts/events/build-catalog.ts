/**
 * Rebuilds src/lib/events/catalog.json from data/events/*.json (the researched rows).
 * The CRM Events tab seeds the ConferenceEvent table from that file and reseeds when it is newer;
 * rows an admin edited in the CRM are locked and never overwritten.
 *   npx tsx scripts/events/build-catalog.ts
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { normalizeRow } from '../../src/lib/events/normalize'

const DIR = join(__dirname, '../../data/events')
const out = new Map<string, Record<string, unknown>>()
let dropped = 0
for (const f of readdirSync(DIR).filter((x) => x.endsWith('.json')).sort()) {
  const rows = JSON.parse(readFileSync(join(DIR, f), 'utf8')) as Record<string, unknown>[]
  for (const raw of rows) {
    const { row, problems } = normalizeRow(raw)
    if (!row) { dropped++; console.warn(`${f}: skipped ${String(raw.name ?? raw.id)}: ${problems.join('; ')}`); continue }
    for (const p of problems) console.warn(`${f}: ${row.id}: ${p}`)
    const prior = out.get(row.id as string)
    // Same event in two files: keep the verified one, then the one with more detail.
    if (!prior || (row.verified && !prior.verified)) out.set(row.id as string, row)
  }
}
const rows = [...out.values()].sort((a, b) => (a.importance as number) - (b.importance as number) || String(a.name).localeCompare(String(b.name)))
writeFileSync(join(__dirname, '../../src/lib/events/catalog.json'), JSON.stringify({ builtAt: new Date().toISOString(), rows }, null, 1))
console.log(`${rows.length} events (${rows.filter((r) => r.verified).length} verified, ${rows.filter((r) => r.published).length} published), ${dropped} skipped`)
