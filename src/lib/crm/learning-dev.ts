import type { Prisma } from '@prisma/client'

/**
 * Whether an organization has a head of L&D on file. A contact counts when
 * they are tagged with the role, or — for people added before the role
 * existed — when their current title names learning/development work and a
 * senior level. Removed and merged-away people never count.
 */
const LD_TERMS = [
  'learning', 'l&d', 'talent development', 'organizational development',
  'people development', 'employee development', 'leadership development', 'training',
]
const SENIOR_TERMS = ['head', 'director', 'vp', 'vice president', 'chief', 'svp', 'evp', 'lead', 'manager']

const contains = (t: string): Prisma.CrmAffiliationWhereInput => ({ title: { contains: t, mode: 'insensitive' } })

export const hasLearningDevHead: Prisma.CrmOrganizationWhereInput = {
  affiliations: {
    some: {
      isCurrent: true,
      person: { deletedAt: null, mergedIntoId: null },
      OR: [
        { person: { roles: { has: 'LEARNING_DEV_HEAD' } } },
        { AND: [{ OR: LD_TERMS.map(contains) }, { OR: SENIOR_TERMS.map(contains) }] },
      ],
    },
  },
}

export const missingLearningDevHead: Prisma.CrmOrganizationWhereInput = { NOT: hasLearningDevHead }
