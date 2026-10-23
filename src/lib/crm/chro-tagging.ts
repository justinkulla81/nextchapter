import 'server-only'
import { prisma } from '@/lib/prisma'
import { CHRO_TITLE_SQL } from './chro-titles'

/** Affiliations newer than this are looked at; older ones were tagged in the one-time backfill. */
const WINDOW_DAYS = 3

/**
 * Tags people whose current title at an employer says they run HR for the whole company
 * with the CHRO role (and the Sales goal, like every buyer role). Only recent affiliations,
 * so a role an admin removed from someone long ago does not come back. Returns how many were tagged.
 */
export async function tagNewChroTitles(): Promise<number> {
  return prisma.$executeRaw`
    WITH m AS (
      SELECT DISTINCT p.id
      FROM "CrmPerson" p
      JOIN "CrmAffiliation" af ON af."personId" = p.id AND af."isCurrent"
        AND af."createdAt" > now() - make_interval(days => ${WINDOW_DAYS})
      JOIN "CrmOrganization" o ON o.id = af."orgId" AND 'EMPLOYER' = ANY (o."orgTypes"::text[])
      WHERE p."deletedAt" IS NULL AND p."mergedIntoId" IS NULL
        AND NOT ('CHRO'::"CrmPersonRole" = ANY (p.roles))
        AND af.title ~* ${CHRO_TITLE_SQL.include}
        AND af.title !~* ${CHRO_TITLE_SQL.exclude}
    )
    UPDATE "CrmPerson" p SET
      roles = array_append(p.roles, 'CHRO'::"CrmPersonRole"),
      goals = CASE WHEN 'SALES'::"CrmGoal" = ANY (p.goals) THEN p.goals ELSE array_append(p.goals, 'SALES'::"CrmGoal") END,
      "updatedAt" = now()
    FROM m WHERE p.id = m.id
  `
}
