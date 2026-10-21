/**
 * One-off (2026-10-21): re-labels live board rows after the crawler re-classified their
 * function (ncrawl taxonomy.function_evidence: the title, its allowlist and its O*NET
 * occupation decide; the description no longer does, and weak evidence stays blank).
 *
 * Input: a JSON array from the crawler re-tag, one [fingerprint, url, sourceJobId, functionCode,
 * title] per moved crawler job ("" code = blank). Each live posting is matched on
 * crawlerFingerprint first, then by url for rows without a fingerprint match. Values go
 * through the import route's own functions: targetFunction = functionLabelForTitle(code, title),
 * subFunction = subFunctionFor({ title, fn: targetFunction ?? inferFunctionFromTitle(title), soc }).
 * A blank code clears targetFunction (the import would store null too).
 *
 * Writes in batches of BATCH rows (100-5,000), only rows whose values change; BoardLightRow
 * follows through its triggers. Writes the changed posting ids to --out (default
 * relabelled-postings.json) for the ApplicationSkillSnapshot refresh.
 *
 *   node --env-file=.env.local --import tsx scripts/backfill-board-function-relabel.ts moved.json [--dry-run] [--out file]
 */
import { readFileSync, writeFileSync } from 'fs'
import { PrismaClient } from '@prisma/client'
import { functionLabelForTitle } from '../src/lib/jobs/job-functions'
import { subFunctionFor } from '../src/lib/jobs/sub-functions'
import { inferFunctionFromTitle } from '../src/lib/jobs/infer-job-function'

const BATCH = 2_000

const args = process.argv.slice(2)
const file = args[0]?.startsWith('--') ? undefined : args[0]
const dryRun = args.includes('--dry-run')
const outFile = args.includes('--out') ? args[args.indexOf('--out') + 1] : 'relabelled-postings.json'
if (!file) throw new Error('usage: backfill-board-function-relabel.ts moved.json [--dry-run] [--out file]')

const url = new URL(process.env.DIRECT_URL ?? process.env.DATABASE_URL!)
url.searchParams.set('connection_limit', '1')
const prisma = new PrismaClient({ datasources: { db: { url: url.toString() } } })

type Moved = [fingerprint: string, url: string, sourceJobId: string, code: string, title: string]
type Row = { id: string; title: string; socCode: string | null; targetFunction: string | null; subFunction: string | null; key: string }

async function main() {
  const t0 = Date.now()
  const moved = JSON.parse(readFileSync(file!, 'utf8')) as Moved[]
  const codeByFp = new Map(moved.map((m) => [m[0], m[3]]))
  const codeByUrl = new Map<string, string>()
  for (const m of moved) if (m[1] && !codeByUrl.has(m[1])) codeByUrl.set(m[1], m[3])
  console.log(`read ${moved.length} moved crawler jobs`)

  const changedIds: string[] = []
  const moves = new Map<string, number>()
  let matchedFp = 0
  let matchedUrl = 0
  let written = 0

  async function relabel(rows: Row[], codeOf: (r: Row) => string | undefined) {
    const upd: { id: string; fn: string | null; sub: string | null }[] = []
    for (const r of rows) {
      const code = codeOf(r)
      if (code === undefined) continue
      const fn = functionLabelForTitle(code, r.title)
      const sub = subFunctionFor({ title: r.title, fn: fn ?? inferFunctionFromTitle(r.title.trim()), soc: r.socCode })
      if (fn === r.targetFunction && sub === r.subFunction) continue
      upd.push({ id: r.id, fn, sub })
      const k = `${r.targetFunction ?? '(blank)'} -> ${fn ?? '(blank)'}`
      moves.set(k, (moves.get(k) ?? 0) + 1)
    }
    for (let i = 0; i < upd.length; i += BATCH) {
      const part = upd.slice(i, i + BATCH)
      changedIds.push(...part.map((u) => u.id))
      if (dryRun) continue
      written += await prisma.$executeRawUnsafe(
        `UPDATE "ExclusiveJobPosting" e SET "targetFunction" = v.fn, "subFunction" = v.sub
         FROM unnest($1::text[], $2::text[], $3::text[]) AS v(id, fn, sub)
         WHERE e."id" = v.id`,
        part.map((u) => u.id), part.map((u) => u.fn), part.map((u) => u.sub)
      )
    }
  }

  // 1. By crawler fingerprint.
  const fps = [...codeByFp.keys()]
  const seen = new Set<string>()
  for (let i = 0; i < fps.length; i += BATCH) {
    const rows = await prisma.$queryRawUnsafe<Row[]>(
      `SELECT "id", "title", "socCode", "targetFunction", "subFunction", "crawlerFingerprint" AS key
       FROM "ExclusiveJobPosting" WHERE "archivedAt" IS NULL AND "crawlerFingerprint" = ANY($1::text[])`,
      fps.slice(i, i + BATCH)
    )
    matchedFp += rows.length
    for (const r of rows) seen.add(r.key)
    await relabel(rows, (r) => codeByFp.get(r.key))
    if ((i / BATCH) % 10 === 0) console.log(`fingerprints ${Math.min(i + BATCH, fps.length)}/${fps.length}: matched ${matchedFp}, changed ${changedIds.length} ${Math.round((Date.now() - t0) / 1000)}s`)
  }
  // 2. By url, for moved jobs no live row carries the fingerprint of (older rows without one).
  const urls = moved.filter((m) => !seen.has(m[0]) && m[1]).map((m) => m[1])
  for (let i = 0; i < urls.length; i += BATCH) {
    const rows = await prisma.$queryRawUnsafe<Row[]>(
      `SELECT "id", "title", "socCode", "targetFunction", "subFunction", "url" AS key
       FROM "ExclusiveJobPosting" WHERE "archivedAt" IS NULL AND "crawlerFingerprint" IS NULL AND "url" = ANY($1::text[])`,
      urls.slice(i, i + BATCH)
    )
    matchedUrl += rows.length
    await relabel(rows, (r) => codeByUrl.get(r.key))
  }

  console.log(`live rows matched: by fingerprint ${matchedFp}, by url ${matchedUrl}; ${changedIds.length} change${dryRun ? ' (dry run, nothing written)' : `, ${written} written`}`)
  for (const [k, v] of [...moves.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30)) console.log(`  ${k}: ${v}`)
  writeFileSync(outFile, JSON.stringify(changedIds))
  console.log(`changed posting ids -> ${outFile} (${Math.round((Date.now() - t0) / 1000)}s)`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
