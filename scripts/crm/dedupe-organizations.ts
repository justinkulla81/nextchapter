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
 * "Owl Ventures" and "Owl Ventures, LP" import as two organisations and split
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

const prisma = new PrismaClient()
const COMMIT = process.argv.includes('--commit')

/** Legal forms normalizeOrgName leaves behind. */
const TRAILING_LEGAL = /\s+(lp|llp|gp|plc|sa|ag|nv|bv|pte|pty|ab|oy|as|kk|srl|spa|sarl|kg|mbh)$/

/** Stricter key: normalizeOrgName, minus a trailing legal form, parenthetical-free. */
function strictKey(name: string): string {
  const withoutParen = name.replace(/\s*\([^)]*\)\s*$/, '').trim()
  let k = normalizeOrgName(withoutParen || name)
  let prev: string
  do { prev = k; k = k.replace(TRAILING_LEGAL, '') } while (k !== prev)
  return k.trim()
}

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
  if (dupeGroups.length === 0) { console.log('\nNothing to merge.'); return }

  let merged = 0, moved = 0
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

      // Everything else repoints wholesale.
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

  console.log(`\n${COMMIT ? 'Merged' : 'Would merge'} ${merged} duplicate organizations` +
    (COMMIT ? `, moved ${moved} affiliations.` : '.'))
  if (!COMMIT) console.log('Re-run with --commit to apply.')
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
