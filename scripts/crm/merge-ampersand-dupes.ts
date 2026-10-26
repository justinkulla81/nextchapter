/**
 * Merges CRM organizations whose claim-page address (/prepared/<slug>) is the same because one spelling uses "&"
 * and the other "and" ("Texas A&M International University" / "Texas A & M International University"). The claim
 * page resolver (src/lib/org-claims/org.ts) refuses an address two records share, so both pages 404.
 *
 * DRY RUN BY DEFAULT.
 *
 *   node --env-file=.env.local --conditions=react-server --import tsx scripts/crm/merge-ampersand-dupes.ts --out <dir>
 *   ... --apply     back up both records of every safe pair to <dir>/backup-orgs.json, then merge
 *
 * A pair is merged only when the two records agree on everything they both fill in (email domain, website host,
 * state, city, linked company). Anything else goes to <dir>/review.json for a person; nothing is guessed.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { PrismaClient } from '@prisma/client'
import { claimSlug } from '../../src/lib/org-claims/urls'
import { cleanestName } from '../../src/lib/crm/org-duplicates'
import { suggestKeeper } from '../../src/lib/duplicates/suggest'
import { mergeOrganizations } from '../../src/lib/crm/merge-organization'
import { normalizeOrgName } from '../../src/lib/text/org-name-match'

const prisma = new PrismaClient()
const APPLY = process.argv.includes('--apply')
const outIdx = process.argv.indexOf('--out')
const OUT = outIdx > 0 ? process.argv[outIdx + 1] : './merge-ampersand-out'

async function retry<T>(fn: () => Promise<T>, tries = 5): Promise<T> {
  for (let i = 1; ; i++) {
    try { return await fn() } catch (e) {
      const code = (e as { code?: string }).code
      if (i >= tries || (code !== 'P1017' && code !== 'P1001' && code !== 'P2024')) throw e
      await prisma.$disconnect().catch(() => {})
      await new Promise((r) => setTimeout(r, 1500 * i))
    }
  }
}

const host = (w: string | null) => (w ? w.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '') : null)
const differs = (a: string | null, b: string | null) => !!a && !!b && a.toLowerCase().trim() !== b.toLowerCase().trim()

async function main() {
  mkdirSync(OUT, { recursive: true })
  const all = await retry(() => prisma.crmOrganization.findMany({
    select: {
      id: true, name: true, canonicalNameNormalized: true, website: true, emailDomain: true, usState: true, hqCity: true,
      companyId: true, hiringClient: true, createdAt: true, orgTypes: true,
      _count: { select: { affiliations: true, opportunities: true, mandates: true, activities: true, tasks: true } },
    },
  }))
  const bySlug = new Map<string, typeof all>()
  for (const o of all) {
    const s = claimSlug(o.canonicalNameNormalized)
    if (s) bySlug.set(s, [...(bySlug.get(s) ?? []), o])
  }
  const groups = [...bySlug.entries()].filter(([, g]) => g.length > 1)
  console.log(`organizations ${all.length}; claim addresses shared by 2+ records: ${groups.length}`)

  type Plan = { slug: string; keepId: string; keepName: string; finalName: string; mergeIds: string[]; names: string[] }
  const merges: Plan[] = []
  const review: { slug: string; names: string[]; why: string[] }[] = []
  for (const [slug, g] of groups) {
    const why: string[] = []
    for (let i = 0; i < g.length; i++) for (let j = i + 1; j < g.length; j++) {
      const a = g[i], b = g[j]
      if (differs(a.emailDomain, b.emailDomain)) why.push(`email domains differ (${a.emailDomain} / ${b.emailDomain})`)
      if (differs(host(a.website), host(b.website))) why.push(`websites differ (${a.website} / ${b.website})`)
      if (differs(a.usState, b.usState)) why.push(`states differ (${a.usState} / ${b.usState})`)
      if (differs(a.hqCity, b.hqCity)) why.push(`cities differ (${a.hqCity} / ${b.hqCity})`)
      if (a.companyId && b.companyId && a.companyId !== b.companyId) why.push('linked to two different company records')
    }
    const names = g.map((o) => o.name)
    if (why.length) { review.push({ slug, names, why }); continue }
    const weight = (o: (typeof g)[number]) => o._count.affiliations + o._count.opportunities + o._count.mandates + o._count.activities + o._count.tasks
    const keeper = suggestKeeper(g.map((o) => ({ id: o.id, activity: weight(o) + (o.hiringClient ? 5 : 0), linked: Boolean(o.companyId), createdAt: o.createdAt })))
    const keep = g.find((o) => o.id === keeper.id)!
    merges.push({ slug, keepId: keep.id, keepName: keep.name, finalName: cleanestName(names), mergeIds: g.filter((o) => o.id !== keep.id).map((o) => o.id), names })
  }
  console.log(`safe to merge: ${merges.length}; needs a person: ${review.length}`)
  writeFileSync(`${OUT}/plan.json`, JSON.stringify(merges, null, 2))
  writeFileSync(`${OUT}/review.json`, JSON.stringify(review, null, 2))
  for (const m of merges) console.log(`  ${m.slug}: keep "${m.keepName}" (${m.keepId}), merge ${m.mergeIds.length}, final name "${m.finalName}"`)
  for (const r of review) console.log(`  REVIEW ${r.slug}: ${r.why.join('; ')}`)
  if (!APPLY) { console.log('dry run: nothing written to the database'); return }

  // Back up every record that will be deleted, with its whole row and the ids of what is attached to it.
  const ids = merges.flatMap((m) => [m.keepId, ...m.mergeIds])
  const full = await retry(() => prisma.crmOrganization.findMany({ where: { id: { in: ids } } }))
  const attached = await retry(() => Promise.all(ids.map(async (id) => ({
    id,
    affiliations: await prisma.crmAffiliation.findMany({ where: { orgId: id }, select: { id: true, personId: true, title: true } }),
    opportunities: (await prisma.crmOpportunity.findMany({ where: { orgId: id }, select: { id: true } })).map((r) => r.id),
    activities: (await prisma.crmActivity.findMany({ where: { orgId: id }, select: { id: true } })).map((r) => r.id),
    tasks: (await prisma.crmTask.findMany({ where: { orgId: id }, select: { id: true } })).map((r) => r.id),
  }))))
  writeFileSync(`${OUT}/backup-orgs.json`, JSON.stringify({ takenAt: new Date().toISOString(), organizations: full, attached }, null, 2))
  console.log(`backed up ${full.length} organization rows and their attached record ids to ${OUT}/backup-orgs.json`)

  const byId = new Map(all.map((o) => [o.id, o]))
  const log: unknown[] = []
  let done = 0, refused = 0
  for (const m of merges) {
    for (const id of m.mergeIds) {
      const r = await retry(() => mergeOrganizations(m.keepId, id, 'merge-ampersand-dupes'))
        .catch((e: Error) => ({ ok: false as const, reason: `error: ${String(e.message).split('\n').filter(Boolean).slice(-2).join(' ')}` }))
      log.push({ slug: m.slug, keepId: m.keepId, sourceId: id, sourceName: byId.get(id)?.name, ...r })
      if (r.ok) done++
      else { refused++; console.log(`  not merged: ${byId.get(id)?.name} -> ${m.keepName}: ${r.reason}`) }
      writeFileSync(`${OUT}/merge-log.json`, JSON.stringify(log, null, 2))
    }
    if (m.finalName !== m.keepName) {
      const key = normalizeOrgName(m.finalName)
      const taken = await prisma.crmOrganization.findUnique({ where: { canonicalNameNormalized: key }, select: { id: true } })
      if (!taken || taken.id === m.keepId) {
        await prisma.crmOrganization.update({ where: { id: m.keepId }, data: { name: m.finalName, canonicalNameNormalized: key } }).catch((e) => console.log(`  rename failed for ${m.finalName}: ${e.message}`))
      }
    }
  }
  console.log(`merged ${done}, refused ${refused}`)
}

main().finally(() => prisma.$disconnect())
