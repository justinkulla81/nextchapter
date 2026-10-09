// One-time backfill for people who existed before the email-priority rule
// and goal derivation: raises priority for anyone with a real email
// exchange (src/lib/crm/priority-bump.ts) and fills an empty goal from the
// person's contact types (goalsForRoles). Raise-only and fill-only — it
// never lowers a priority or overwrites a goal.
//
// Dry run by default. Run (the condition lets the 'server-only' import through):
//   node --env-file=.env.local --conditions=react-server --import tsx scripts/backfill-crm-email-priority-and-goals.ts [--apply]

import { PrismaClient } from '@prisma/client'
import { goalsForRoles } from '../src/lib/crm/goals'
import { applyEmailPriorityBumps } from '../src/lib/crm/priority-bump'

const prisma = new PrismaClient()
const apply = process.argv.includes('--apply')

async function main() {
  const withEmail = await prisma.crmActivity.findMany({
    where: { type: 'EMAIL', needsReview: false, personId: { not: null } },
    distinct: ['personId'], select: { personId: true },
  })
  const ids = withEmail.map((r) => r.personId!).filter(Boolean)

  const noGoal = await prisma.crmPerson.findMany({
    where: { deletedAt: null, goals: { isEmpty: true }, roles: { isEmpty: false } },
    select: { id: true, roles: true },
  })
  const fills = noGoal.map((p) => ({ id: p.id, goals: goalsForRoles(p.roles) })).filter((p) => p.goals.length > 0)

  console.log(`${ids.length} people have email activity; ${fills.length} people have a contact type but no goal`)
  if (!apply) { console.log('Dry run — pass --apply to write.'); return }

  const bumped = await applyEmailPriorityBumps(ids)
  for (const f of fills) await prisma.crmPerson.update({ where: { id: f.id }, data: { goals: { set: f.goals } } })
  console.log(`Raised priority for ${bumped}; filled goals for ${fills.length}`)
}

main().finally(() => prisma.$disconnect())
