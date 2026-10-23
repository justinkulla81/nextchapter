/**
 * Rebuilds src/lib/benefits/catalog.json from data/benefits/*.md, then applies
 * data/benefits/verification.json (the result of opening each program's own page).
 * The Benefits tab seeds the BenefitProgram table from that file and reseeds when it is newer,
 * so a catalog update is: edit the .md or verification.json, run this, commit.
 *   npx tsx scripts/benefits/build-catalog.ts
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseCatalog } from '../../src/lib/benefits/parse'
import type { BenefitCategory } from '../../src/lib/benefits/types'

const DIR = join(__dirname, '../../data/benefits')
function categoryFor(f: string): BenefitCategory | null {
  if (f === 'relocation.md' || /^city_.*\.md$/.test(f) || f === 'company_a.md' || f === 'company_c.md') return 'RELOCATION'
  if (f === 'company_b.md') return 'PRIVATE'
  if (f === 'state-training.md' || f === 'state_ai.md') return 'STATE_TRAINING'
  if (f === 'federal.md') return 'FEDERAL'
  if (f === 'courses.md') return 'COURSES'
  if (f === 'private.md') return 'PRIVATE'
  if (f === 'paid.md') return 'PAID'
  if (f === 'tax.md') return 'TAX'
  if (/^unemployed_.*\.md$/.test(f)) return 'SUPPORT'
  if (f === 'segments.md' || f === 'hiring_credits.md') return 'SEGMENT'
  return null
}
const cut = (s: string | null, n: number) => (s ? s.slice(0, n) : null)
const builtAt = new Date()

interface Check { id: string; verified?: boolean; status?: string; amount?: string; eligibility?: string; url?: string; note?: string }
const checks = new Map<string, Check>()
const vfile = join(DIR, 'verification.json')
if (existsSync(vfile)) for (const c of JSON.parse(readFileSync(vfile, 'utf8')) as Check[]) checks.set(c.id, c)

const rows = readdirSync(DIR).flatMap((f) => {
  const category = categoryFor(f)
  return category ? parseCatalog(readFileSync(join(DIR, f), 'utf8'), category, f, new Date('2026-10-22T00:00:00Z')) : []
})
// Notes the research files carried as rows (tax facts, 'not a relocation incentive', unchecked background): not programs.
const NOT_A_PROGRAM = /not a relocation incentive|payments are taxable|moving-expense|\(background|background, unchecked/i
const slim = rows.filter((r) => !NOT_A_PROGRAM.test(r.name)).map((r) => {
  const c = checks.get(r.id.slice(0, 120))
  const url = c?.url && /^https?:\/\//.test(c.url) ? c.url : r.url
  const officialUrl = !!url && !/makemymove\.com/.test(url)
  const verified = c ? !!c.verified && officialUrl : r.verified && officialUrl
  const status = c?.status && ['OPEN', 'ROLLING', 'CLOSED'].includes(c.status) ? (c.status as typeof r.status) : r.status
  return {
    ...r, id: r.id.slice(0, 120), name: r.name.slice(0, 140), provider: cut(r.provider, 90), locality: cut(r.locality, 60),
    amount: cut(c?.amount && c.verified ? c.amount : r.amount, 160), eligibility: cut(c?.eligibility && c.verified ? c.eligibility : r.eligibility, 200),
    statusNote: cut(c?.note ?? r.statusNote, 100), url: cut(url, 220), status, verified,
    checkedAt: verified ? (c ? builtAt.toISOString() : r.checkedAt ? r.checkedAt.toISOString() : null) : null,
  }
})
writeFileSync(join(__dirname, '../../src/lib/benefits/catalog.json'), JSON.stringify({ builtAt: builtAt.toISOString(), rows: slim }))
console.log(`${slim.length} programs, ${slim.filter((r) => r.verified).length} verified`)
