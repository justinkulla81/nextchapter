/**
 * Merges CRM organizations that are the same company written two ways
 * ("Amazon", "Amazon.com", "Amazon - SF019"), using the rules in
 * src/lib/crm/org-duplicates.ts.
 *
 * DRY RUN BY DEFAULT. Writes a report either way.
 *
 *   node --env-file=.env.local --conditions=react-server --import tsx scripts/crm/consolidate-duplicate-orgs.ts --out <dir>
 *   ... --apply            merge every group the rules call safe
 *
 * Groups the rules are unsure about are never merged; they are listed in
 * review.json for a person to decide. With --apply the rows about to be deleted
 * are saved to <dir>/backup-orgs.json first, and every merge is logged in
 * <dir>/merge-log.json.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { PrismaClient } from '@prisma/client'
import { cleanestName, looseKey, websiteMatchesName } from '../../src/lib/crm/org-duplicates'
import { decideGroup, EXCLUDE, EXTRA_MERGES, FOLD_PREFIXES, NOT_DUPLICATES } from '../../src/lib/crm/org-duplicate-decisions'
import { suggestKeeper } from '../../src/lib/duplicates/suggest'
import { mergeOrganizations } from '../../src/lib/crm/merge-organization'

const prisma = new PrismaClient()
const APPLY = process.argv.includes('--apply')
const outIdx = process.argv.indexOf('--out')
const OUT = outIdx > 0 ? process.argv[outIdx + 1] : './consolidate-out'

/** Retries a call when the database connection drops (Prisma P1017 / P1001), which the pooler does now and then. */
async function retry<T>(fn: () => Promise<T>, tries = 5): Promise<T> {
  for (let i = 1; ; i++) {
    try { return await fn() } catch (e) {
      const code = (e as { code?: string }).code
      if (i >= tries || (code !== 'P1017' && code !== 'P1001' && code !== 'P2024')) throw e
      console.log(`  connection dropped (${code}), retry ${i}/${tries - 1}`)
      await prisma.$disconnect().catch(() => {})
      await new Promise((r) => setTimeout(r, 1500 * i))
    }
  }
}

async function main() {
  mkdirSync(OUT, { recursive: true })
  const all = await retry(() => prisma.crmOrganization.findMany({
    select: {
      id: true, name: true, website: true, canonicalNameNormalized: true, companyId: true, hiringClient: true, createdAt: true, orgTypes: true,
      _count: { select: { affiliations: true, opportunities: true, mandates: true } },
    },
  }))
  console.log(`loaded ${all.length} organizations`)

  const groups = new Map<string, typeof all>()
  for (const o of all) {
    const k = looseKey(o.name)
    if (!k) continue
    groups.set(k, [...(groups.get(k) ?? []), o])
  }
  for (const { parent, prefix } of FOLD_PREFIXES) {
    if (all.some((o) => o.name === parent)) EXTRA_MERGES.push([parent, ...all.filter((o) => o.name.startsWith(prefix)).map((o) => o.name)])
  }
  for (const [first, ...rest] of EXTRA_MERGES) {
    const k = looseKey(first)
    const extra = rest.flatMap((n) => all.filter((o) => o.name === n))
    const g = groups.get(k)
    if (g) groups.set(k, [...g, ...extra.filter((e) => !g.includes(e))])
    for (const e of extra) { const ek = looseKey(e.name); if (ek !== k) groups.set(ek, (groups.get(ek) ?? []).filter((o) => o !== e)) }
  }
  for (const [k, g] of groups) groups.set(k, g.filter((o) => !EXCLUDE.has(o.name)))
  const dupes = [...groups.entries()].filter(([k, g]) => g.length > 1 && !NOT_DUPLICATES.has(k))

  type Plan = { key: string; keepId: string; keepName: string; finalName: string; mergeIds: string[]; names: string[]; reason: string }
  const merges: Plan[] = []
  const review: { key: string; names: string[]; reason: string }[] = []
  for (const [key, g] of dupes) {
    const names = g.map((o) => o.name)
    const d = decideGroup(names, g.some((o) => names.some((n) => websiteMatchesName(o.website, n))))
    if (d.action === 'review') { review.push({ key, names, reason: d.reason }); continue }
    const weight = (o: (typeof g)[number]) => o._count.affiliations + o._count.opportunities + o._count.mandates
    const keeper = suggestKeeper(g.map((o) => ({ id: o.id, activity: weight(o) + (o.hiringClient ? 5 : 0), linked: Boolean(o.companyId), createdAt: o.createdAt })))
    const keep = g.find((o) => o.id === keeper.id)!
    merges.push({ key, keepId: keep.id, keepName: keep.name, finalName: cleanestName(names), mergeIds: g.filter((o) => o.id !== keep.id).map((o) => o.id), names, reason: d.reason })
  }
  const removable = merges.reduce((n, m) => n + m.mergeIds.length, 0)
  console.log(`groups: ${dupes.length}  safe to merge: ${merges.length} (removes ${removable})  needs a person: ${review.length}`)
  writeFileSync(`${OUT}/plan.json`, JSON.stringify(merges, null, 2))
  writeFileSync(`${OUT}/review.json`, JSON.stringify(review, null, 2))
  if (!APPLY) { console.log('dry run: nothing written to the database'); return }

  const byId = new Map(all.map((o) => [o.id, o]))
  writeFileSync(`${OUT}/backup-orgs.json`, JSON.stringify(merges.flatMap((m) => m.mergeIds.map((id) => byId.get(id))), null, 2))

  const log: unknown[] = []
  let done = 0, refused = 0
  for (const m of merges) {
    for (const id of m.mergeIds) {
      // One bad group must not stop the run: log the error and move on (a failed merge rolls back whole).
      const r = await retry(() => mergeOrganizations(m.keepId, id, 'consolidate-duplicate-orgs'))
        .catch((e: Error) => ({ ok: false as const, reason: `error: ${String(e.message).split('\n').filter(Boolean).slice(-2).join(' ')}` }))
      log.push({ key: m.key, keepId: m.keepId, sourceId: id, sourceName: byId.get(id)?.name, ...r })
      if (r.ok) done++
      else { refused++; console.log(`  not merged: ${byId.get(id)?.name} -> ${m.keepName}: ${r.reason}`) }
      writeFileSync(`${OUT}/merge-log.json`, JSON.stringify(log, null, 2))
    }
    // Write the cleanest spelling onto the survivor when it differs and the key is free.
    if (m.finalName !== m.keepName) {
      const { normalizeOrgName } = await import('../../src/lib/text/org-name-match')
      const key = normalizeOrgName(m.finalName)
      const taken = await prisma.crmOrganization.findUnique({ where: { canonicalNameNormalized: key }, select: { id: true } })
      if (!taken || taken.id === m.keepId) {
        await prisma.crmOrganization.update({ where: { id: m.keepId }, data: { name: m.finalName, canonicalNameNormalized: key } }).catch((e) => console.log(`  rename failed for ${m.finalName}: ${e.message}`))
      }
    }
    if (done % 50 === 0) console.log(`  ${done} merged`)
  }
  writeFileSync(`${OUT}/merge-log.json`, JSON.stringify(log, null, 2))
  console.log(`merged ${done}, refused ${refused}`)
}

main().finally(() => prisma.$disconnect())
