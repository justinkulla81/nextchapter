import 'server-only'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export interface OrgCommunication {
  /** Emails we sent to anyone at the organization, and emails they sent back. */
  sent: number
  received: number
  lastAt: Date | null
  lastDirection: 'OUTBOUND' | 'INBOUND' | null
  /** Someone there was written to and has not answered yet. */
  awaitingReply: boolean
}

/**
 * Email traffic with each organization on one page of the list: every logged email
 * to or from a person currently affiliated with it, plus any logged against the
 * organization itself. A person at two organizations counts at both.
 */
export async function communicationByOrg(orgIds: string[]): Promise<Map<string, OrgCommunication>> {
  const out = new Map<string, OrgCommunication>()
  if (orgIds.length === 0) return out
  const rows = await prisma.$queryRaw<{ id: string; sent: number; received: number; last_at: Date | null; last_dir: 'OUTBOUND' | 'INBOUND' | null; awaiting: boolean }[]>(Prisma.sql`
    WITH acts AS (
      SELECT a."orgId" AS org_id, a.id, a.direction, a."occurredAt"
        FROM "CrmActivity" a WHERE a.type = 'EMAIL' AND a."orgId" = ANY(${orgIds}::text[])
      UNION
      SELECT f."orgId", a.id, a.direction, a."occurredAt"
        FROM "CrmAffiliation" f JOIN "CrmActivity" a ON a."personId" = f."personId"
       WHERE a.type = 'EMAIL' AND f."isCurrent" AND f."orgId" = ANY(${orgIds}::text[])
    ), agg AS (
      SELECT org_id, count(*) FILTER (WHERE direction = 'OUTBOUND')::int AS sent, count(*) FILTER (WHERE direction = 'INBOUND')::int AS received,
             max("occurredAt") AS last_at,
             (array_agg(direction ORDER BY "occurredAt" DESC))[1] AS last_dir
        FROM acts GROUP BY org_id
    ), waiting AS (
      SELECT DISTINCT f."orgId" AS org_id FROM "CrmAffiliation" f JOIN "CrmPerson" p ON p.id = f."personId"
       WHERE f."isCurrent" AND p."deletedAt" IS NULL AND p."awaitingReplySince" IS NOT NULL AND f."orgId" = ANY(${orgIds}::text[])
    )
    SELECT agg.org_id AS id, agg.sent, agg.received, agg.last_at, agg.last_dir::text AS last_dir, (waiting.org_id IS NOT NULL) AS awaiting
      FROM agg LEFT JOIN waiting ON waiting.org_id = agg.org_id`)
  for (const r of rows) out.set(r.id, { sent: r.sent, received: r.received, lastAt: r.last_at, lastDirection: r.last_dir, awaitingReply: r.awaiting })
  return out
}

/** Organizations with any logged email to or from them or their people; `waiting` narrows to those with someone yet to reply. */
export async function orgIdsWithCommunication(waiting = false): Promise<string[]> {
  const rows = waiting
    ? await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
        SELECT DISTINCT f."orgId" AS id FROM "CrmAffiliation" f JOIN "CrmPerson" p ON p.id = f."personId"
         WHERE f."isCurrent" AND p."deletedAt" IS NULL AND p."awaitingReplySince" IS NOT NULL`)
    : await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
        SELECT "orgId" AS id FROM "CrmActivity" WHERE type = 'EMAIL' AND "orgId" IS NOT NULL
        UNION
        SELECT f."orgId" FROM "CrmAffiliation" f JOIN "CrmActivity" a ON a."personId" = f."personId" WHERE a.type = 'EMAIL' AND f."isCurrent"`)
  return rows.map((r) => r.id)
}
