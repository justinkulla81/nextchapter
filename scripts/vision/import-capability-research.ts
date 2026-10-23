/**
 * Turns research files in data/competitor-matrix/*.json into one SQL file of upserts. It never touches a database.
 *
 *   npx tsx scripts/vision/import-capability-research.ts                      validate all files, write the SQL
 *   npx tsx scripts/vision/import-capability-research.ts --out path.sql       choose the output file
 *   npx tsx scripts/vision/import-capability-research.ts --no-catalog         leave out the ProductCapability upserts
 *   npx tsx scripts/vision/import-capability-research.ts --check              validate only
 *
 * File shape: { "competitor": "<ProductCompetitor.name>", "cells": [{ "capabilityKey", "status", "note", "evidenceUrl", "checkedAt" }] }
 * Files whose name starts with "_" (the sample) are skipped unless --include-samples is passed.
 * Exit code 1 when any file fails validation; nothing is written in that case.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { validateImport, catalogSql, cellsSql } from '../../src/lib/vision/capability-import'

const args = process.argv.slice(2)
const flag = (n: string) => args.includes(n)
const outIdx = args.indexOf('--out')
const dir = join(process.cwd(), 'data', 'competitor-matrix')
const stamp = new Date().toISOString().slice(0, 10)
const out = outIdx >= 0 ? args[outIdx + 1] : join(dir, `import-${stamp}.sql`)

const files = readdirSync(dir).filter((f) => f.endsWith('.json') && (flag('--include-samples') || !f.startsWith('_'))).sort()
const parts: string[] = []
const errors: string[] = []
let cells = 0
for (const f of files) {
  let json: unknown
  try { json = JSON.parse(readFileSync(join(dir, f), 'utf8')) } catch (e) { errors.push(`${f}: not valid JSON (${(e as Error).message})`); continue }
  const r = validateImport(json, f)
  if (!r.ok || !r.file) { errors.push(...r.errors); continue }
  cells += r.file.cells.length
  parts.push(cellsSql(r.file))
}
if (errors.length) {
  console.error(`${errors.length} problem(s):\n` + errors.map((e) => '  ' + e).join('\n'))
  process.exit(1)
}
if (flag('--check')) { console.log(`${files.length} file(s), ${cells} cell(s): all valid.`); process.exit(0) }
const header = `-- Generated ${stamp} by scripts/vision/import-capability-research.ts. Review, then apply by hand. Idempotent.\n-- Needs prisma/manual/2026-10-23-capability-matrix.sql applied first.\nBEGIN;`
writeFileSync(out, [header, flag('--no-catalog') ? '' : catalogSql(), ...parts, 'COMMIT;', ''].join('\n'))
console.log(`Wrote ${out}: ${files.length} file(s), ${cells} cell(s). Not executed.`)
