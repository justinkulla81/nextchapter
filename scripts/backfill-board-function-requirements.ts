/**
 * One-off (2026-10-16): fills the live board's function (targetFunction), employer
 * sector, requirement flags/tags and folded industry from the crawler, matching each
 * live posting to a crawler job by url, then by externalJobId (the source's own id)
 * where that id is unique. The daily import carries the same fields from now on.
 *
 * Input: a TSV from the crawler (url, source_job_id, function code, industry, sector,
 * requirements JSON) — see the PR notes. Values go through the same functions the
 * import route uses (job-functions.ts, import-optional-fields.ts, requirements.ts).
 *
 * Writes in id-ordered chunks of CHUNK live rows, only rows whose values change, and
 * VACUUMs the table every VACUUM_EVERY chunks so dead rows are reused instead of
 * growing the disk (the production disk filled once this week).
 *
 *   npx tsx scripts/backfill-board-function-requirements.ts board.tsv [--dry-run]
 */
import { readFileSync } from 'fs'
import { PrismaClient } from '@prisma/client'
import { functionLabelFor } from '../src/lib/jobs/job-functions'
import { canonicalIndustry } from '../src/lib/jobs/import-optional-fields'
import { isEmployerSector } from '../src/lib/jobs/employer-sector'
import { parseRequirementFlags, requirementTagsFor } from '../src/lib/jobs/requirements'

const CHUNK = 5_000
const LOAD_BATCH = 2_000
const VACUUM_EVERY = 10

const [file, ...flags] = process.argv.slice(2)
const dryRun = flags.includes('--dry-run')
if (!file) throw new Error('usage: backfill-board-function-requirements.ts board.tsv [--dry-run]')

// One session (temp table), straight to Postgres rather than through the pooler.
const url = new URL(process.env.DIRECT_URL ?? process.env.DATABASE_URL!)
url.searchParams.set('connection_limit', '1')
const prisma = new PrismaClient({ datasources: { db: { url: url.toString() } } })

function parseTsvLine(line: string): string[] {
  // csv.writer(delimiter='\t', QUOTE_MINIMAL): quoted fields only when they hold a tab, quote or newline.
  const out: string[] = []
  let i = 0
  while (i <= line.length) {
    if (line[i] === '"') {
      let v = ''
      i++
      while (i < line.length) {
        if (line[i] === '"' && line[i + 1] === '"') {
          v += '"'
          i += 2
        } else if (line[i] === '"') {
          i++
          break
        } else v += line[i++]
      }
      out.push(v)
      i++ // tab
    } else {
      const j = line.indexOf('\t', i)
      const end = j === -1 ? line.length : j
      out.push(line.slice(i, end))
      i = end + 1
    }
  }
  return out
}

async function main() {
  const t0 = Date.now()
  const lines = readFileSync(file, 'utf8').split('\n').filter(Boolean)
  const rec = {
    url: [] as string[],
    ext: [] as (string | null)[],
    fn: [] as (string | null)[],
    industry: [] as (string | null)[],
    sector: [] as (string | null)[],
    flags: [] as (string | null)[],
    tags: [] as (string | null)[],
  }
  for (const line of lines) {
    const [u, ext, fn, industry, sector, reqs] = parseTsvLine(line)
    if (!u) continue
    let parsed: unknown = null
    try {
      parsed = reqs ? JSON.parse(reqs) : null
    } catch {
      parsed = null
    }
    const f = parseRequirementFlags(parsed)
    rec.url.push(u)
    rec.ext.push(ext || null)
    rec.fn.push(functionLabelFor(fn))
    rec.industry.push(canonicalIndustry(industry))
    rec.sector.push(isEmployerSector(sector) ? sector : null)
    rec.flags.push(f.length ? JSON.stringify(f) : null)
    rec.tags.push(requirementTagsFor(f))
  }
  console.log(`read ${rec.url.length} crawler urls in ${Date.now() - t0} ms`)

  await prisma.$executeRawUnsafe(`CREATE TEMP TABLE crawl_fill (url text PRIMARY KEY, ext text, fn text, industry text, sector text, flags jsonb, tags text)`)
  for (let i = 0; i < rec.url.length; i += LOAD_BATCH) {
    const s = (a: (string | null)[]) => a.slice(i, i + LOAD_BATCH)
    await prisma.$executeRawUnsafe(
      `INSERT INTO crawl_fill SELECT * FROM unnest($1::text[], $2::text[], $3::text[], $4::text[], $5::text[], $6::jsonb[], $7::text[]) ON CONFLICT (url) DO NOTHING`,
      s(rec.url), s(rec.ext), s(rec.fn), s(rec.industry), s(rec.sector), s(rec.flags), s(rec.tags)
    )
  }
  // externalJobId matches only where the crawler id is unique.
  await prisma.$executeRawUnsafe(`CREATE TEMP TABLE crawl_fill_ext AS SELECT DISTINCT ON (ext) * FROM crawl_fill WHERE ext IS NOT NULL AND ext IN (SELECT ext FROM crawl_fill WHERE ext IS NOT NULL GROUP BY ext HAVING count(*) = 1)`)
  await prisma.$executeRawUnsafe(`CREATE INDEX ON crawl_fill_ext (ext)`)
  await prisma.$executeRawUnsafe(`ANALYZE crawl_fill`)
  await prisma.$executeRawUnsafe(`ANALYZE crawl_fill_ext`)
  console.log(`loaded in ${Date.now() - t0} ms`)

  const [match] = await prisma.$queryRawUnsafe<{ by_url: number; by_ext: number; live: number }[]>(`
    SELECT count(*) FILTER (WHERE f.url IS NOT NULL)::int AS by_url,
           count(*) FILTER (WHERE f.url IS NULL AND x.ext IS NOT NULL)::int AS by_ext,
           count(*)::int AS live
    FROM "ExclusiveJobPosting" e
    LEFT JOIN crawl_fill f ON f.url = e.url
    LEFT JOIN crawl_fill_ext x ON x.ext = e."externalJobId"
    WHERE e."archivedAt" IS NULL`)
  console.log('match', match)
  if (dryRun) return

  // Matched value per live row: the url match, else the unique external id.
  const setSql = (src: string) => `
    UPDATE "ExclusiveJobPosting" e SET
      "targetFunction" = COALESCE(${src}.fn, e."targetFunction"),
      "industry" = COALESCE(${src}.industry, e."industry"),
      "employerSector" = COALESCE(${src}.sector, e."employerSector"),
      "requirementFlags" = ${src}.flags,
      "requirementTags" = ${src}.tags`
  const changed = (src: string) => `
      (e."targetFunction", e."industry", e."employerSector", e."requirementTags", e."requirementFlags")
      IS DISTINCT FROM
      (COALESCE(${src}.fn, e."targetFunction"), COALESCE(${src}.industry, e."industry"), COALESCE(${src}.sector, e."employerSector"), ${src}.tags, ${src}.flags)`

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
    const a = await prisma.$executeRawUnsafe(`${setSql('f')} FROM crawl_fill f WHERE f.url = e.url AND ${range} AND ${changed('f')}`, ...args)
    const b = await prisma.$executeRawUnsafe(
      `${setSql('x')} FROM crawl_fill_ext x WHERE x.ext = e."externalJobId" AND NOT EXISTS (SELECT 1 FROM crawl_fill f WHERE f.url = e.url) AND ${range} AND ${changed('x')}`,
      ...args
    )
    updated += a + b
    chunks++
    if (chunks % VACUUM_EVERY === 0) {
      await prisma.$executeRawUnsafe(`VACUUM "ExclusiveJobPosting"`)
      await prisma.$executeRawUnsafe(`VACUUM "BoardLightRow"`)
    }
    console.log(`chunk ${chunks}: +${a + b} (total ${updated}) ${Math.round((Date.now() - t0) / 1000)}s`)
    if (!hi) break
    lo = hi
  }
  // Stray industry labels on rows no crawler job matched (direct posts, gone sources).
  const folded = await prisma.$executeRawUnsafe(`
    UPDATE "ExclusiveJobPosting" SET "industry" = CASE "industry"
      WHEN 'finance' THEN 'financial_services' WHEN 'manufacturing' THEN 'industrial'
      WHEN 'higher_education' THEN 'education' WHEN 'association' THEN 'nonprofit'
      WHEN 'hospitality' THEN 'consumer' WHEN 'defense' THEN 'aerospace_defense' END
    WHERE "archivedAt" IS NULL AND "industry" IN ('finance','manufacturing','higher_education','association','hospitality','defense')`)
  await prisma.$executeRawUnsafe(`VACUUM ANALYZE "ExclusiveJobPosting"`)
  await prisma.$executeRawUnsafe(`VACUUM ANALYZE "BoardLightRow"`)
  console.log(`done: ${updated} rows updated, ${folded} stray industry labels folded, ${Math.round((Date.now() - t0) / 1000)}s`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
