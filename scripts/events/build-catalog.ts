/**
 * Rebuilds src/lib/events/catalog.json from data/events/*.json (the researched rows).
 * The CRM Events tab seeds the ConferenceEvent table from that file and reseeds when it is newer;
 * rows an admin edited in the CRM are locked and never overwritten.
 *   npx tsx scripts/events/build-catalog.ts
 */
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { normalizeRow } from '../../src/lib/events/normalize'

const DIR = join(__dirname, '../../data/events')
const out = new Map<string, Record<string, unknown>>()
let dropped = 0
const files: string[] = []
const walk = (d: string) => {
  for (const f of readdirSync(d).sort()) {
    const p = join(d, f)
    if (statSync(p).isDirectory()) { if (!['review', 'review-input', 'price-input', 'patches'].includes(f)) walk(p) }
    else if (f.endsWith('.json') && f !== 'slices.json' && !f.startsWith('_')) files.push(p)
  }
}
walk(DIR)
const nameKey = (n: unknown) => String(n).toLowerCase().replace(/\b(20\d\d|annual|conference|conf|summit|expo|the)\b/g, '').replace(/[^a-z0-9]/g, '')
const byName = new Map<string, string>()
for (const f of files) {
  const rows = JSON.parse(readFileSync(f, 'utf8')) as Record<string, unknown>[]
  for (const raw of rows) {
    const { row, problems } = normalizeRow(raw)
    if (!row) { dropped++; console.warn(`${f}: skipped ${String(raw.name ?? raw.id)}: ${problems.join('; ')}`); continue }
    for (const p of problems) console.warn(`${f}: ${row.id}: ${p}`)
    // Same event under another id or file: keep one. A verified row beats an unverified one; otherwise merge tags.
    const key = byName.get(nameKey(row.name)) ?? String(row.id)
    byName.set(nameKey(row.name), key)
    const prior = out.get(key)
    if (!prior) { out.set(key, { ...row, id: key }); continue }
    const keep = row.verified && !prior.verified ? { ...row, id: key } : prior
    for (const k of ['industries', 'functions', 'segments', 'roles', 'journeys', 'seniorities'] as const) keep[k] = [...new Set([...(prior[k] as string[]), ...(row[k] as string[])])]
    out.set(key, keep)
  }
}
// Review decisions (data/events/review/*.json): drop removes a row, publish applies the researched patch and
// publishes, jumpball keeps the row hidden and marks it for the owner. See data/events/README-v4.md.
let dropped2 = 0, published2 = 0, jump = 0
const reviewDir = join(DIR, 'review')
if (existsSync(reviewDir)) {
  for (const f of readdirSync(reviewDir).filter((x) => x.endsWith('.json')).sort()) {
    const decisions = JSON.parse(readFileSync(join(reviewDir, f), 'utf8')) as { id: string; action: string; reason?: string; patch?: Record<string, unknown> }[]
    for (const d of decisions) {
      const cur = out.get(d.id)
      if (!cur) continue
      if (d.action === 'drop') { out.delete(d.id); dropped2++ }
      else if (d.action === 'publish') {
        // A publish decision goes live; a reviewer who left the patch unverified and unpublished keeps it as a hidden lead.
        const hide = d.patch?.published === false || (d.patch?.verified === false && d.patch?.published !== true)
        const { row } = normalizeRow({ ...cur, ...(d.patch ?? {}), id: d.id, verified: !hide })
        if (row) { out.set(d.id, row); published2++ }
      } else if (d.action === 'jumpball') {
        out.set(d.id, { ...cur, published: false, adminNote: `JUMP BALL: ${d.reason ?? 'needs a decision'}` })
        jump++
      }
    }
  }
}
// Field patches (data/events/patches/*.json): [{ id, patch }] merged into the current row, publish state untouched.
let patched = 0
const patchDir = join(DIR, 'patches')
if (existsSync(patchDir)) {
  for (const f of readdirSync(patchDir).filter((x) => x.endsWith('.json')).sort()) {
    for (const d of JSON.parse(readFileSync(join(patchDir, f), 'utf8')) as { id: string; patch: Record<string, unknown> }[]) {
      const cur = out.get(d.id)
      if (!cur || !d.patch) continue
      // Only price and access fields can be patched this way; a patch never changes what is published.
      const allowed = ['costLow', 'costHigh', 'costNote', 'cheaperWays', 'access', 'applyUrl', 'applyDeadline'] as const
      const merged: Record<string, unknown> = { ...cur }
      for (const k of allowed) if (k in d.patch) merged[k] = d.patch[k]
      const { row } = normalizeRow({ ...merged, verified: cur.verified })
      if (row) { out.set(d.id, { ...row, published: cur.published }); patched++ }
    }
  }
}
console.log(`review: ${published2} published, ${dropped2} dropped, ${jump} jump balls; price patches applied: ${patched}`)
const rows = [...out.values()].sort((a, b) => (a.importance as number) - (b.importance as number) || String(a.name).localeCompare(String(b.name)))
writeFileSync(join(__dirname, '../../src/lib/events/catalog.json'), JSON.stringify({ builtAt: new Date().toISOString(), rows }, null, 1))
console.log(`${rows.length} events (${rows.filter((r) => r.verified).length} verified, ${rows.filter((r) => r.published).length} published), ${dropped} skipped`)
