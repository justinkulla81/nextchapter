import type { CrmPersonRole, CrmPriorityTier, Prisma } from '@prisma/client'

/**
 * A group of CRM people described by what they are — contact type,
 * priority, organization, title — for adding to (or taking off) an edition
 * or a list in one go. Within a field the values are alternatives (any of
 * these types); across fields they narrow (an investor AND P0).
 */
export interface AudienceFilter {
  roles: CrmPersonRole[]
  priorities: CrmPriorityTier[]
  /** Comma-separated; matches any current organization containing one of them. */
  orgs: string
  /** Comma-separated; matches any current title containing one of them. */
  titles: string
}

export const EMPTY_AUDIENCE: AudienceFilter = { roles: [], priorities: [], orgs: '', titles: '' }

const terms = (s: string) => s.split(',').map((t) => t.trim()).filter((t) => t.length > 0).slice(0, 20)

export function isEmptyAudience(f: AudienceFilter): boolean {
  return f.roles.length === 0 && f.priorities.length === 0 && terms(f.orgs).length === 0 && terms(f.titles).length === 0
}

export function audienceWhere(f: AudienceFilter): Prisma.CrmPersonWhereInput {
  const and: Prisma.CrmPersonWhereInput[] = []
  if (f.roles.length) and.push({ roles: { hasSome: f.roles } })
  if (f.priorities.length) and.push({ priority: { in: f.priorities } })
  const orgs = terms(f.orgs)
  if (orgs.length) {
    and.push({ affiliations: { some: { isCurrent: true, OR: orgs.map((o) => ({ org: { name: { contains: o, mode: 'insensitive' as const } } })) } } })
  }
  const titles = terms(f.titles)
  if (titles.length) {
    and.push({ affiliations: { some: { isCurrent: true, OR: titles.map((t) => ({ title: { contains: t, mode: 'insensitive' as const } })) } } })
  }
  return { deletedAt: null, AND: and }
}

/** "investors (angel) · P0 or P1 · at Google, Microsoft" — for confirmations and notes. */
export function describeAudience(f: AudienceFilter, roleLabel: (r: CrmPersonRole) => string): string {
  const parts: string[] = []
  if (f.roles.length) parts.push(f.roles.map(roleLabel).join(' or '))
  if (f.priorities.length) parts.push(f.priorities.join(' or '))
  if (terms(f.orgs).length) parts.push(`at ${terms(f.orgs).join(', ')}`)
  if (terms(f.titles).length) parts.push(`titled ${terms(f.titles).join(', ')}`)
  return parts.join(' · ')
}
