/**
 * The American Job Center list. Writes every center from the workforce partner table to a CSV,
 * and (with --apply) puts the centers of boards that have had a layoff notice in the last
 * 90 days into the CRM as government organizations, with the center's phone, shared inbox,
 * hours and website in the note.
 *
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/crm/ajc-import.ts <out.csv> [--apply]
 *
 * The directory (CareerOneStop) gives a center, not a manager, so no people are added here;
 * the shared inbox is kept on the organization. The name carries the state so two centers
 * with the same name in different states stay separate.
 */
import { writeFileSync } from 'node:fs'
import { prisma } from '../../src/lib/prisma'
import { ensureOrg } from '../../src/lib/crm/add-contact'

const q = (v: unknown) => '"' + String(v ?? '').replace(/"/g, '""') + '"'

async function main() {
  const [out, flag] = process.argv.slice(2)
  if (!out) { console.log('usage: <out.csv> [--apply]'); return }
  const apply = flag === '--apply'
  const active = new Set((await prisma.warnNotice.groupBy({
    by: ['workforceBoardId'],
    where: { workforceBoardId: { not: null }, dismissedAt: null, noticeDate: { gte: new Date(Date.now() - 90 * 86_400_000) } },
  })).map((a) => a.workforceBoardId!))
  const boards = new Map((await prisma.workforceBoard.findMany({ select: { id: true, name: true, state: true } })).map((b) => [b.id, b]))
  const centers = await prisma.workforceBoardPartner.findMany({ orderBy: [{ boardId: 'asc' }, { name: 'asc' }] })

  const lines = [['state', 'board', 'boardHadRecentLayoffs', 'center', 'kind', 'address', 'phone', 'email', 'businessEmail', 'hours', 'website'].map(q).join(',')]
  const tally = { centers: centers.length, inActiveBoards: 0, orgsAdded: 0, orgsExisting: 0, withInbox: 0 }
  for (const c of centers) {
    const b = boards.get(c.boardId)
    const isActive = active.has(c.boardId)
    if (isActive) tally.inActiveBoards++
    if (c.email || c.businessEmail) tally.withInbox++
    lines.push([b?.state, b?.name, isActive ? 'yes' : '', c.name, c.kind, c.address, c.phone, c.email, c.businessEmail, c.hours, c.website].map(q).join(','))
    if (!apply || !isActive || !b) continue
    const name = `${c.name} (${b.state})`
    const org = await ensureOrg({ name, type: 'GOVERNMENT', website: c.website, state: b.state })
    const existing = await prisma.crmOrganization.findUnique({ where: { id: org.id }, select: { notes: true, createdAt: true } })
    const note = `${c.kind ?? 'American Job Center'} in the ${b.name} area. Phone: ${c.phone ?? 'n/a'}. Shared inbox: ${[c.email, c.businessEmail].filter(Boolean).join(', ') || 'n/a'}. Hours: ${c.hours ?? 'n/a'}. Address: ${c.address ?? 'n/a'}. From the CareerOneStop American Job Center directory.`
    if (existing && !existing.notes) { await prisma.crmOrganization.update({ where: { id: org.id }, data: { notes: note } }); tally.orgsAdded++ } else tally.orgsExisting++
  }
  writeFileSync(out, lines.join('\n') + '\n')
  console.log(tally, `wrote ${out}`)
  await prisma.$disconnect()
}
main().catch((e) => { console.error(e); process.exit(1) })
