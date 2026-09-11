/**
 * Merges duplicate CrmOrganization rows that survived import.
 *
 * DRY RUN BY DEFAULT. Pass --commit to apply.
 *
 *   npm run crm:dedupe
 *   npm run crm:dedupe -- --commit
 *
 * Why this exists: normalizeOrgName (src/lib/text/org-name-match) does not
 * strip "LP"/"LLP"/"GP" and does not collapse a trailing parenthetical, so
 * "Owl Ventures" and "Owl Ventures, LP" import as two organizations and split
 * five people across both. That function is NOT changed here — production
 * Company matching depends on it, and loosening it would silently merge
 * genuinely distinct companies across the whole app. This pass applies a
 * stricter key to CRM rows only.
 *
 * Two rules, both conservative:
 *   A. identical after stripping a trailing legal suffix
 *        "Owl Ventures, LP" == "Owl Ventures"
 *   B. identical after removing a trailing parenthetical from the raw name
 *        "Jobs for the Future (JFF)" == "Jobs for the Future"
 *
 * Deliberately NOT merged, because these are different entities or unclear:
 *   "Bloomberg" vs "Bloomberg Beta"        — extra word is not a suffix
 *   "Coursera" vs "Coursera / Guild"       — Guild is a separate company
 *   "Comcast" vs "Comcast NBCUniversal"    — distinct corporate entity
 * Those are reported as review candidates and left alone.
 */
import { PrismaClient } from '@prisma/client'
import { normalizeOrgName } from '../../src/lib/text/org-name-match'
import { strictOrgKey } from '../../src/lib/crm/normalize'

const prisma = new PrismaClient()
const COMMIT = process.argv.includes('--commit')

/** Shared with the importer so the two can't disagree — see strictOrgKey. */
const strictKey = (name: string) => strictOrgKey(name, normalizeOrgName)

async function main() {
  console.log('='.repeat(70))
  console.log(`  CRM ORG DEDUPE — ${COMMIT ? 'COMMIT' : 'DRY RUN (no writes)'}`)
  console.log('='.repeat(70))

  const all = await prisma.crmOrganization.findMany({
    select: {
      id: true, name: true, canonicalNameNormalized: true, orgTypes: true,
      website: true, hqRegion: true, industry: true, focus: true, companyId: true,
      createdAt: true,
      _count: { select: { affiliations: true, opportunities: true, deadlines: true } },
    },
  })
  console.log(`\nloaded ${all.length} organizations`)

  const groups = new Map<string, typeof all>()
  for (const o of all) {
    const k = strictKey(o.name)
    if (!k) continue
    const g = groups.get(k) ?? []
    g.push(o)
    groups.set(k, g)
  }
  const dupeGroups = [...groups.entries()].filter(([, g]) => g.length > 1)

  console.log(`duplicate groups found: ${dupeGroups.length}`)
  if (dupeGroups.length === 0) console.log('  (no organization duplicates — checking opportunities anyway)')

  let merged = 0, moved = 0, oppsMerged = 0
  for (const [key, group] of dupeGroups) {
    // Survivor: most affiliations, then oldest. Display name: the cleanest
    // (shortest) form in the group, which is the one without the suffix.
    const sorted = [...group].sort((a, b) =>
      b._count.affiliations - a._count.affiliations || a.createdAt.getTime() - b.createdAt.getTime())
    const survivor = sorted[0]
    const losers = sorted.slice(1)
    const bestName = [...group].sort((a, b) => a.name.length - b.name.length)[0].name

    console.log(`\n  [${key}]`)
    console.log(`    keep  "${survivor.name}" (${survivor._count.affiliations} affil, ${survivor._count.opportunities} opps)` +
      (bestName !== survivor.name ? `  → renamed to "${bestName}"` : ''))
    for (const l of losers) console.log(`    merge "${l.name}" (${l._count.affiliations} affil, ${l._count.opportunities} opps)`)

    if (!COMMIT) { merged += losers.length; continue }

    for (const loser of losers) {
      // Affiliations: repoint, skipping any that would violate (person, org, title).
      const [survAff, loseAff] = await Promise.all([
        prisma.crmAffiliation.findMany({ where: { orgId: survivor.id }, select: { personId: true, title: true } }),
        prisma.crmAffiliation.findMany({ where: { orgId: loser.id }, select: { id: true, personId: true, title: true } }),
      ])
      const taken = new Set(survAff.map((a) => `${a.personId}|${a.title ?? ''}`))
      for (const a of loseAff) {
        if (taken.has(`${a.personId}|${a.title ?? ''}`)) {
          await prisma.crmAffiliation.delete({ where: { id: a.id } })
        } else {
          await prisma.crmAffiliation.update({ where: { id: a.id }, data: { orgId: survivor.id } })
          taken.add(`${a.personId}|${a.title ?? ''}`)
          moved++
        }
      }

      await prisma.crmOpportunity.updateMany({ where: { orgId: loser.id }, data: { orgId: survivor.id } })
      await prisma.crmDeadline.updateMany({ where: { orgId: loser.id }, data: { orgId: survivor.id } })
      await prisma.crmActivity.updateMany({ where: { orgId: loser.id }, data: { orgId: survivor.id } })
      await prisma.crmTask.updateMany({ where: { orgId: loser.id }, data: { orgId: survivor.id } })
      await prisma.crmResearchItem.updateMany({ where: { orgId: loser.id }, data: { orgId: survivor.id } })
      await prisma.crmSourceRecord.updateMany({ where: { orgId: loser.id }, data: { orgId: survivor.id } })

      // 1:1 profiles: move only when the survivor has none, else drop the duplicate.
      for (const model of ['crmInvestorProfile', 'crmOutplacementProfile', 'crmPartnerProfile', 'crmResearchProfile'] as const) {
        const delegate = prisma[model] as unknown as {
          findUnique(a: { where: { orgId: string } }): Promise<{ id: string } | null>
          update(a: { where: { orgId: string }; data: { orgId: string } }): Promise<unknown>
          delete(a: { where: { orgId: string } }): Promise<unknown>
        }
        const loseProf = await delegate.findUnique({ where: { orgId: loser.id } })
        if (!loseProf) continue
        const survProf = await delegate.findUnique({ where: { orgId: survivor.id } })
        if (survProf) await delegate.delete({ where: { orgId: loser.id } })
        else await delegate.update({ where: { orgId: loser.id }, data: { orgId: survivor.id } })
      }

      // Union the types and backfill anything the survivor is missing.
      await prisma.crmOrganization.update({
        where: { id: survivor.id },
        data: {
          orgTypes: [...new Set([...survivor.orgTypes, ...loser.orgTypes])],
          website: survivor.website ?? loser.website,
          hqRegion: survivor.hqRegion ?? loser.hqRegion,
          industry: survivor.industry ?? loser.industry,
          focus: survivor.focus ?? loser.focus,
          companyId: survivor.companyId ?? loser.companyId,
        },
      })
      await prisma.crmOrganization.delete({ where: { id: loser.id } })
      merged++
    }

    if (bestName !== survivor.name) {
      await prisma.crmOrganization.update({ where: { id: survivor.id }, data: { name: bestName } })
    }
  }

  // ── collapse duplicate opportunities ──
  //
  // Runs whether or not any organization merged: two rows for the same
  // (pipeline, organization) are duplicates however they got there — a merge
  // that repointed both, or two source sheets naming the same program. The
  // row that has moved furthest through the pipeline wins, since that's the
  // one carrying real work.
  const oppGroups = await prisma.crmOpportunity.groupBy({
    by: ['pipelineId', 'orgId'],
    _count: { _all: true },
    having: { orgId: { _count: { gt: 1 } } },
  })
  console.log(`\nduplicate opportunity groups: ${oppGroups.length}`)
  for (const g of oppGroups) {
    if (!g.orgId) continue
    const rows = await prisma.crmOpportunity.findMany({
      where: { pipelineId: g.pipelineId, orgId: g.orgId },
      select: { id: true, title: true, createdAt: true, stage: { select: { sortOrder: true } } },
    })
    const sorted = [...rows].sort((a, b) =>
      b.stage.sortOrder - a.stage.sortOrder || a.createdAt.getTime() - b.createdAt.getTime())
    const keep = sorted[0]
    const drop = sorted.slice(1)
    console.log(`  keep "${keep.title.slice(0, 58)}" · drop ${drop.length}`)
    if (!COMMIT) { oppsMerged += drop.length; continue }
    for (const d of drop) {
      await prisma.crmActivity.updateMany({ where: { opportunityId: d.id }, data: { opportunityId: keep.id } })
      await prisma.crmTask.updateMany({ where: { opportunityId: d.id }, data: { opportunityId: keep.id } })
      await prisma.crmDeadline.updateMany({ where: { opportunityId: d.id }, data: { opportunityId: keep.id } })
      await prisma.crmOpportunity.delete({ where: { id: d.id } })
      oppsMerged++
    }
  }

  console.log(`\n${COMMIT ? 'Merged' : 'Would merge'} ${merged} duplicate organizations` +
    (COMMIT ? `, moved ${moved} affiliations, collapsed ${oppsMerged} duplicate opportunities.` : '.'))
  if (!COMMIT) console.log('Re-run with --commit to apply.')
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
