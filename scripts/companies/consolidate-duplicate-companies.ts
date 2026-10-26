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
// --safe-only keeps just the merges whose names match apart from spacing, punctuation, a legal suffix or a web address, plus
// the hand-confirmed ones. The "US suffix, site code, abbreviation" rule also pairs different counties and cities that share a
// name ('Jefferson County' and 'Jefferson County (TX)'), so those groups go to the review file instead.
const SAFE_ONLY = process.argv.includes('--safe-only')
// --max N merges at most N companies this run, with a pause between merges, so a run can go in small batches while the
// database is busy. A merge that fails only because the connection pool is busy is retried after a wait.
const maxIdx = process.argv.indexOf('--max')
const MAX_MERGES = maxIdx > 0 ? Number(process.argv[maxIdx + 1]) : Infinity
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const poolBusy = (m: string) => /connection pool|statement timeout|Timed out fetching/i.test(m)
const SAFE_REASONS = [/^Same name apart from spacing, punctuation or a legal suffix\./, /^Same name with a web address on the end\./, /^Confirmed by hand\./, /^Division folded into its parent by hand\./]
const outIdx = process.argv.indexOf('--out')
const OUT = outIdx > 0 ? process.argv[outIdx + 1] : './companies-out'

async function main() {
  mkdirSync(OUT, { recursive: true })
  // Counts per company are read afterwards, only for companies that share a name key with another: the per-row
  // subqueries over every company and posting time out at the current table size.
  type Row = { id: string; name: string; createdAt: Date; postings: number; notices: number; org: boolean; verified: boolean }
  const all: Row[] = (await prisma.$queryRaw<{ id: string; name: string; createdAt: Date; org: boolean; verified: boolean }[]>`
    SELECT c.id, c.name, c."createdAt", c."isVerified" AS verified,
           EXISTS (SELECT 1 FROM "CrmOrganization" o WHERE o."companyId" = c.id) AS org
      FROM "Company" c`).map((r) => ({ ...r, postings: 0, notices: 0 }))
  console.log(`loaded ${all.length} companies`)
  const groups = new Map<string, typeof all>()
  for (const c of all.filter((x) => !EXCLUDE.has(x.name))) { const k = looseKey(c.name); if (k) groups.set(k, [...(groups.get(k) ?? []), c]) }

  const shared = new Set<string>()
  for (const g of groups.values()) if (g.length > 1) for (const c of g) shared.add(c.id)
  for (const [first, ...rest] of EXTRA_MERGES) for (const n of [first, ...rest]) for (const c of all) if (c.name === n) shared.add(c.id)
  const ids = [...shared]
  console.log(`companies sharing a name key: ${ids.length}`)
  const byId = new Map(all.map((c) => [c.id, c]))
  for (let i = 0; i < ids.length; i += 200) {
    const part = ids.slice(i, i + 200)
    const counts = await prisma.$queryRaw<{ id: string; postings: number; notices: number }[]>`
      SELECT c.id,
             (SELECT count(*)::int FROM "ExclusiveJobPosting" j WHERE j."companyId" = c.id)
               + (SELECT count(*)::int FROM "CompanyJobOpening" j WHERE j."companyId" = c.id) AS postings,
             (SELECT count(*)::int FROM "WarnNotice" w WHERE w."companyId" = c.id) AS notices
        FROM "Company" c WHERE c.id = ANY(${part})`
    for (const r of counts) { const c = byId.get(r.id); if (c) { c.postings = r.postings; c.notices = r.notices } }
  }

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
    if (SAFE_ONLY && !SAFE_REASONS.some((re) => re.test(d.reason))) { review.push({ key, names, reason: `Held by --safe-only: ${d.reason}` }); continue }
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
      if (done >= MAX_MERGES) break
      let r: Awaited<ReturnType<typeof mergeCompanies>> = { ok: false, reason: 'not run' }
      for (let attempt = 0; attempt < 3; attempt++) {
        r = await mergeCompanies(m.keepId, id, 'consolidate-duplicate-companies').catch((e: Error) => ({ ok: false as const, reason: e.message.split('\n').slice(-1)[0] }))
        if (r.ok || !poolBusy(r.reason)) break
        await sleep(20_000 * (attempt + 1))
      }
      await sleep(2_000)
      log.push({ key: m.key, keepId: m.keepId, sourceId: id, ...r })
      if (r.ok) done++; else console.log(`  not merged: ${m.names.join(' / ')}: ${r.reason}`)
      writeFileSync(`${OUT}/merge-log.json`, JSON.stringify(log, null, 2))
    }
  }
  console.log(`merged ${done}`)
}
main().finally(() => prisma.$disconnect())
