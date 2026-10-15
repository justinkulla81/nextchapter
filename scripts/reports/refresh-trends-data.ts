/**
 * Monthly refresh of src/lib/market/occupation-trends-data.ts from the
 * replication repository's data. Run after the new edition's data is built:
 *
 *   npm run report:refresh-trends -- --edition "October 2026" --version 1.8 \
 *     --csr-margin 111 [--data ~/nextchapter-displacement-report/data] [--url <report url>]
 *
 * Writes the file; review the diff, run the tests, commit. Never edits by hand.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { buildOccupationTrendsFile, type ExposureRow } from '../../src/lib/market/occupation-trends-build'

function arg(name: string, fallback?: string): string {
  const i = process.argv.indexOf(`--${name}`)
  const v = i >= 0 ? process.argv[i + 1] : fallback
  if (!v) throw new Error(`Missing --${name}`)
  return v
}

const dataDir = arg('data', path.join(os.homedir(), 'nextchapter-displacement-report', 'data'))
const exposure = JSON.parse(fs.readFileSync(path.join(dataDir, 'exposure_test_results.json'), 'utf8')) as { rows: ExposureRow[] }
const occ = JSON.parse(fs.readFileSync(path.join(dataDir, 'cps_occupation_groups_exposure_2019_2022_2025_2026.json'), 'utf8')) as {
  csr: Record<string, number[]>
}

// csr rows are [LF, employment, unemployed, long-term, respondents, young] in thousands.
const csr2025 = occ.csr['2025']?.[1]
const csr2026 = occ.csr['2026']?.[1]
if (!csr2025 || !csr2026) throw new Error('Customer service series missing from the occupation data file')

const out = buildOccupationTrendsFile(exposure.rows, {
  edition: arg('edition'),
  version: arg('version'),
  url: arg('url', 'https://launchyournextchapter.com/reports/white-collar-employment-report-september-2026'),
  csrEmployment: { y2025: csr2025, y2026: csr2026 },
  csrMarginThousands: Number(arg('csr-margin')),
})

const target = path.join(process.cwd(), 'src/lib/market/occupation-trends-data.ts')
fs.writeFileSync(target, out)
console.log(`Wrote ${target} (${exposure.rows.length} occupation groups). Review the diff and run the tests.`)
