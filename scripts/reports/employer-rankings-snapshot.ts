// Monthly employment and jobs report: the employer rankings as of today, written as JSON (for the record) and
// Markdown tables (to paste into the report). Same queries as https://launchyournextchapter.com/top-employers.
//
//   NODE_OPTIONS=--conditions=react-server npx tsx scripts/reports/employer-rankings-snapshot.ts [outDir]
//
// Default outDir is ./employer-rankings-<yyyy-mm>. Nothing is written to the database.
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { buildEmployerRankings, buildFunctionRankings, type RankedEmployer } from '@/lib/seo/employer-rankings'

const table = (rows: RankedEmployer[], cols: { head: string; get: (e: RankedEmployer) => string }[]) =>
  ['| # | Employer | ' + cols.map((c) => c.head).join(' | ') + ' |', '|---|---|' + cols.map(() => '---:').join('|') + '|']
    .concat(rows.map((e, i) => `| ${i + 1} | ${e.name} | ${cols.map((c) => c.get(e)).join(' | ')} |`))
    .join('\n')
const n = (x: number) => x.toLocaleString('en-US')

async function main() {
  const [r, fns] = await Promise.all([buildEmployerRankings(), buildFunctionRankings()])
  const month = r.asOf.slice(0, 7)
  const out = process.argv[2] ?? `employer-rankings-${month}`
  mkdirSync(out, { recursive: true })
  writeFileSync(path.join(out, 'rankings.json'), JSON.stringify({ ...r, functions: fns }, null, 2))
  const md = [
    `# Employer rankings, ${month}`,
    `${n(r.totalOpen)} verified open jobs; ${n(r.totalEntry)} entry-level or early-career. Staffing and search firms excluded.`,
    '## Most entry-level jobs', table(r.entry, [{ head: 'Entry-level', get: (e) => n(e.entry) }, { head: 'Open', get: (e) => n(e.open) }]),
    '## Most jobs needing no experience', table(r.noExp, [{ head: 'No experience', get: (e) => n(e.noExp) }, { head: 'Entry-level', get: (e) => n(e.entry) }]),
    '## Highest share asking for AI skills', table(r.aiShare, [{ head: 'Share', get: (e) => `${Math.round(e.aiShare * 100)}%` }, { head: 'AI jobs', get: (e) => n(e.aiSkill) }, { head: 'Open', get: (e) => n(e.open) }]),
    '## Layoffs tied to AI in the news (outlets that ran a headline)',
    r.aiLayoffs.map((l, i) => `${i + 1}. ${l.name}: ${l.outlets} outlets. "${l.latest.headline}" (${l.latest.publisher ?? 'source'})`).join('\n'),
    ...fns.flatMap((f) => [`## ${f.function}: most open jobs (${n(f.open)} total)`, table(f.employers, [{ head: 'Open', get: (e) => n(e.open) }, { head: 'Entry-level', get: (e) => n(e.entry) }])]),
  ].join('\n\n')
  writeFileSync(path.join(out, 'rankings.md'), md + '\n')
  console.log(`Wrote ${out}/rankings.json and rankings.md`)
}
main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1) })
