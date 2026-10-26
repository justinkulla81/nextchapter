/**
 * Puts every organization that has a public page (American Job Center, economic development organization, workforce
 * board) into the CRM and records the link in PublicOrgPage, so the CRM record can show its "Public page" link and the
 * page's claim button can go to /prepared/<slug>.
 *
 * Dry run by default: prints what it would link, create and put on the Review List, and writes nothing.
 *
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/crm/public-org-pages-backfill.ts [--apply] [--state=KY]
 *
 * Needs prisma/manual/2026-10-25-public-org-pages.sql applied first (--apply checks).
 *
 * Matching, by the CRM's own normalized name (normalizeOrgName), never by guess:
 *  - the state-qualified name ("Career Center (KY)") already exists            → linked
 *  - the plain name exists and its state is this one                           → linked
 *  - the plain name exists and its state is another one                        → a different organization: create
 *  - the plain name exists and its state is unknown                            → Review List (REVIEW), nothing linked
 *  - no match                                                                  → create the organization
 */
import { prisma } from '../../src/lib/prisma'
import { normalizeOrgName } from '../../src/lib/text/org-name-match'
import { ALL_STATE_CODES } from '../../src/lib/seo/states'
import { getStateData } from '../../src/lib/seo/org-pages'
import { crmOrgName, cleanOrgName, type OrgPageKind } from '../../src/lib/seo/org-page-rules'

type Plan = { kind: OrgPageKind; id: string; state: string; name: string; crmName: string; action: 'LINKED' | 'CREATED' | 'REVIEW'; orgId?: string; reason?: string; website: string | null; city: string | null }

async function main() {
  const apply = process.argv.includes('--apply')
  const only = process.argv.find((a) => a.startsWith('--state='))?.slice(8)
  if (apply) {
    const t = await prisma.$queryRaw<{ t: string | null }[]>`select to_regclass('"PublicOrgPage"')::text as t`
    if (!t[0]?.t) throw new Error('PublicOrgPage does not exist yet: apply prisma/manual/2026-10-25-public-org-pages.sql first.')
  }
  const known = new Map<string, { id: string; usState: string | null }>()
  for (const o of await prisma.crmOrganization.findMany({ select: { id: true, canonicalNameNormalized: true, usState: true } })) known.set(o.canonicalNameNormalized, { id: o.id, usState: o.usState })
  const plans: Plan[] = []
  const claimed = new Set<string>() // canonical names this run already used, so two rows never share a record

  for (const code of ALL_STATE_CODES) {
    if (only && only !== code) continue
    const sd = await getStateData(code)
    for (const [kind, rows] of [['JOB_CENTER', sd.centers], ['ECON_DEV', sd.econDev], ['WORKFORCE_BOARD', sd.boards]] as const) {
      const tally = new Map<string, number>()
      for (const r of rows) tally.set(r.name.toLowerCase(), (tally.get(r.name.toLowerCase()) ?? 0) + 1)
      for (const r of rows) {
        const crmName = crmOrgName(r, { sameNameInState: (tally.get(r.name.toLowerCase()) ?? 0) > 1 })
        const qualified = normalizeOrgName(crmName)
        const plain = normalizeOrgName(cleanOrgName(r.name))
        const base = { kind, id: r.id, state: code, name: r.name, crmName, website: r.website, city: r.city }
        const exact = known.get(qualified)
        const same = known.get(plain)
        if (exact && !claimed.has(qualified)) { claimed.add(qualified); plans.push({ ...base, action: 'LINKED', orgId: exact.id }); continue }
        if (same && !claimed.has(plain) && same.usState === code) { claimed.add(plain); plans.push({ ...base, action: 'LINKED', orgId: same.id }); continue }
        if (same && !same.usState) { plans.push({ ...base, action: 'REVIEW', orgId: same.id, reason: `Same name as an organization already here, whose state is not recorded.` }); continue }
        plans.push({ ...base, action: 'CREATED' })
      }
    }
  }

  const count = (a: Plan['action'], k?: OrgPageKind) => plans.filter((p) => p.action === a && (!k || p.kind === k)).length
  for (const k of ['JOB_CENTER', 'ECON_DEV', 'WORKFORCE_BOARD'] as const) console.log(k, { rows: plans.filter((p) => p.kind === k).length, link: count('LINKED', k), create: count('CREATED', k), review: count('REVIEW', k) })
  for (const p of plans.filter((x) => x.action === 'REVIEW').slice(0, 10)) console.log('  review:', p.crmName, '→', p.orgId)
  if (!apply) { console.log('\nDry run: nothing written. Re-run with --apply.'); await prisma.$disconnect(); return }

  let created = 0
  for (const p of plans) {
    let crmOrgId = p.action === 'REVIEW' ? null : (p.orgId ?? null)
    if (p.action === 'CREATED') {
      const canonical = normalizeOrgName(p.crmName)
      const org = await prisma.crmOrganization.upsert({
        where: { canonicalNameNormalized: canonical },
        update: {},
        create: { name: p.crmName, canonicalNameNormalized: canonical, orgTypes: ['GOVERNMENT'], website: p.website, hqCity: p.city, hqRegion: p.state, usState: p.state },
        select: { id: true },
      })
      crmOrgId = org.id
      created++
    }
    await prisma.publicOrgPage.upsert({
      where: { kind_sourceId: { kind: p.kind, sourceId: p.id } },
      update: { crmOrgId, matchStatus: p.action, reviewOrgId: p.action === 'REVIEW' ? p.orgId : null, reviewReason: p.reason ?? null },
      create: { kind: p.kind, sourceId: p.id, state: p.state, crmOrgId, matchStatus: p.action, reviewOrgId: p.action === 'REVIEW' ? p.orgId : null, reviewReason: p.reason ?? null },
    })
  }
  console.log(`\nApplied: ${plans.length} links written, ${created} organizations created.`)
  await prisma.$disconnect()
}
main().catch((e) => { console.error(e); process.exit(1) })
