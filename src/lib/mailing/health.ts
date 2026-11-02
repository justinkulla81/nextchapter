import 'server-only'
import { prisma } from '@/lib/prisma'

export interface ListHealthRow {
  listId: string
  subscribed: number
  deliverable: number
  risky: number
  invalid: number
  /** Subscribed, but Hunter has never checked the address (or there is no CRM person to hold the result). */
  unchecked: number
  unsubscribed: number
  bouncedOrComplained: number
  removed: number
}

/**
 * Per list: how many addresses can be mailed and how many of those Hunter has called deliverable, risky or invalid,
 * plus who left. One query for every list.
 */
export async function listHealth(): Promise<Map<string, ListHealthRow>> {
  const rows = await prisma.$queryRaw<ListHealthRow[]>`
    select m."listId" as "listId",
      count(*) filter (where m.status = 'ACTIVE')::int as subscribed,
      count(*) filter (where m.status = 'ACTIVE' and p."emailVerifiedStatus" in ('deliverable', 'valid'))::int as deliverable,
      count(*) filter (where m.status = 'ACTIVE' and p."emailVerifiedStatus" = 'risky')::int as risky,
      count(*) filter (where m.status = 'ACTIVE' and p."emailVerifiedStatus" in ('invalid', 'undeliverable'))::int as invalid,
      count(*) filter (where m.status = 'ACTIVE' and p."emailVerifiedStatus" is null)::int as unchecked,
      count(*) filter (where m.status = 'UNSUBSCRIBED')::int as unsubscribed,
      count(*) filter (where m.status in ('BOUNCED', 'COMPLAINED'))::int as "bouncedOrComplained",
      count(*) filter (where m.status = 'REMOVED')::int as removed
    from "MailingListMember" m
    left join "CrmPerson" p on p.id = m."personId"
    group by m."listId"`
  return new Map(rows.map((r) => [r.listId, r]))
}
