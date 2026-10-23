/**
 * Splits the taxonomy into research slices (about four segments each) and lists the event ids already
 * in the catalog, so each research agent knows its cells and what to skip.
 *   npx tsx scripts/events/make-slices.ts
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { TAXONOMY } from '../../src/lib/events/taxonomy'

const DIR = join(__dirname, '../../data/events')
const slugOf = (s: string) => s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const slices: { id: string; industry: string; segments: Record<string, string[]> }[] = []
for (const [industry, segs] of Object.entries(TAXONOMY)) {
  const names = Object.keys(segs)
  const per = names.length <= 5 ? names.length : 4
  for (let i = 0; i < names.length; i += per) {
    const part = names.slice(i, i + per)
    // fold a lone leftover segment into the previous slice
    slices.push({ id: `${slugOf(industry)}-${slices.filter((s) => s.industry === industry).length + 1}`, industry, segments: Object.fromEntries(part.map((n) => [n, segs[n]])) })
  }
}
writeFileSync(join(DIR, 'slices.json'), JSON.stringify(slices, null, 1))

const rows: string[] = []
const walk = (d: string) => {
  for (const f of readdirSync(d)) {
    const p = join(d, f)
    if (statSync(p).isDirectory()) walk(p)
    else if (f.endsWith('.json') && f !== 'slices.json') for (const r of JSON.parse(readFileSync(p, 'utf8')) as { id?: string; name?: string }[]) rows.push(`${r.id} | ${r.name}`)
  }
}
walk(DIR)
writeFileSync(join(DIR, '_existing.txt'), [...new Set(rows)].sort().join('\n') + '\n')
console.log(`${slices.length} slices, ${rows.length} existing events`)
