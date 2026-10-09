// One-time backfill for people who already had a Follow up / Keep in touch
// status, or who work at an organization with a deal status, before those
// started lifting priority (src/lib/crm/status-priority.ts). Raise-only —
// never lowers a priority. Dry run by default.
//
// Run: npx tsx --env-file=.env.local scripts/backfill-crm-status-priority.ts [--apply]

import { PrismaClient } from '@prisma/client'
import { FOLLOW_UP_FLOOR, KEEP_IN_TOUCH_FLOOR, orgDealFloor, raisePriorityTo } from '../src/lib/crm/status-priority'

const prisma = new PrismaClient()
const apply = process.argv.includes('--apply')

async function main() {
  const live = { deletedAt: null, passedAt: null }
  const followUp = await prisma.crmPerson.findMany({
    where: { ...live, OR: [{ nextFollowUpAt: { not: null } }, { nextFollowUpNote: { not: null } }], NOT: { priority: 'P0' } },
    select: { id: true, priority: true },
  })
  const keep = await prisma.crmPerson.findMany({
    where: { ...live, keepInTouchAt: { not: null }, nextFollowUpAt: null, nextFollowUpNote: null, OR: [{ priority: null }, { priority: 'P2' }] },
    select: { id: true, priority: true },
  })
  const orgs = await prisma.crmOrganization.findMany({ where: { dealStatus: { not: null } }, select: { id: true, dealStatus: true } })
  const orgP0: string[] = []
  const orgP1: string[] = []
  for (const o of orgs) {
    const floor = orgDealFloor(o.dealStatus)
    if (!floor) continue
    const people = await prisma.crmAffiliation.findMany({ where: { orgId: o.id, isCurrent: true, person: { deletedAt: null, passedAt: null } }, select: { personId: true } })
    ;(floor === 'P0' ? orgP0 : orgP1).push(...people.map((a) => a.personId))
  }

  const p0 = [...new Set([...followUp.map((p) => p.id), ...orgP0])]
  const p1 = [...new Set([...keep.map((p) => p.id), ...orgP1])].filter((id) => !p0.includes(id))
  console.log(`To P0 (at most): ${p0.length} — ${followUp.length} follow-ups, ${orgP0.length} at active-deal orgs`)
  console.log(`To P1 (at most): ${p1.length} — ${keep.length} keep-in-touch, ${orgP1.length} at contacted orgs`)
  if (!apply) { console.log('Dry run — pass --apply to write.'); return }

  const a = await raisePriorityTo(p0, FOLLOW_UP_FLOOR)
  const b = await raisePriorityTo(p1, KEEP_IN_TOUCH_FLOOR)
  console.log(`Raised ${a} to P0 and ${b} to P1`)
}

main().finally(() => prisma.$disconnect())
