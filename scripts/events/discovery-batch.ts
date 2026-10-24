/**
 * This month's discovery batch: about a twelfth of the 230 taxonomy segments, rotating so every segment is
 * searched for new conferences once a year. Prints the segments (with their jobs and how many events we hold).
 *   npx tsx scripts/events/discovery-batch.ts [YYYY-MM]
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const arg = process.argv[2]
const now = arg ? new Date(`${arg}-01T00:00:00Z`) : new Date()
const slot = (now.getUTCFullYear() * 12 + now.getUTCMonth()) % 12
const slices = JSON.parse(readFileSync(join(__dirname, '../../data/events/slices.json'), 'utf8')) as { industry: string; segments: Record<string, string[]> }[]
const catalog = JSON.parse(readFileSync(join(__dirname, '../../src/lib/events/catalog.json'), 'utf8')) as { rows: { segments: string[]; published: boolean }[] }
const have = new Map<string, number>()
for (const r of catalog.rows) if (r.published) for (const s of r.segments) have.set(s, (have.get(s) ?? 0) + 1)

const all = slices.flatMap((s) => Object.entries(s.segments).map(([segment, roles]) => ({ industry: s.industry, segment, roles })))
const batch = all.filter((_, i) => i % 12 === slot).map((x) => ({ ...x, published: have.get(x.segment) ?? 0 }))
console.log(JSON.stringify({ month: now.toISOString().slice(0, 7), slot, segments: batch.length, batch }, null, 1))
