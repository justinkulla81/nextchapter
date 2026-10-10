// Loads the per-employer offered-wage summaries (see ~/nextchapter-jobs/lca-wages.py) into
// OfferedWageSummary, for companies already in the directory (exact normalised-name match
// only, never guessed). Re-runnable: rows upsert on (company, occupation).
//
//   node --env-file=.env.local --conditions=react-server --import tsx scripts/import-lca-wages.ts /path/to/lca-wages.csv [--dry-run]
import { readFileSync } from 'node:fs'
import { prisma } from '../src/lib/prisma'
import { normalizeOrgName } from '../src/lib/text/org-name-match'

function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++ }
      else if (c === '"') quoted = false
      else cell += c
    } else if (c === '"') quoted = true
    else if (c === ',') { row.push(cell); cell = '' }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = '' }
    else if (c !== '\r') cell += c
  }
  if (cell || row.length) { row.push(cell); rows.push(row) }
  return rows
}

async function main() {
  const file = process.argv[2]
  const dry = process.argv.includes('--dry-run')
  if (!file) throw new Error('usage: import-lca-wages.ts <csv> [--dry-run]')
  const [header, ...rows] = parseCsv(readFileSync(file, 'utf8'))
  const ix = Object.fromEntries(header.map((h, i) => [h, i]))

  const companies = await prisma.company.findMany({ select: { id: true, canonicalNameNormalized: true } })
  const byKey = new Map(companies.map((c) => [c.canonicalNameNormalized, c.id]))

  let linked = 0
  let written = 0
  const companiesHit = new Set<string>()
  for (const r of rows) {
    if (r.length < header.length) continue
    const companyId = byKey.get(normalizeOrgName(r[ix.employer_name]))
    if (!companyId) continue
    linked++
    companiesHit.add(companyId)
    if (dry) continue
    const data = {
      employerName: r[ix.employer_name],
      socTitle: r[ix.soc_title],
      filings: Number(r[ix.filings]),
      wageP25: Number(r[ix.wage_p25]),
      wageMedian: Number(r[ix.wage_median]),
      wageP75: Number(r[ix.wage_p75]),
      topWageLevel: r[ix.top_level] || null,
      topState: r[ix.top_state] || null,
      latestDecision: new Date(r[ix.latest_decision]),
    }
    await prisma.offeredWageSummary.upsert({
      where: { companyId_socCode_source: { companyId, socCode: r[ix.soc_code], source: 'DOL_LCA' } },
      create: { companyId, socCode: r[ix.soc_code], source: 'DOL_LCA', ...data },
      update: data,
    })
    written++
  }
  console.log(`${rows.length} summaries read; ${linked} match a directory company (${companiesHit.size} companies); ${dry ? 'dry run, nothing written' : `${written} written`}`)
}

main().finally(() => prisma.$disconnect())
