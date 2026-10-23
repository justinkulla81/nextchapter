import type { Prisma } from '@prisma/client'

/**
 * Whether an organization has a CHRO on file: a current contact tagged with the
 * CHRO role (the head of HR for the whole company — chief human resources, chief
 * people or equivalent). Role only, the same rule as the head of L&D: matching on
 * titles also counted talent-acquisition and regional HR leads. Removed and
 * merged-away people never count.
 */
export const hasChro: Prisma.CrmOrganizationWhereInput = {
  affiliations: {
    some: {
      isCurrent: true,
      person: { deletedAt: null, mergedIntoId: null, roles: { has: 'CHRO' } },
    },
  },
}

export const missingChro: Prisma.CrmOrganizationWhereInput = { NOT: hasChro }
