import type { Prisma } from '@prisma/client'

/**
 * How an organization relates to us as a business, for the Companies views.
 * Derived from what is already on the record (org types and the graduation
 * links to production records), so there is nothing extra to keep in sync and
 * one company can be several at once.
 */
export const ORG_RELATIONSHIPS = ['hiring', 'outplacement', 'search'] as const
export type OrgRelationship = (typeof ORG_RELATIONSHIPS)[number]
/** `all` is the union of the three — "companies" as opposed to funders, universities, press. */
export type OrgRelationshipFilter = OrgRelationship | 'all'

export const ORG_RELATIONSHIP_LABELS: Record<OrgRelationshipFilter, string> = {
  all: 'All companies',
  hiring: 'Hiring clients',
  outplacement: 'Outplacement',
  search: 'Search firms',
}

const WHERE: Record<OrgRelationship, Prisma.CrmOrganizationWhereInput> = {
  hiring: { hiringClient: true },
  outplacement: {
    OR: [{ orgTypes: { hasSome: ['OUTPLACEMENT_LEAD', 'OUTPLACEMENT_FIRM'] } }, { outplacementOrgId: { not: null } }],
  },
  search: { OR: [{ orgTypes: { has: 'SEARCH_FIRM' } }, { recruiterFirmId: { not: null } }] },
}

export function isOrgRelationshipFilter(v: string | undefined): v is OrgRelationshipFilter {
  return v === 'all' || (ORG_RELATIONSHIPS as readonly string[]).includes(v ?? '')
}

export function relationshipWhere(rel: OrgRelationshipFilter): Prisma.CrmOrganizationWhereInput {
  // "All companies" also takes in plain employers, which no relationship button covers.
  return rel === 'all'
    ? { OR: [{ orgTypes: { has: 'EMPLOYER' } }, ...ORG_RELATIONSHIPS.map((r) => WHERE[r])] }
    : WHERE[rel]
}
