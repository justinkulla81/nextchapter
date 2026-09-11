import 'server-only'
import type { Prisma, CrmPersonRole, CrmLeadQuality, CrmWarmth } from '@prisma/client'
import { prisma } from '@/lib/prisma'

/**
 * A saved audience definition.
 *
 * Stored as a filter rather than a list so a DYNAMIC segment stays current —
 * "everyone I've met at a VC fund" should include the person you met last
 * week without being re-curated. PINNED segments freeze membership instead,
 * and the preview always states which kind it is, because the difference only
 * matters at the moment you press send.
 */
export interface SegmentFilter {
  roles?: CrmPersonRole[]
  quality?: CrmLeadQuality[]
  warmth?: CrmWarmth[]
  /** 'ever' requires at least one logged touch; 'never' requires none. */
  contacted?: 'ever' | 'never'
  orgTypes?: string[]
  search?: string
}

export function filterToWhere(f: SegmentFilter): Prisma.CrmPersonWhereInput {
  return {
    // No address, no broadcast — a recipient list is addresses, not people.
    email: { not: null },
    ...(f.roles?.length ? { roles: { hasSome: f.roles } } : {}),
    ...(f.quality?.length ? { leadQuality: { in: f.quality } } : {}),
    ...(f.warmth?.length ? { warmth: { in: f.warmth } } : {}),
    ...(f.contacted === 'ever' ? { lastTouchedAt: { not: null } } : {}),
    ...(f.contacted === 'never' ? { lastTouchedAt: null } : {}),
    ...(f.orgTypes?.length
      ? { affiliations: { some: { org: { orgTypes: { hasSome: f.orgTypes as never } } } } }
      : {}),
    ...(f.search
      ? {
          OR: [
            { fullName: { contains: f.search, mode: 'insensitive' } },
            { affiliations: { some: { org: { name: { contains: f.search, mode: 'insensitive' } } } } },
          ],
        }
      : {}),
  }
}

export interface Recipient {
  id: string
  fullName: string
  email: string
  org: string | null
  excluded: boolean
}

/**
 * Resolves a segment to its current recipients.
 *
 * Excluded members are returned rather than filtered out, so the preview can
 * show what it is leaving out — a recipient list that silently drops people is
 * how you discover an omission after the send.
 */
export async function resolveSegment(segmentId: string): Promise<{ kind: string; name: string; recipients: Recipient[] }> {
  const segment = await prisma.crmSegment.findUniqueOrThrow({
    where: { id: segmentId },
    include: { members: { select: { personId: true, isExcluded: true } } },
  })
  const excluded = new Set(segment.members.filter((m) => m.isExcluded).map((m) => m.personId))

  const people = segment.kind === 'PINNED'
    ? await prisma.crmPerson.findMany({
        where: {
          id: { in: segment.members.filter((m) => !m.isExcluded).map((m) => m.personId) },
          email: { not: null },
        },
        select: baseSelect,
      })
    : await prisma.crmPerson.findMany({
        where: filterToWhere((segment.filterJson ?? {}) as SegmentFilter),
        orderBy: { priorityScore: 'desc' },
        take: 2000,
        select: baseSelect,
      })

  return {
    kind: segment.kind,
    name: segment.name,
    recipients: people.map((p) => ({
      id: p.id,
      fullName: p.fullName,
      email: p.email!,
      org: p.affiliations[0]?.org.name ?? null,
      excluded: excluded.has(p.id),
    })),
  }
}

const baseSelect = {
  id: true,
  fullName: true,
  email: true,
  affiliations: { where: { isPrimary: true }, take: 1, select: { org: { select: { name: true } } } },
} satisfies Prisma.CrmPersonSelect
