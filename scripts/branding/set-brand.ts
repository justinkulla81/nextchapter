/**
 * Set an organization's colors by hand (OrgBrand source MANUAL). A scan never replaces a pair set this way unless run with --force.
 *
 *   tsx --conditions=react-server --env-file=.env.local scripts/branding/set-brand.ts --file scripts/branding/manual-employers.json [--apply]
 *   tsx --conditions=react-server --env-file=.env.local scripts/branding/set-brand.ts --employer "Acme Corp" --primary #123456 --secondary #abcdef [--apply]
 *
 * Employers are filed under the normalized company name (the key every page looks up). Dry run unless --apply.
 */
import { readFileSync } from 'node:fs'
import { prisma } from '../../src/lib/prisma'
import { normalizeHex } from '../../src/lib/branding/colors'
import { buildPair } from '../../src/lib/branding/scan'
import { employerBrandKey, saveOrgBrand } from '../../src/lib/branding/store'

const arg = (n: string) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : undefined }

async function main() {
  const apply = process.argv.includes('--apply')
  const rows: { name: string; primary: string; secondary: string }[] = []
  const file = arg('--file')
  if (file) rows.push(...(JSON.parse(readFileSync(file, 'utf8')).employers as typeof rows))
  if (arg('--employer')) rows.push({ name: arg('--employer')!, primary: arg('--primary') ?? '', secondary: arg('--secondary') ?? '' })
  if (rows.length === 0) { console.log('usage: set-brand.ts (--file f.json | --employer "Name" --primary #hex --secondary #hex) [--apply]'); return }
  for (const r of rows) {
    const primary = normalizeHex(r.primary), secondary = normalizeHex(r.secondary)
    const key = employerBrandKey(r.name)
    if (!primary || !secondary || !key) { console.log(`✗ ${r.name}: needs two #rrggbb colors`); continue }
    console.log(`${apply ? '✓' : '·'} ${r.name}  (${key})  ${primary} / ${secondary}`)
    if (apply) await saveOrgBrand({ kind: 'EMPLOYER', sourceId: key, siteUrl: null, pair: buildPair(primary, secondary), candidates: [], source: 'MANUAL' })
  }
  await prisma.$disconnect()
}

main().catch((e) => { console.error(e); process.exit(1) })
