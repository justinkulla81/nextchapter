/**
 * Fills the live board's entry-level signals from the crawler (ncrawl/entry_signals.py on the FULL posting text):
 * postingSignals' no_experience_ok / training_provided / entry_ai / entry_ai_preferred, noExperiencePhrase and
 * trainingPhrase. Input: JSONL from the crawler's scripts/entry_signals_board_export.py, one {f, url, s, p, t} per line (every active entry / early-career job;
 * s = [] when none).
 *
 * Matched by crawlerFingerprint first, then by url where that url is unique in the export. The other posting signals
 * (career_changer_welcome …) are kept: only the entry ids are replaced. Writes in id-ordered chunks of CHUNK live
 * rows, each with a short statement timeout, only rows whose value changes.
 *
 *   npx tsx scripts/backfill-entry-signals.ts entry.jsonl [--dry-run]
 */
import { readFileSync } from 'fs'
import { PrismaClient } from '@prisma/client'
import { ENTRY_ONLY_SIGNALS } from '../src/lib/jobs/posting-signals'

const CHUNK = 2_000
const LOAD_BATCH = 5_000
const ENTRY_IDS = ['no_experience_ok', ...ENTRY_ONLY_SIGNALS]
const KEEP = (col: string) => `ARRAY(SELECT x FROM unnest(${col}) AS x WHERE x <> ALL('{${ENTRY_IDS.join(',')}}'::text[]))`

const [file, ...flags] = process.argv.slice(2)
const dryRun = flags.includes('--dry-run')
if (!file) throw new Error('usage: backfill-entry-signals.ts entry.jsonl [--dry-run]')

const url = new URL(process.env.DIRECT_URL ?? process.env.DATABASE_URL!)
url.searchParams.set('connection_limit', '1')
const prisma = new PrismaClient({ datasources: { db: { url: url.toString() } } })

async function main() {
  const t0 = Date.now()
  const fp: (string | null)[] = []
  const urls: string[] = []
  const sigs: string[] = []
  const phrases: (string | null)[] = []
  const tphrases: (string | null)[] = []
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    if (!line) continue
    const r = JSON.parse(line) as { f?: string; url: string; s: string[]; p?: string | null; t?: string | null }
    fp.push(r.f ?? null)
    urls.push(r.url)
    sigs.push(r.s.filter((x) => ENTRY_IDS.includes(x)).join(','))
    phrases.push(r.s.includes('no_experience_ok') && r.p ? r.p.slice(0, 240) : null)
    tphrases.push(r.s.includes('training_provided') && r.t ? r.t.slice(0, 240) : null)
  }
  console.log(`read ${urls.length} crawler rows`)

  await prisma.$executeRawUnsafe(`CREATE TEMP TABLE es_all (f text, url text, s text[], p text, t text)`)
  for (let k = 0; k < urls.length; k += LOAD_BATCH) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO es_all SELECT f, u, CASE WHEN s = '' THEN ARRAY[]::text[] ELSE string_to_array(s, ',') END, p, t
       FROM unnest($1::text[], $2::text[], $3::text[], $4::text[], $5::text[]) AS x(f, u, s, p, t)`,
      fp.slice(k, k + LOAD_BATCH), urls.slice(k, k + LOAD_BATCH), sigs.slice(k, k + LOAD_BATCH), phrases.slice(k, k + LOAD_BATCH), tphrases.slice(k, k + LOAD_BATCH)
    )
  }
  await prisma.$executeRawUnsafe(`CREATE TEMP TABLE es_fp AS SELECT DISTINCT ON (f) * FROM es_all WHERE f IS NOT NULL ORDER BY f`)
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX ON es_fp (f)`)
  await prisma.$executeRawUnsafe(`CREATE TEMP TABLE es_url AS SELECT * FROM es_all WHERE url IN (SELECT url FROM es_all GROUP BY url HAVING count(*) = 1)`)
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX ON es_url (url)`)
  await prisma.$executeRawUnsafe(`ANALYZE es_fp`)
  await prisma.$executeRawUnsafe(`ANALYZE es_url`)

  const [match] = await prisma.$queryRawUnsafe<{ by_fp: number; by_url: number; live: number }[]>(`
    SELECT count(p.f)::int AS by_fp, count(*) FILTER (WHERE p.f IS NULL AND u.url IS NOT NULL)::int AS by_url, count(*)::int AS live
    FROM "ExclusiveJobPosting" e LEFT JOIN es_fp p ON p.f = e."crawlerFingerprint" LEFT JOIN es_url u ON u.url = e.url
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
    const [a, b] = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL statement_timeout = '15s'`)
      await tx.$executeRawUnsafe(`SET LOCAL lock_timeout = '5s'`)
      const a = await tx.$executeRawUnsafe(
        `UPDATE "ExclusiveJobPosting" e SET "postingSignals" = ${KEEP('e."postingSignals"')} || p.s, "noExperiencePhrase" = p.p, "trainingPhrase" = p.t FROM es_fp p
         WHERE p.f = e."crawlerFingerprint" AND ${range}
           AND (e."postingSignals" IS DISTINCT FROM ${KEEP('e."postingSignals"')} || p.s OR e."noExperiencePhrase" IS DISTINCT FROM p.p OR e."trainingPhrase" IS DISTINCT FROM p.t)`,
        ...args
      )
      const b = await tx.$executeRawUnsafe(
        `UPDATE "ExclusiveJobPosting" e SET "postingSignals" = ${KEEP('e."postingSignals"')} || u.s, "noExperiencePhrase" = u.p, "trainingPhrase" = u.t FROM es_url u
         WHERE u.url = e.url AND NOT EXISTS (SELECT 1 FROM es_fp p WHERE p.f = e."crawlerFingerprint")
           AND ${range} AND (e."postingSignals" IS DISTINCT FROM ${KEEP('e."postingSignals"')} || u.s OR e."noExperiencePhrase" IS DISTINCT FROM u.p OR e."trainingPhrase" IS DISTINCT FROM u.t)`,
        ...args
      )
      return [a, b]
    }, { timeout: 60_000 })
    updated.fp += a
    updated.url += b
    chunks++
    if (chunks % 10 === 0 || !hi) console.log(`chunk ${chunks}: total ${JSON.stringify(updated)} ${Math.round((Date.now() - t0) / 1000)}s`)
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
