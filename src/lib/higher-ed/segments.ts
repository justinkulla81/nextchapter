// Saved audiences for outreach ("laid off in the last 90 days, class of
// 2000–2010, Pittsburgh"). Filters are the college's own roster fields plus
// in-transition (the flag the alum opened) and metro (only for joined alumni,
// from their profile). Every segment still skips do-not-contact, opted-out
// and suppressed addresses.

import 'server-only'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export type SegmentFilters = {
  classFrom?: number | null
  classTo?: number | null
  joined?: 'joined' | 'not_joined' | null
  majors?: string[]
  employerContains?: string | null
  inTransition?: boolean
  metro?: string | null
  includeLearners?: boolean
}

export function parseFilters(json: unknown): SegmentFilters {
  const f = (json ?? {}) as Record<string, unknown>
  const int = (v: unknown) => (typeof v === 'number' && Number.isInteger(v) ? v : null)
  return {
    classFrom: int(f.classFrom),
    classTo: int(f.classTo),
    joined: f.joined === 'joined' || f.joined === 'not_joined' ? f.joined : null,
    majors: Array.isArray(f.majors) ? f.majors.filter((m): m is string => typeof m === 'string').slice(0, 20) : [],
    employerContains: typeof f.employerContains === 'string' && f.employerContains.trim() ? f.employerContains.trim().slice(0, 80) : null,
    inTransition: f.inTransition === true,
    metro: typeof f.metro === 'string' && f.metro.trim() ? f.metro.trim() : null,
    includeLearners: f.includeLearners === true,
  }
}

export function segmentWhere(institutionId: string, f: SegmentFilters): Prisma.InstitutionMemberWhereInput {
  const and: Prisma.InstitutionMemberWhereInput[] = [
    { institutionId, status: { not: 'OPTED_OUT' }, doNotContact: false, emailSuppressedAt: null },
    { affiliation: { in: f.includeLearners ? ['ALUM', 'STAFF_ALUM', 'LEARNER'] : ['ALUM', 'STAFF_ALUM'] } },
  ]
  if (f.classFrom) and.push({ classYear: { gte: f.classFrom } })
  if (f.classTo) and.push({ classYear: { lte: f.classTo } })
  if (f.joined === 'joined') and.push({ status: { in: ['CLAIMED', 'ACTIVE'] } })
  if (f.joined === 'not_joined') and.push({ status: { in: ['IMPORTED', 'INVITED'] } })
  if (f.majors?.length) and.push({ major: { in: f.majors } })
  if (f.employerContains) and.push({ lastKnownEmployer: { contains: f.employerContains, mode: 'insensitive' } })
  if (f.inTransition) and.push({ transitionFlags: { some: { openFlagMemberId: { not: null } } } })
  if (f.metro) and.push({ candidate: { metroArea: f.metro } })
  return { AND: and }
}

export function describeFilters(f: SegmentFilters): string {
  const parts = [
    f.classFrom || f.classTo ? `class of ${f.classFrom ?? '…'}–${f.classTo ?? '…'}` : null,
    f.joined === 'joined' ? 'joined' : f.joined === 'not_joined' ? 'not joined yet' : null,
    f.majors?.length ? f.majors.join(', ') : null,
    f.employerContains ? `works at “${f.employerContains}”` : null,
    f.inTransition ? 'in transition' : null,
    f.metro ? f.metro : null,
    f.includeLearners ? 'including program learners' : null,
  ].filter(Boolean)
  return parts.length ? parts.join(' · ') : 'All alumni'
}

export async function listSegments(institutionId: string) {
  const rows = await prisma.segment.findMany({ where: { institutionId }, orderBy: { name: 'asc' }, select: { id: true, name: true, filters: true } })
  return Promise.all(
    rows.map(async (r) => {
      const f = parseFilters(r.filters)
      return { id: r.id, name: r.name, filters: f, description: describeFilters(f), count: await prisma.institutionMember.count({ where: segmentWhere(institutionId, f) }) }
    }),
  )
}

export async function saveSegment(institutionId: string, name: string, filters: SegmentFilters, createdBy: string) {
  const s = await prisma.segment.create({ data: { institutionId, name: name.slice(0, 80), filters: filters as Prisma.InputJsonValue, createdBy }, select: { id: true } })
  return s.id
}

export async function deleteSegment(institutionId: string, id: string) {
  return (await prisma.segment.deleteMany({ where: { id, institutionId } })).count > 0
}

export async function segmentFilterFor(institutionId: string, id: string): Promise<SegmentFilters | null> {
  const s = await prisma.segment.findFirst({ where: { id, institutionId }, select: { filters: true } })
  return s ? parseFilters(s.filters) : null
}

// What the segment builder offers: majors on the roster, metros of joined alumni.
export async function segmentOptions(institutionId: string) {
  const [majors, metros] = await Promise.all([
    prisma.institutionMember.groupBy({ by: ['major'], where: { institutionId, major: { not: null } }, _count: { _all: true }, orderBy: { _count: { major: 'desc' } }, take: 30 }),
    prisma.candidateProfile.groupBy({ by: ['metroArea'], where: { institutionMemberships: { some: { institutionId } }, metroArea: { not: null } }, _count: { _all: true }, orderBy: { metroArea: 'asc' }, take: 30 }),
  ])
  return { majors: majors.map((m) => m.major!).filter(Boolean), metros: metros.map((m) => m.metroArea!).filter(Boolean) }
}
