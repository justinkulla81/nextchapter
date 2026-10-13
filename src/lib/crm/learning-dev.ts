import type { Prisma } from '@prisma/client'

/**
 * Whether an organization has a head of L&D on file: a current contact who is
 * tagged with the LEARNING_DEV_HEAD role. Role only — matching on job titles
 * counted consultants, coaches and recruiters whose titles merely mention
 * learning or training. Removed and merged-away people never count.
 */
export const hasLearningDevHead: Prisma.CrmOrganizationWhereInput = {
  affiliations: {
    some: {
      isCurrent: true,
      person: { deletedAt: null, mergedIntoId: null, roles: { has: 'LEARNING_DEV_HEAD' } },
    },
  },
}

export const missingLearningDevHead: Prisma.CrmOrganizationWhereInput = { NOT: hasLearningDevHead }
