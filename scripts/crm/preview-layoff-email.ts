/**
 * Renders the layoff alert email for one employer's newest WARN notice, from the live CRM, to an HTML file.
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/crm/preview-layoff-email.ts "Kroger" out.html
 */
import { writeFileSync } from 'node:fs'
import { prisma } from '../../src/lib/prisma'
import { alertBody } from '../../src/lib/warn/layoff-alert-rules'
import { industryKeyForNaics } from '../../src/lib/crm/coverage'
import { layoffPeople } from '../../src/lib/warn/layoff-alert-people'
import { withAudienceHtml } from '../../src/lib/email/audience-tag'

async function main() {
  const [name, out] = process.argv.slice(2)
  const n = await prisma.warnNotice.findFirst({ where: { employer: { contains: name, mode: 'insensitive' }, source: 'WARN_FILING' }, orderBy: { noticeDate: 'desc' } })
  if (!n) { console.log('no notice'); return }
  const org = n.promotedOrgId ? await prisma.crmOrganization.findUnique({ where: { id: n.promotedOrgId }, select: { id: true } }) : null
  const rel = await layoffPeople(org?.id ?? null, { state: n.state, county: n.county, address: n.address, workforceBoardId: n.workforceBoardId, industryKey: industryKeyForNaics(n.industry) })
  const html = alertBody({
    employer: n.employer, employees: n.employees, percent: null, kind: 'warn', confirmed: true, inCrm: !!org,
    people: rel.groups.find((g) => g.key === 'head_hr')?.cards.length ?? 0, warm: 0, contactsFound: 0, place: rel.placeLabel, groups: rel.groups,
  }, { source: n.sourceUrl, org: org ? `https://launchyournextchapter.com/support/admin/crm/organizations/${org.id}` : null, notices: 'https://launchyournextchapter.com/support/admin/crm/warn' })
  writeFileSync(out, `<!doctype html><meta charset="utf-8"><body style="margin:24px;background:#fff">${withAudienceHtml('admin', html)}</body>`)
  console.log(n.employer, n.state, n.county, n.employees, rel.groups.map((g) => `${g.key}:${g.cards.length}${g.more ? `+${g.more}` : ''}`).join(' '))
  await prisma.$disconnect()
}
main().catch((e) => { console.error(e); process.exit(1) })
