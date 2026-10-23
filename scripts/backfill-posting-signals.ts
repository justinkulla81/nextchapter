/**
 * Fills the live board's postingSignals from the crawler (ncrawl/posting_signals.py on the FULL
 * posting text). Input: JSONL from the crawler's scripts/posting_signals_board_export.py, one
 * {f, url, s} per line (f = jobs.fingerprint, s = signal ids, [] = none).
 *
 * Matched by crawlerFingerprint first, then by url where that url is unique in the export (never
 * when two crawler rows share it). Values go through importPostingSignalFields, like the import.
 * Writes in id-ordered chunks of CHUNK live rows, only rows whose value changes.
 *
 *   npx tsx scripts/backfill-posting-signals.ts signals.jsonl [--dry-run]
 */
import { readFileSync } from 'fs'
import { PrismaClient } from '@prisma/client'
import { importPostingSignalFields } from '../src/lib/jobs/posting-signals'

const CHUNK = 5_000
// The entry-level ids (scripts/backfill-entry-signals.ts sets them) are kept as they are.
const ENTRY_KEEP = `ARRAY(SELECT x FROM unnest(e."postingSignals") AS x WHERE x = ANY('{no_experience_ok,training_provided,entry_ai,entry_ai_preferred}'::text[]))`
const LOAD_BATCH = 5_000

const [file, ...flags] = process.argv.slice(2)
const dryRun = flags.includes('--dry-run')
if (!file) throw new Error('usage: backfill-posting-signals.ts signals.jsonl [--dry-run]')

const url = new URL(process.env.DIRECT_URL ?? process.env.DATABASE_URL!)
url.searchParams.set('connection_limit', '1')
const prisma = new PrismaClient({ datasources: { db: { url: url.toString() } } })

async function main() {
  const t0 = Date.now()
  const fp: (string | null)[] = []
  const urls: string[] = []
  const sigs: string[] = []
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    if (!line) continue
    const r = JSON.parse(line) as { f?: string; url: string; s: string[] }
    fp.push(r.f ?? null)
    urls.push(r.url)
    sigs.push((importPostingSignalFields({ postingSignals: r.s }).postingSignals ?? []).filter((x) => !['no_experience_ok', 'training_provided', 'entry_ai', 'entry_ai_preferred'].includes(x)).join(','))
  }
  console.log(`read ${urls.length} crawler rows`)

  await prisma.$executeRawUnsafe(`CREATE TEMP TABLE ps_all (f text, url text, s text[])`)
  for (let k = 0; k < urls.length; k += LOAD_BATCH) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO ps_all SELECT f, u, CASE WHEN s = '' THEN ARRAY[]::text[] ELSE string_to_array(s, ',') END
       FROM unnest($1::text[], $2::text[], $3::text[]) AS x(f, u, s)`,
      fp.slice(k, k + LOAD_BATCH), urls.slice(k, k + LOAD_BATCH), sigs.slice(k, k + LOAD_BATCH)
    )
  }
  await prisma.$executeRawUnsafe(`CREATE TEMP TABLE ps_fp AS SELECT DISTINCT ON (f) * FROM ps_all WHERE f IS NOT NULL ORDER BY f`)
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX ON ps_fp (f)`)
  await prisma.$executeRawUnsafe(`CREATE TEMP TABLE ps_url AS SELECT * FROM ps_all WHERE url IN (SELECT url FROM ps_all GROUP BY url HAVING count(*) = 1)`)
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX ON ps_url (url)`)
  await prisma.$executeRawUnsafe(`ANALYZE ps_fp`)
  await prisma.$executeRawUnsafe(`ANALYZE ps_url`)

  const [match] = await prisma.$queryRawUnsafe<{ by_fp: number; by_url: number; live: number }[]>(`
    SELECT count(p.f)::int AS by_fp, count(*) FILTER (WHERE p.f IS NULL AND u.url IS NOT NULL)::int AS by_url, count(*)::int AS live
    FROM "ExclusiveJobPosting" e LEFT JOIN ps_fp p ON p.f = e."crawlerFingerprint" LEFT JOIN ps_url u ON u.url = e.url
    WHERE e."archivedAt" IS NULL`)
  console.log('match', match)
  if (dryRun) return

  let lo = ''
  let chunks = 0
  const updated = { fp: 0, url: 0 }
  for (;;) {
    const next = await prisma.$queryRawUnsafe<{ id: string }[]>(
      `SELECT "id" FROM "ExclusiveJobPosting" WHERE "archivedAt" IS NULL AND "id" > $1 ORDER BY "id" OFFSET ${CHUNK - 1} LIMIT 1`,
      lo
    )
    const hi = next[0]?.id ?? null
    const range = `e."archivedAt" IS NULL AND e."id" > $1 ${hi ? 'AND e."id" <= $2' : ''}`
    const args = hi ? [lo, hi] : [lo]
    updated.fp += await prisma.$executeRawUnsafe(
      `UPDATE "ExclusiveJobPosting" e SET "postingSignals" = p.s || ${ENTRY_KEEP} FROM ps_fp p
       WHERE p.f = e."crawlerFingerprint" AND ${range} AND e."postingSignals" IS DISTINCT FROM p.s || ${ENTRY_KEEP}`,
      ...args
    )
    updated.url += await prisma.$executeRawUnsafe(
      `UPDATE "ExclusiveJobPosting" e SET "postingSignals" = u.s || ${ENTRY_KEEP} FROM ps_url u
       WHERE u.url = e.url AND NOT EXISTS (SELECT 1 FROM ps_fp p WHERE p.f = e."crawlerFingerprint")
         AND ${range} AND e."postingSignals" IS DISTINCT FROM u.s || ${ENTRY_KEEP}`,
      ...args
    )
    chunks++
    console.log(`chunk ${chunks}: total ${JSON.stringify(updated)} ${Math.round((Date.now() - t0) / 1000)}s`)
    if (!hi) break
    lo = hi
  }
  console.log(`done: ${JSON.stringify(updated)} rows updated, ${Math.round((Date.now() - t0) / 1000)}s`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
