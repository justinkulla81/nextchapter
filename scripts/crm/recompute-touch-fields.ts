/**
 * Recomputes every person's derived touch fields from the activity log.
 *
 * Two reasons this exists as a one-shot: the CRM cutoff changed what counts
 * as an interaction (see src/lib/crm/cutoff.ts), and a backfill that ran out
 * of request time could leave a person with real mail logged and a touch
 * count of zero — the "never contacted" bug this was written to clear.
 *
 * Works off the activity log rather than looping people: only someone who
 * has activities, or who currently claims a touch, can possibly change, and
 * that is a few hundred rows rather than every person in the CRM.
 *
 * Idempotent and derived-only: it writes nothing that cannot be recomputed
 * from CrmActivity, and deletes nothing.
 *
 *   npm run crm:touch-fields          — report what would change
 *   npm run crm:touch-fields -- --write
 */
import { PrismaClient } from '@prisma/client'
import { CRM_ACTIVITY_CUTOFF } from '../../src/lib/crm/cutoff'

const prisma = new PrismaClient()
const WRITE = process.argv.includes('--write')
const BOOKKEEPING = ['FIELD_CHANGED', 'STAGE_CHANGED']

async function main() {
  console.log(`cutoff ${CRM_ACTIVITY_CUTOFF.toISOString()} · ${WRITE ? 'WRITING' : 'dry run'}`)

  const [activities, claimed] = await Promise.all([
    prisma.crmActivity.findMany({
      where: { type: { notIn: BOOKKEEPING }, occurredAt: { gte: CRM_ACTIVITY_CUTOFF } },
      select: { personId: true, occurredAt: true, direction: true },
    }),
    prisma.crmPerson.findMany({
      where: { OR: [{ touchCount: { gt: 0 } }, { lastTouchedAt: { not: null } }] },
      select: { id: true },
    }),
  ])

  type Agg = { count: number; first: Date; last: Date; lastDirection: string; firstInbound: Date | null }
  const byPerson = new Map<string, Agg>()
  for (const a of activities) {
    if (!a.personId) continue
    const cur = byPerson.get(a.personId)
    if (!cur) {
      byPerson.set(a.personId, {
        count: 1, first: a.occurredAt, last: a.occurredAt, lastDirection: a.direction,
        firstInbound: a.direction === 'INBOUND' ? a.occurredAt : null,
      })
      continue
    }
    cur.count++
    if (a.occurredAt < cur.first) cur.first = a.occurredAt
    if (a.occurredAt > cur.last) { cur.last = a.occurredAt; cur.lastDirection = a.direction }
    if (a.direction === 'INBOUND' && (!cur.firstInbound || a.occurredAt < cur.firstInbound)) {
      cur.firstInbound = a.occurredAt
    }
  }

  // Everyone with real activity, plus anyone currently claiming a touch they
  // may no longer be entitled to now that the cutoff applies.
  const ids = new Set<string>([...byPerson.keys(), ...claimed.map((p) => p.id)])
  const people = await prisma.crmPerson.findMany({
    where: { id: { in: [...ids] } },
    select: { id: true, fullName: true, touchCount: true, lastTouchedAt: true, awaitingReplySince: true },
  })
  console.log(`${people.length} candidate ${people.length === 1 ? 'person' : 'people'}\n`)

  let changed = 0
  for (const p of people) {
    const agg = byPerson.get(p.id)
    const nextCount = agg?.count ?? 0
    const nextLast = agg?.last ?? null
    const nextAwaiting = agg?.lastDirection === 'OUTBOUND' ? agg.last : null
    if (
      nextCount === p.touchCount &&
      nextLast?.getTime() === p.lastTouchedAt?.getTime() &&
      nextAwaiting?.getTime() === p.awaitingReplySince?.getTime()
    ) continue

    changed++
    console.log(
      `${p.fullName}: touches ${p.touchCount} → ${nextCount}, ` +
      `last ${p.lastTouchedAt?.toISOString().slice(0, 10) ?? 'never'} → ${nextLast?.toISOString().slice(0, 10) ?? 'never'}`
    )
    if (WRITE) {
      await prisma.crmPerson.update({
        where: { id: p.id },
        data: {
          touchCount: nextCount,
          lastTouchedAt: nextLast,
          firstTouchedAt: agg?.first ?? null,
          firstRepliedAt: agg?.firstInbound ?? null,
          // If the last thing that happened was ours, we are the ones waiting.
          // Omitting this is why people whose only activity was an outbound
          // email showed no "waiting on them" badge after the first recompute.
          awaitingReplySince: agg?.lastDirection === 'OUTBOUND' ? agg.last : null,
        },
      })
    }
  }

  console.log(`\n${changed} ${changed === 1 ? 'person' : 'people'} ${WRITE ? 'updated' : 'would change'}.`)
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
