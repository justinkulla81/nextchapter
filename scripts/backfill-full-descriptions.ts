/**
 * One-time backfill (2026-10-24): open board rows imported while only a ~1,000-character
 * excerpt was stored get the FULL description the crawler already exported. Input: JSONL on
 * stdin, one {"url", "d"} per line (d = the CSV's description column), for example
 *
 *   python3 -c '...csv -> jsonl...' | npx tsx scripts/backfill-full-descriptions.ts [--dry-run]
 *
 * Only rows that are open, still hold an excerpt (src/lib/jobs/posting-text.ts isExcerpt)
 * and whose first 200 characters (whitespace collapsed) match the new text are written, so
 * a different posting at the same url is never overwritten. The text goes through the same
 * fullDescriptionOf the import uses, so the next import sees no change. Batches of BATCH
 * rows, each its own statement with a short statement / lock timeout.
 */
import { createInterface } from 'readline'
import { PrismaClient } from '@prisma/client'
import { fullDescriptionOf, EXCERPT_CHARS } from '../src/lib/jobs/posting-text'

const BATCH = 200
const dryRun = process.argv.includes('--dry-run')

const dbUrl = new URL(process.env.DIRECT_URL ?? process.env.DATABASE_URL!)
dbUrl.searchParams.set('connection_limit', '1')
const prisma = new PrismaClient({ datasources: { db: { url: dbUrl.toString() } } })

let seen = 0
let candidates = 0
let written = 0

async function flush(urls: string[], texts: string[]) {
  if (urls.length === 0) return
  if (dryRun) {
    const r = await prisma.$queryRaw<{ n: number }[]>`
      SELECT count(*)::int AS n FROM public."ExclusiveJobPosting" e
      JOIN unnest(${urls}::text[], ${texts}::text[]) AS v(url, d) ON e.url = v.url
      WHERE e."archivedAt" IS NULL AND right(e.description, 1) = '…' AND length(e.description) <= ${EXCERPT_CHARS + 1}
        AND regexp_replace(left(e.description, 200), '\\s+', ' ', 'g') = regexp_replace(left(v.d, 200), '\\s+', ' ', 'g')`
    written += r[0].n
    return
  }
  const n = await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL statement_timeout = '15s'`)
    await tx.$executeRawUnsafe(`SET LOCAL lock_timeout = '5s'`)
    return tx.$executeRaw`
      UPDATE public."ExclusiveJobPosting" e SET description = v.d
      FROM unnest(${urls}::text[], ${texts}::text[]) AS v(url, d)
      WHERE e.url = v.url AND e."archivedAt" IS NULL AND right(e.description, 1) = '…' AND length(e.description) <= ${EXCERPT_CHARS + 1}
        AND regexp_replace(left(e.description, 200), '\\s+', ' ', 'g') = regexp_replace(left(v.d, 200), '\\s+', ' ', 'g')`
  }, { timeout: 30_000 })
  written += n
}

async function main() {
  const rl = createInterface({ input: process.stdin, crlfDelay: Infinity })
  let urls: string[] = []
  let texts: string[] = []
  for await (const line of rl) {
    if (!line.trim()) continue
    seen++
    const { url, d } = JSON.parse(line) as { url: string; d: string }
    const text = fullDescriptionOf(d)
    if (!url || !text || text.length <= EXCERPT_CHARS) continue
    candidates++
    urls.push(url.trim())
    texts.push(text)
    if (urls.length >= BATCH) {
      for (let attempt = 1; ; attempt++) {
        try {
          await flush(urls, texts)
          break
        } catch (error) {
          if (attempt >= 3) throw error
          console.error(`batch failed (attempt ${attempt}), retrying`, (error as Error).message.slice(0, 200))
          await new Promise((r) => setTimeout(r, 3000 * attempt))
        }
      }
      urls = []
      texts = []
      if (candidates % 10_000 < BATCH) console.log(JSON.stringify({ seen, candidates, written, dryRun }))
    }
  }
  await flush(urls, texts)
  console.log('done', JSON.stringify({ seen, candidates, written, dryRun }))
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
