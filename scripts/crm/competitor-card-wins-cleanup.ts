// Removes the CRM notes the competitor import wrote from wins typed on competitor CARDS (sourceRef "competitor-win:card:...")
// when the "buyer" is an investor or funder (a funding round counted as a win), plus organizations the import created only for them.
// Only rows the import wrote are touched. Exports everything to CSV first.
//
//   node --env-file=.env.local --conditions=react-server --import tsx scripts/crm/competitor-card-wins-cleanup.ts            (dry run)
//   node --env-file=.env.local --conditions=react-server --import tsx scripts/crm/competitor-card-wins-cleanup.ts --apply
import { writeFileSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { prisma } from '../../src/lib/prisma'

const APPLY = process.argv.includes('--apply')
const ORG_NOTE = 'Added from a competitor win (Competitors page).'
// A win that is really a funding round or acquisition, not a contract or grant from a buyer.
const FUNDING_WHAT = /\b(series [a-f]\b|seed|pre-seed|raised?\b|raises\b|funding round|investment|venture|led by|\bround\b|acquired|acquisition|definitive agreement|valuation|\bipo\b)/i
// A "buyer" that is an investor, fund, foundation or funder.
const INVESTOR_ORG = /\b(ventures?|capital|partners|funds?|investors?|angels?|equity|growth|holdings|syndicate|accelerator|foundation|philanthrop\w*|endowment|trust|bancorp|family office|scott|donors?|y combinator|techstars)\b/i
// A garbled buyer: a list of several parties, a parenthetical status, or a sentence.
const GARBLED = /,|\(|\bacquired\b|\bpartnership\b| and \w+ \w+ /i
const csv = (rows: Record<string, unknown>[]) => {
  if (!rows.length) return ''
  const cols = Object.keys(rows[0])
  const q = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`
  return [cols.join(','), ...rows.map((r) => cols.map((c) => q(r[c])).join(','))].join('\n') + '\n'
}

async function main() {
  const notes = await prisma.crmActivity.findMany({ where: { sourceRef: { startsWith: 'competitor-win:card:' }, isAutoLogged: true } })
  const orgIds = [...new Set(notes.map((n) => n.orgId).filter((x): x is string => !!x))]
  const org = new Map((await prisma.crmOrganization.findMany({ where: { id: { in: orgIds } }, select: { id: true, name: true, notes: true, orgTypes: true } })).map((o) => [o.id, o]))
  const why = (n: (typeof notes)[number]): string | null => {
    const o = org.get(n.orgId ?? '')
    const what = (n.subject ?? '').replace(/^.*? won: /, '')
    if (FUNDING_WHAT.test(what)) return 'funding round or acquisition counted as a win'
    if (o && INVESTOR_ORG.test(o.name)) return 'buyer is an investor or funder'
    if (o && GARBLED.test(o.name) && !o.orgTypes.includes('GOVERNMENT')) return 'buyer name is a list or a sentence'
    return null
  }
  const del = notes.map((n) => ({ n, reason: why(n) })).filter((x) => x.reason)
  const delIds = new Set(del.map((x) => x.n.id))
  const keepNotes = notes.filter((n) => !delIds.has(n.id))
  const delDeadlineIds = new Set<string>()

  const candidates = await prisma.crmOrganization.findMany({ where: { notes: ORG_NOTE }, select: { id: true, name: true, companyId: true, outplacementOrgId: true, recruiterFirmId: true } })
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

  const dir = join(homedir(), 'nc-hunter-results'); mkdirSync(dir, { recursive: true })
  const stamp = '2026-10-26-competitor-card-wins-cleanup'
  writeFileSync(join(dir, `${stamp}-notes.csv`), csv(del.map(({ n, reason }) => ({ id: n.id, org: org.get(n.orgId ?? '')?.name, reason, subject: n.subject, body: n.body, sourceRef: n.sourceRef, occurredAt: n.occurredAt.toISOString() }))))
  writeFileSync(join(dir, `${stamp}-orgs.csv`), csv(orgRows))

  const reasons: Record<string, number> = {}
  for (const x of del) reasons[x.reason!] = (reasons[x.reason!] ?? 0) + 1
  console.log(JSON.stringify({ mode: APPLY ? 'APPLY' : 'DRY RUN', cardNotes: notes.length, notesToDelete: del.length, byReason: reasons, notesKept: keepNotes.length, orgsCreatedByImport: candidates.length, orgsToDelete: delOrgs.length }, null, 1))
  console.log('DELETE SAMPLE (buyer | subject):')
  for (const x of del.slice(0, 15)) console.log(`- ${org.get(x.n.orgId ?? '')?.name} | ${(x.n.subject ?? '').slice(0, 90)} | ${x.reason}`)
  console.log('KEPT SAMPLE (buyer | subject):')
  for (const n of keepNotes.filter((_, i) => i % Math.max(1, Math.floor(keepNotes.length / 25)) === 0).slice(0, 25)) console.log(`- ${org.get(n.orgId ?? '')?.name} | ${(n.subject ?? '').slice(0, 90)}`)

  if (!APPLY) return
  const r2 = await prisma.crmActivity.deleteMany({ where: { id: { in: [...delIds] }, isAutoLogged: true, sourceRef: { startsWith: 'competitor-win:card:' } } })
  let orgsDeleted = 0
  for (const o of delOrgs) {
    const left = (await prisma.crmActivity.count({ where: { orgId: o.id } })) + (await prisma.crmDeadline.count({ where: { orgId: o.id } })) + (await prisma.crmAffiliation.count({ where: { orgId: o.id } })) + (await prisma.crmOpportunity.count({ where: { orgId: o.id } })) + (await prisma.crmTask.count({ where: { orgId: o.id } }))
    if (left === 0) { await prisma.crmOrganization.delete({ where: { id: o.id } }); orgsDeleted++ }
  }
  console.log(JSON.stringify({ deleted: { notes: r2.count, orgs: orgsDeleted } }))
}
main().finally(() => prisma.$disconnect())
