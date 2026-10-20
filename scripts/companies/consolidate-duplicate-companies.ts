/**
 * Merges directory Company records that are the same company written two ways
 * ("Amazon", "Amazon.com"), using the same rules as the organization cleanup
 * (src/lib/crm/org-duplicates.ts). Groups the rules are unsure about go to review.json.
 *
 * DRY RUN BY DEFAULT.
 *   node --env-file=.env.local --conditions=react-server --import tsx scripts/companies/consolidate-duplicate-companies.ts --out <dir> [--apply]
 *
 * With --apply every merge goes through mergeCompanies (postings, notices, signals,
 * intel and the CRM organization follow the survivor; the source name becomes an alias).
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { PrismaClient } from '@prisma/client'
import { looseKey } from '../../src/lib/crm/org-duplicates'
import { decideGroup, EXCLUDE, EXTRA_MERGES, NOT_DUPLICATES } from '../../src/lib/crm/org-duplicate-decisions'
import { suggestKeeper } from '../../src/lib/duplicates/suggest'
import { mergeCompanies } from '../../src/lib/companies/merge-company'

const prisma = new PrismaClient()
const APPLY = process.argv.includes('--apply')
const outIdx = process.argv.indexOf('--out')
const OUT = outIdx > 0 ? process.argv[outIdx + 1] : './companies-out'

async function main() {
  mkdirSync(OUT, { recursive: true })
  const all = await prisma.$queryRaw<{ id: string; name: string; createdAt: Date; postings: number; notices: number; org: boolean; verified: boolean }[]>`
    SELECT c.id, c.name, c."createdAt", c."isVerified" AS verified,
           (SELECT count(*)::int FROM "ExclusiveJobPosting" j WHERE j."companyId" = c.id)
             + (SELECT count(*)::int FROM "CompanyJobOpening" j WHERE j."companyId" = c.id) AS postings,
           (SELECT count(*)::int FROM "WarnNotice" w WHERE w."companyId" = c.id) AS notices,
           EXISTS (SELECT 1 FROM "CrmOrganization" o WHERE o."companyId" = c.id) AS org
      FROM "Company" c`
  console.log(`loaded ${all.length} companies`)
  const groups = new Map<string, typeof all>()
  for (const c of all.filter((x) => !EXCLUDE.has(x.name))) { const k = looseKey(c.name); if (k) groups.set(k, [...(groups.get(k) ?? []), c]) }

  // Named divisions folded into a parent (Amazon Music into Amazon), as in the organization cleanup.
  for (const [first, ...rest] of EXTRA_MERGES) {
    const k = looseKey(first)
    const g = groups.get(k)
    if (!g || !g.some((x) => x.name === first)) continue
    const extra = rest.flatMap((n) => all.filter((x) => x.name === n))
    groups.set(k, [...g, ...extra.filter((e) => !g.includes(e))])
    for (const e of extra) { const ek = looseKey(e.name); if (ek !== k) groups.set(ek, (groups.get(ek) ?? []).filter((x) => x !== e)) }
  }

  const merges: { key: string; keepId: string; keepName: string; mergeIds: string[]; names: string[]; reason: string }[] = []
  const review: { key: string; names: string[]; reason: string }[] = []
  for (const [key, g] of groups) {
    if (g.length < 2 || NOT_DUPLICATES.has(key)) continue
    const names = g.map((c) => c.name)
    const d = decideGroup(names)
    // A group that folds named divisions in is merged by hand-approved rule, whatever its names look like.
    const folded = EXTRA_MERGES.some(([first, ...rest]) => names.includes(first) && rest.some((n) => names.includes(n)))
    if (folded && d.action === 'review') { d.action = 'merge'; d.reason = 'Division folded into its parent by hand.' }
    if (d.action === 'review') { review.push({ key, names, reason: d.reason }); continue }
    const keeper = suggestKeeper(g.map((c) => ({ id: c.id, activity: c.postings + c.notices + (c.verified ? 5 : 0), linked: c.org, createdAt: c.createdAt })))
    const keep = g.find((c) => c.id === keeper.id)!
    merges.push({ key, keepId: keep.id, keepName: keep.name, mergeIds: g.filter((c) => c.id !== keep.id).map((c) => c.id), names, reason: d.reason })
  }
  const removable = merges.reduce((n, m) => n + m.mergeIds.length, 0)
  console.log(`groups: ${merges.length + review.length}  safe to merge: ${merges.length} (removes ${removable})  needs a person: ${review.length}`)
  writeFileSync(`${OUT}/plan.json`, JSON.stringify(merges, null, 2))
  writeFileSync(`${OUT}/review.json`, JSON.stringify(review, null, 2))
  if (!APPLY) return console.log('dry run: nothing written to the database')

  const log: unknown[] = []
  let done = 0
  for (const m of merges) {
    for (const id of m.mergeIds) {
      const r = await mergeCompanies(m.keepId, id, 'consolidate-duplicate-companies').catch((e: Error) => ({ ok: false as const, reason: e.message.split('\n').slice(-1)[0] }))
      log.push({ key: m.key, keepId: m.keepId, sourceId: id, ...r })
      if (r.ok) done++; else console.log(`  not merged: ${m.names.join(' / ')}: ${r.reason}`)
      writeFileSync(`${OUT}/merge-log.json`, JSON.stringify(log, null, 2))
    }
  }
  console.log(`merged ${done}`)
}
main().finally(() => prisma.$disconnect())
