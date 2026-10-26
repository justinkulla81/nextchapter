// Removes the non-workforce competitor-win notes the first (unfiltered) import wrote, plus the re-bid dates and the
// organizations that import created only for them. Only rows the import wrote (sourceRef "competitor-win:<awardKey>",
// the fixed re-bid deadline text, the fixed organization note) are touched. Exports everything to CSV first.
//
//   node --env-file=.env.local --conditions=react-server --import tsx scripts/crm/competitor-wins-cleanup.ts            (dry run)
//   node --env-file=.env.local --conditions=react-server --import tsx scripts/crm/competitor-wins-cleanup.ts --apply
import { writeFileSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { prisma } from '../../src/lib/prisma'
import { awardIsWorkforce } from '../../src/lib/bids/relevance'

const APPLY = process.argv.includes('--apply')
const ORG_NOTE = 'Added from a competitor win (Competitors page).'
const REBID_TEXT = 'Contract end date from the award record; the buyer may re-bid around then.'
const csv = (rows: Record<string, unknown>[]) => {
  if (!rows.length) return ''
  const cols = Object.keys(rows[0])
  const q = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`
  return [cols.join(','), ...rows.map((r) => cols.map((c) => q(r[c])).join(','))].join('\n') + '\n'
}

async function main() {
  const notes = await prisma.crmActivity.findMany({ where: { sourceRef: { startsWith: 'competitor-win:' }, NOT: { sourceRef: { startsWith: 'competitor-win:card:' } }, isAutoLogged: true } })
  const keys = notes.map((n) => n.sourceRef!.slice('competitor-win:'.length))
  const awards = await prisma.competitorAward.findMany({ where: { awardKey: { in: keys } } })
  const byKey = new Map<string, (typeof awards)[number]>()
  for (const a of awards) if (!byKey.has(a.awardKey)) byKey.set(a.awardKey, a)
  const org = new Map((await prisma.crmOrganization.findMany({ where: { id: { in: [...new Set(notes.map((n) => n.orgId!).filter(Boolean))] } }, select: { id: true, name: true, notes: true } })).map((o) => [o.id, o]))

  const del = notes.filter((n) => { const a = byKey.get(n.sourceRef!.slice('competitor-win:'.length)); return a && !awardIsWorkforce(a) })
  const keep = notes.length - del.length
  const delIds = new Set(del.map((n) => n.id))

  // Re-bid deadlines the import wrote for those same awards (matched by organization and the award link).
  const delPairs = new Set(del.map((n) => `${n.orgId}|${byKey.get(n.sourceRef!.slice(15))!.url}`))
  const deadlines = (await prisma.crmDeadline.findMany({ where: { kind: 'CONTRACT_RENEWAL', rawText: REBID_TEXT, label: { startsWith: 'Likely re-bid:' }, opportunityId: null } }))
    .filter((d) => delPairs.has(`${d.orgId}|${d.sourceUrl}`))
  const delDeadlineIds = new Set(deadlines.map((d) => d.id))

  // Organizations the import created: only deletable when nothing else hangs off them once the above are gone.
  const candidates = await prisma.crmOrganization.findMany({ where: { notes: ORG_NOTE }, select: { id: true, name: true, createdAt: true, companyId: true, outplacementOrgId: true, recruiterFirmId: true } })
  const orgRows: { id: string; name: string; deletable: boolean; reason: string }[] = []
  const ids = candidates.map((o) => o.id)
  // One query per table across all candidate organizations (per-organization counts were far too slow on unindexed tables).
  const tally = async (rows: Promise<{ k: string | null }[]>) => { const m = new Map<string, number>(); for (const r of await rows) if (r.k) m.set(r.k, (m.get(r.k) ?? 0) + 1); return m }
  const sel = { orgId: true }
  const [acts, dls, ...others] = await Promise.all([
    prisma.crmActivity.findMany({ where: { orgId: { in: ids } }, select: { id: true, orgId: true } }),
    prisma.crmDeadline.findMany({ where: { orgId: { in: ids } }, select: { id: true, orgId: true } }),
    tally(prisma.crmAffiliation.findMany({ where: { orgId: { in: ids } }, select: sel }).then((r) => r.map((x) => ({ k: x.orgId })))),
    tally(prisma.crmMandate.findMany({ where: { orgId: { in: ids } }, select: sel }).then((r) => r.map((x) => ({ k: x.orgId })))),
    tally(prisma.crmBackground.findMany({ where: { orgId: { in: ids } }, select: sel }).then((r) => r.map((x) => ({ k: x.orgId })))),
    tally(prisma.crmOpportunity.findMany({ where: { orgId: { in: ids } }, select: sel }).then((r) => r.map((x) => ({ k: x.orgId })))),
    tally(prisma.crmTask.findMany({ where: { orgId: { in: ids } }, select: sel }).then((r) => r.map((x) => ({ k: x.orgId })))),
    tally(prisma.crmResearchItem.findMany({ where: { orgId: { in: ids } }, select: sel }).then((r) => r.map((x) => ({ k: x.orgId })))),
    tally(prisma.crmPortfolioHolding.findMany({ where: { investorOrgId: { in: ids } }, select: { investorOrgId: true } }).then((r) => r.map((x) => ({ k: x.investorOrgId })))),
    tally(prisma.crmSourceRecord.findMany({ where: { orgId: { in: ids } }, select: sel }).then((r) => r.map((x) => ({ k: x.orgId })))),
    tally(prisma.crmIntroPath.findMany({ where: { targetOrgId: { in: ids } }, select: { targetOrgId: true } }).then((r) => r.map((x) => ({ k: x.targetOrgId })))),
    tally(prisma.crmInvestorProfile.findMany({ where: { orgId: { in: ids } }, select: sel }).then((r) => r.map((x) => ({ k: x.orgId })))),
    tally(prisma.crmOutplacementProfile.findMany({ where: { orgId: { in: ids } }, select: sel }).then((r) => r.map((x) => ({ k: x.orgId })))),
    tally(prisma.crmPartnerProfile.findMany({ where: { orgId: { in: ids } }, select: sel }).then((r) => r.map((x) => ({ k: x.orgId })))),
    tally(prisma.crmResearchProfile.findMany({ where: { orgId: { in: ids } }, select: sel }).then((r) => r.map((x) => ({ k: x.orgId })))),
    tally(prisma.searchFirm.findMany({ where: { crmOrgId: { in: ids } }, select: { crmOrgId: true } }).then((r) => r.map((x) => ({ k: x.crmOrgId })))),
    tally(prisma.orgClaim.findMany({ where: { crmOrganizationId: { in: ids } }, select: { crmOrganizationId: true } }).then((r) => r.map((x) => ({ k: x.crmOrganizationId })))),
  ])
  for (const o of candidates) {
    const remaining = acts.filter((a) => a.orgId === o.id && !delIds.has(a.id)).length + dls.filter((d) => d.orgId === o.id && !delDeadlineIds.has(d.id)).length
    const links = others.reduce((t, m) => t + (m.get(o.id) ?? 0), 0) + (o.companyId ? 1 : 0) + (o.outplacementOrgId ? 1 : 0) + (o.recruiterFirmId ? 1 : 0)
    const reason = remaining > 0 ? `${remaining} other notes/dates kept` : links > 0 ? `${links} other links (people, tasks, profiles, company...)` : ''
    orgRows.push({ id: o.id, name: o.name, deletable: reason === '', reason: reason || 'only competitor-win rows' })
  }
  const delOrgs = orgRows.filter((o) => o.deletable)

  // Export first.
  const dir = join(homedir(), 'nc-hunter-results'); mkdirSync(dir, { recursive: true })
  const stamp = '2026-10-26-competitor-wins-cleanup'
  writeFileSync(join(dir, `${stamp}-notes.csv`), csv(del.map((n) => { const a = byKey.get(n.sourceRef!.slice(15))!; return { id: n.id, org: org.get(n.orgId!)?.name, competitor: a.competitorName, award: a.description, agency: a.agency, amountUsd: a.amount, startDate: a.startDate?.toISOString().slice(0, 10), url: a.url, sourceRef: n.sourceRef, subject: n.subject, body: n.body, occurredAt: n.occurredAt.toISOString() } })))
  writeFileSync(join(dir, `${stamp}-rebid-dates.csv`), csv(deadlines.map((d) => ({ id: d.id, orgId: d.orgId, label: d.label, dueAt: d.dueAt?.toISOString(), sourceUrl: d.sourceUrl }))))
  writeFileSync(join(dir, `${stamp}-orgs.csv`), csv(orgRows))

  console.log(JSON.stringify({ mode: APPLY ? 'APPLY' : 'DRY RUN', importNotes: notes.length, notesToDelete: del.length, notesKept: keep, rebidDatesToDelete: deadlines.length, orgsCreatedByImport: candidates.length, orgsToDelete: delOrgs.length, orgsKept: orgRows.filter((o) => !o.deletable).map((o) => `${o.name}: ${o.reason}`).slice(0, 40) }, null, 1))
  console.log('SAMPLE (buyer | competitor | award | amount):')
  for (const n of del.slice(0, 15)) { const a = byKey.get(n.sourceRef!.slice(15))!; console.log(`- ${org.get(n.orgId!)?.name} | ${a.competitorName} | ${(a.description ?? '').slice(0, 70)} | $${Math.round(a.amount).toLocaleString('en-US')}`) }

  if (!APPLY) return
  const r1 = await prisma.crmDeadline.deleteMany({ where: { id: { in: [...delDeadlineIds] } } })
  const r2 = await prisma.crmActivity.deleteMany({ where: { id: { in: [...delIds] }, isAutoLogged: true, sourceRef: { startsWith: 'competitor-win:' } } })
  let orgsDeleted = 0
  for (const o of delOrgs) {
    // Re-check at delete time: anything attached in the meantime keeps the organization.
    const left = (await prisma.crmActivity.count({ where: { orgId: o.id } })) + (await prisma.crmDeadline.count({ where: { orgId: o.id } })) + (await prisma.crmAffiliation.count({ where: { orgId: o.id } })) + (await prisma.crmOpportunity.count({ where: { orgId: o.id } })) + (await prisma.crmTask.count({ where: { orgId: o.id } }))
    if (left === 0) { await prisma.crmOrganization.delete({ where: { id: o.id } }); orgsDeleted++ }
  }
  console.log(JSON.stringify({ deleted: { notes: r2.count, rebidDates: r1.count, orgs: orgsDeleted } }))
}
main().finally(() => prisma.$disconnect())
