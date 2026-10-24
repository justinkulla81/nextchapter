// Monthly refresh of the early-warning data behind the report's early-warning
// section and https://launchyournextchapter.com/reports/early-warning.
//
//   node --env-file=.env.local scripts/employment-report/refresh-early-warning.mjs --edition 2026-10
//
// Writes a snapshot for the edition under public/reports/early-warning/<edition>/
// (so each published edition keeps the figures it was written with) and copies
// the files to public/reports/ as the "latest" downloads the standalone page links to.
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const i = process.argv.indexOf('--edition')
const edition = i > 0 ? process.argv[i + 1] : null
if (!edition || !/^\d{4}-\d{2}$/.test(edition)) {
  console.error('usage: refresh-early-warning.mjs --edition YYYY-MM')
  process.exit(1)
}
const root = process.cwd()
const reports = path.join(root, 'public', 'reports')
const snap = path.join(reports, 'early-warning', edition)
fs.mkdirSync(snap, { recursive: true })

const run = (cmd, args) => {
  console.log(`\n$ ${cmd} ${args.join(' ')}`)
  const r = spawnSync(cmd, args, { stdio: 'inherit', env: process.env })
  if (r.status !== 0) {
    console.error(`Step failed (${cmd} ${args[0]}); nothing was copied to the latest files.`)
    process.exit(r.status ?? 1)
  }
}

const [y, m] = edition.split('-').map(Number)
// The CPS file for the edition month is published a few weeks after the month ends,
// so the U.S. series runs through the edition month and stops where data stops.
run('python3', ['scripts/employment-report/nc_early_warning_us.py', '--start', '2010-01', '--end', `${y}-${String(m).padStart(2, '0')}`, '--out', path.join(snap, 'us-early-warning.csv')])
run('python3', ['scripts/employment-report/nc_peer_countries.py', '--out', path.join(snap, 'early-warning-peers.json')])
run('npx', ['tsx', '--env-file=.env.local', 'scripts/employment-report/ai-layoffs-monthly.ts', '--edition', edition])

for (const f of ['us-early-warning.csv', 'early-warning-peers.json', 'ai-layoffs-monthly.csv', 'ai-layoffs-events.csv']) {
  const src = path.join(snap, f)
  if (fs.existsSync(src)) fs.copyFileSync(src, path.join(reports, f))
}
console.log(`\nEarly-warning snapshot written to ${path.relative(root, snap)} and copied to public/reports/.`)
