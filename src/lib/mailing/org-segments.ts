import { prisma } from '@/lib/prisma'
import { ORG_SEGMENTS, segmentsFor, type OrgSegmentKey } from './org-segment-list'

export { ORG_SEGMENTS, segmentsFor, type OrgSegmentKey }

export interface PersonOrg {
  orgName: string | null
  segments: OrgSegmentKey[]
}

/** Each person's current organization (the primary one first) and the kinds all their current organizations fall in. One query, only the ids given. */
export async function loadPersonOrgs(personIds: string[]): Promise<Map<string, PersonOrg>> {
  const ids = Array.from(new Set(personIds.filter(Boolean)))
  if (ids.length === 0) return new Map()
  const people = await prisma.crmPerson.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      affiliations: { where: { isCurrent: true }, orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }], select: { org: { select: { name: true, orgTypes: true } } } },
    },
  })
  return new Map(
    people.map((p) => [
      p.id,
      {
        orgName: p.affiliations[0]?.org.name ?? null,
        segments: Array.from(new Set(p.affiliations.flatMap((a) => segmentsFor(a.org)))),
      },
    ])
  )
}
