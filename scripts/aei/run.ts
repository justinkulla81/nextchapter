// Monthly Anthropic Economic Index (AEI) section: stores this month's exposure
// vintage, matches it to the postings we see open, cross-checks it against other
// published measures, and writes the exhibits as CSV plus a summary.
//
//   npm run aei:report -- [--asof 2026-10-31] [--exposure-file path.csv]
//        [--microsoft-file ms.csv] [--openai-file oa.csv] [--no-crosscheck]
//
// Reads CompanyJobOpening (read only). Writes only under data/aei/. See docs/AEI_SECTION.md
// for how the section is worded and what it must not claim.
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { prisma } from '../../src/lib/prisma'
import { compareVintages, parseExposureCsv, type ExposureRow } from '../../src/lib/aei/exposure'
import { buildTitleIndex } from '../../src/lib/aei/match'
import { buildExhibits, matchPostings, matchSample, MIN_CELL, type PostingInput } from '../../src/lib/aei/aggregate'
import { compareMeasures, scoresFromCsv } from '../../src/lib/aei/crosscheck'

const HF = 'https://huggingface.co/datasets/Anthropic/EconomicIndex/resolve/main/labor_market_impacts/job_exposure.csv'
const MS = 'https://raw.githubusercontent.com/microsoft/working-with-ai/main/ai_applicability_scores.csv'
const OPENAI = 'https://raw.githubusercontent.com/openai/GPTs-are-GPTs/main/data/occ_level.csv'
const DATA = path.join(process.cwd(), 'data', 'aei')

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}
const flag = (name: string) => process.argv.includes(`--${name}`)

async function text(url: string): Promise<string> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${res.status} fetching ${url}`)
  return res.text()
}

function csvOf(rows: Record<string, string | number | null>[]): string {
  if (rows.length === 0) return ''
  const cols = Object.keys(rows[0])
  const cell = (v: string | number | null) => {
    const s = v === null ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [cols.join(','), ...rows.map((r) => cols.map((c) => cell(r[c])).join(','))].join('\n') + '\n'
}

async function loadPostings(asOf: Date): Promise<PostingInput[]> {
  const from = new Date(asOf.getTime() - 61 * 86_400_000)
  const out: PostingInput[] = []
  let cursor: string | undefined
  for (;;) {
    const batch = await prisma.companyJobOpening.findMany({
      where: { firstSeenAt: { lte: asOf }, OR: [{ closedAt: null }, { closedAt: { gt: from } }] },
      select: { id: true, title: true, function: true, firstSeenAt: true, closedAt: true },
      orderBy: { id: 'asc' },
      take: 20_000,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    })
    if (batch.length === 0) break
    for (const b of batch) out.push({ title: b.title, fn: b.function, firstSeenAt: b.firstSeenAt, closedAt: b.closedAt })
    cursor = batch[batch.length - 1].id
  }
  return out
}

async function main() {
  const asOf = new Date(`${arg('asof') ?? new Date().toISOString().slice(0, 10)}T23:59:59Z`)
  const month = asOf.toISOString().slice(0, 7)
  mkdirSync(path.join(DATA, 'vintages'), { recursive: true })
  const outDir = path.join(DATA, `report-${month}`)
  mkdirSync(outDir, { recursive: true })

  // 1. Exposure vintage: store it, with a hash, so next month can show real changes.
  const exposureCsv = arg('exposure-file') ? readFileSync(arg('exposure-file')!, 'utf8') : await text(HF)
  const rows = parseExposureCsv(exposureCsv)
  const hash = createHash('sha256').update(exposureCsv).digest('hex')
  const manifestPath = path.join(DATA, 'manifest.json')
  const manifest: { vintages: { file: string; sha256: string; retrievedAt: string; rows: number; source: string }[] } =
    existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : { vintages: [] }
  const known = manifest.vintages.find((v) => v.sha256 === hash)
  let vintageFile = known?.file
  if (!known) {
    vintageFile = `vintages/exposure-${new Date().toISOString().slice(0, 10)}.csv`
    writeFileSync(path.join(DATA, vintageFile), exposureCsv)
    manifest.vintages.push({ file: vintageFile, sha256: hash, retrievedAt: new Date().toISOString(), rows: rows.length, source: HF })
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n')
  }

  // 2. Change since the previous stored vintage.
  const previous = manifest.vintages.filter((v) => v.sha256 !== hash).at(-1)
  let previousRows: ExposureRow[] | null = null
  if (previous && existsSync(path.join(DATA, previous.file))) previousRows = parseExposureCsv(readFileSync(path.join(DATA, previous.file), 'utf8'))
  const comparison = previousRows ? compareVintages(previousRows, rows) : null
  writeFileSync(
    path.join(outDir, 'movers.csv'),
    comparison ? csvOf(comparison.movers.map((m) => ({ ...m }))) : 'note\nFirst stored vintage: no earlier version to compare.\n',
  )

  // 3. Match to postings and build the exhibits.
  const postings = await loadPostings(asOf)
  const matched = matchPostings(postings, buildTitleIndex(rows))
  const ex = buildExhibits(matched, asOf)
  writeFileSync(path.join(outDir, 'exhibit-a-bands.csv'), csvOf(ex.byBand.map((b) => ({ ...b, shareOfMatched: Math.round(b.shareOfMatched * 1000) / 10 }))))
  writeFileSync(path.join(outDir, 'exhibit-b-occupations.csv'), csvOf(ex.topOccupations.map((o) => ({ ...o }))))
  writeFileSync(path.join(outDir, 'exhibit-c-functions.csv'), csvOf(ex.byFunction.map((f) => ({ ...f }))))
  writeFileSync(path.join(outDir, 'match-sample-for-hand-check.csv'), csvOf(matchSample(matched)))

  // 4. Cross-check against other published measures.
  const lines: string[] = []
  if (!flag('no-crosscheck')) {
    const aei = new Map(rows.map((r) => [r.socCode, r.exposure]))
    const ms = scoresFromCsv(arg('microsoft-file') ? readFileSync(arg('microsoft-file')!, 'utf8') : await text(MS), 'SOC Code', 'ai_applicability_score')
    const oa = scoresFromCsv(arg('openai-file') ? readFileSync(arg('openai-file')!, 'utf8') : await text(OPENAI), 'O*NET-SOC Code', 'dv_rating_beta', true)
    const a = compareMeasures(aei, ms)
    const b = compareMeasures(aei, oa)
    writeFileSync(path.join(outDir, 'crosscheck.csv'), csvOf([
      { comparison: 'AEI vs Microsoft applicability', occupations: a.n, spearman: a.spearman },
      { comparison: 'AEI vs OpenAI GPTs-are-GPTs (beta)', occupations: b.n, spearman: b.spearman },
    ]))
    lines.push(`Cross-check (rank correlation across shared occupations): Microsoft ${a.spearman} (n=${a.n}); OpenAI ${b.spearman} (n=${b.n}).`)
  }

  const pct = (x: number) => `${Math.round(x * 1000) / 10}%`
  writeFileSync(path.join(outDir, 'summary.md'), [
    `# AEI section data, as of ${ex.asOf}`,
    '',
    `Exposure vintage: ${vintageFile} (sha256 ${hash.slice(0, 12)}, ${rows.length} occupations).`,
    comparison ? `Change since previous vintage: ${comparison.movers.length} movers listed, ${comparison.added.length} added, ${comparison.removed.length} removed.` : 'First stored vintage: no change to report yet.',
    `Open postings: ${ex.coverage.open}. Matched to an occupation: ${ex.coverage.matchedOpen} (${pct(ex.coverage.share)}). Unmatched postings are not forced into an occupation.`,
    `Cells under ${MIN_CELL} open postings are suppressed. Counts are postings we crawl, not all U.S. openings.`,
    ...lines,
    '',
    'Hand check required before publishing: review match-sample-for-hand-check.csv and record the error rate in the report.',
  ].join('\n') + '\n')
  console.log(`Wrote ${outDir}`)
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
