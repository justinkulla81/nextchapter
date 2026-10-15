/**
 * Flags figures stored in code that the latest report edition no longer
 * contains. Run each month after the new edition's PDF is built:
 *
 *   npm run report:check-facts -- [public/reports/displacement-report-2026-09.pdf]
 *
 * Exit code 1 when any stored figure is not found, so it can gate a refresh.
 * "Not found" means look at it: the figure may be rounded or reworded in the
 * new edition, or it may be stale.
 */
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { FIXED_FACTS } from '../../src/lib/pitch/report-facts'
import { LONGER_SEARCH_FIGURES } from '../../src/lib/marketing/longer-search-message'
import { checkFacts, type FactToCheck } from '../../src/lib/reports/fact-check'

const pdf = process.argv[2] ?? 'public/reports/displacement-report-2026-09.pdf'
const text = execFileSync('pdftotext', ['-layout', path.resolve(pdf), '-'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })

const facts: FactToCheck[] = []
for (const [slide, list] of Object.entries(FIXED_FACTS)) {
  for (const f of list) facts.push({ source: `pitch ${slide}`, label: f.label, value: f.value })
}
for (const f of LONGER_SEARCH_FIGURES) facts.push({ source: 'marketing longer-search', label: f.label, value: f.value })

const r = checkFacts(facts, text)
console.log(`Checked ${facts.length} stored figures against ${pdf}`)
console.log(`  found: ${r.found.length}   missing: ${r.missing.length}   not numeric: ${r.unchecked.length}`)
for (const m of r.missing) console.log(`  MISSING  ${m.value.padEnd(10)} ${m.source}: ${m.label}`)
process.exit(r.missing.length ? 1 : 0)
