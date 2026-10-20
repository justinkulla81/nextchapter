/**
 * One-off (2026-10-20): fills the live board's AI fields from the crawler's job_ai table
 * (scripts/ai_tag_jobs.py, ncrawl/ai_skills.ai_profile v2): aiSkillGroups / aiSkillItems /
 * aiToolsNamed / aiCertsNamed (re-read with the 2026-10-20 notice filter, and from a direct twin's
 * full text for excerpt rows), plus the new aiExposed / aiExposureWhy / aiMention / aiBasis.
 * Matched by url. The daily import carries the same fields from now on (import-jobs.py).
 *
 * Input: JSONL from the crawler's scripts/ai_board_export.py, one
 * {url, g, i, t, c, e, w, m, b} per line. Values go through importAiSkillFields, like the import.
 *
 * Writes in id-ordered chunks of CHUNK live rows, only rows whose values change, and VACUUMs
 * every VACUUM_EVERY chunks so dead rows are reused (the production disk filled once).
 *
 *   npx tsx scripts/backfill-ai-fields.ts ai.jsonl [--dry-run]
 */
import { readFileSync } from 'fs'
import { PrismaClient } from '@prisma/client'
import { importAiSkillFields } from '../src/lib/skills/ai-skills'

const CHUNK = 5_000
const LOAD_BATCH = 2_000
const VACUUM_EVERY = 10

const [file, ...flags] = process.argv.slice(2)
const dryRun = flags.includes('--dry-run')
if (!file) throw new Error('usage: backfill-ai-fields.ts ai.jsonl [--dry-run]')

const url = new URL(process.env.DIRECT_URL ?? process.env.DATABASE_URL!)
url.searchParams.set('connection_limit', '1')
const prisma = new PrismaClient({ datasources: { db: { url: url.toString() } } })

// Arrays travel as JSON text (unnest can't take a text[][]), turned back into text[] in SQL.
const arr = (a: string[] | undefined) => JSON.stringify(a ?? [])

async function main() {
  const t0 = Date.now()
  const rec = { url: [] as string[], g: [] as string[], i: [] as string[], t: [] as string[], c: [] as string[], e: [] as boolean[], w: [] as string[], m: [] as (boolean | null)[], b: [] as (string | null)[] }
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    if (!line) continue
    const r = JSON.parse(line) as { url: string; g: string[]; i: string[]; t: string[]; c: string[]; e: boolean; w: string[]; m: boolean; b: string }
    const f = importAiSkillFields({ aiSkillGroups: r.g, aiSkillItems: r.i, aiToolsNamed: r.t, aiCertsNamed: r.c, aiExposed: r.e, aiExposureWhy: r.w, aiMention: r.m, aiBasis: r.b })
    rec.url.push(r.url)
    rec.g.push(arr(f.aiSkillGroups))
    rec.i.push(arr(f.aiSkillItems))
    rec.t.push(arr(f.aiToolsNamed))
    rec.c.push(arr(f.aiCertsNamed))
    rec.e.push(!!f.aiExposed)
    rec.w.push(arr(f.aiExposureWhy))
    rec.m.push(f.aiMention ?? null)
    rec.b.push(f.aiBasis ?? null)
  }
  console.log(`read ${rec.url.length} crawler urls in ${Date.now() - t0} ms`)

  await prisma.$executeRawUnsafe(
    `CREATE TEMP TABLE ai_fill (url text PRIMARY KEY, g text[], i text[], t text[], c text[], e boolean, w text[], m boolean, b text)`
  )
  const toArr = (col: string) => `ARRAY(SELECT jsonb_array_elements_text(${col}::jsonb))`
  for (let k = 0; k < rec.url.length; k += LOAD_BATCH) {
    const s = <T,>(a: T[]) => a.slice(k, k + LOAD_BATCH)
    await prisma.$executeRawUnsafe(
      `INSERT INTO ai_fill SELECT u, ${toArr('g')}, ${toArr('i')}, ${toArr('t')}, ${toArr('c')}, e, ${toArr('w')}, m, b
       FROM unnest($1::text[], $2::text[], $3::text[], $4::text[], $5::text[], $6::boolean[], $7::text[], $8::boolean[], $9::text[]) AS x(u, g, i, t, c, e, w, m, b)
       ON CONFLICT (url) DO NOTHING`,
      s(rec.url), s(rec.g), s(rec.i), s(rec.t), s(rec.c), s(rec.e), s(rec.w), s(rec.m), s(rec.b)
    )
  }
  await prisma.$executeRawUnsafe(`ANALYZE ai_fill`)
  console.log(`loaded in ${Date.now() - t0} ms`)

  const [match] = await prisma.$queryRawUnsafe<{ matched: number; live: number }[]>(`
    SELECT count(f.url)::int AS matched, count(*)::int AS live
    FROM "ExclusiveJobPosting" e LEFT JOIN ai_fill f ON f.url = e.url WHERE e."archivedAt" IS NULL`)
  console.log('match', match)
  if (dryRun) return

  const cols = `("aiSkillGroups", "aiSkillItems", "aiToolsNamed", "aiCertsNamed", "aiExposed", "aiExposureWhy", "aiMention", "aiBasis")`
  let lo = ''
  let chunks = 0
  let updated = 0
  for (;;) {
    const next = await prisma.$queryRawUnsafe<{ id: string }[]>(
      `SELECT "id" FROM "ExclusiveJobPosting" WHERE "archivedAt" IS NULL AND "id" > $1 ORDER BY "id" OFFSET ${CHUNK - 1} LIMIT 1`,
      lo
    )
    const hi = next[0]?.id ?? null
    const range = `e."archivedAt" IS NULL AND e."id" > $1 ${hi ? 'AND e."id" <= $2' : ''}`
    const args = hi ? [lo, hi] : [lo]
    const n = await prisma.$executeRawUnsafe(
      `UPDATE "ExclusiveJobPosting" e SET ${cols} = (f.g, f.i, f.t, f.c, f.e, f.w, f.m, f.b)
       FROM ai_fill f WHERE f.url = e.url AND ${range}
         AND (e."aiSkillGroups", e."aiSkillItems", e."aiToolsNamed", e."aiCertsNamed", e."aiExposed", e."aiExposureWhy", e."aiMention", e."aiBasis")
             IS DISTINCT FROM (f.g, f.i, f.t, f.c, f.e, f.w, f.m, f.b)`,
      ...args
    )
    updated += n
    chunks++
    if (chunks % VACUUM_EVERY === 0) await prisma.$executeRawUnsafe(`VACUUM "ExclusiveJobPosting"`)
    console.log(`chunk ${chunks}: +${n} (total ${updated}) ${Math.round((Date.now() - t0) / 1000)}s`)
    if (!hi) break
    lo = hi
  }
  await prisma.$executeRawUnsafe(`VACUUM ANALYZE "ExclusiveJobPosting"`)
  console.log(`done: ${updated} rows updated, ${Math.round((Date.now() - t0) / 1000)}s`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
