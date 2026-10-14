// FERPA and privacy requests. An alum can download what the college holds
// about them in NextChapter and ask for a correction or deletion; Admin ›
// Privacy requests looks someone up, exports, deletes and keeps a log. A
// deletion removes the college's record of the person (roster row and
// everything hanging off it); gifts stay for the college's books, unlinked.
// The person's own NextChapter account is theirs and isn't touched.

import 'server-only'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'

export async function memberExport(institutionId: string, memberId: string) {
  const m = await prisma.institutionMember.findFirst({
    where: { id: memberId, institutionId },
    include: {
      consents: { orderBy: { changedAt: 'asc' }, select: { scope: true, granted: true, changedAt: true, source: true } },
      transitionFlags: { select: { state: true, source: true, startedAt: true, placedAt: true, clearedAt: true } },
      checkIns: { select: { kind: true, dueAt: true, status: true, respondedAt: true, responseJson: true } },
      outreachSends: { select: { sentAt: true, openedAt: true, clickedAt: true, campaign: { select: { type: true, subject: true } } } },
      engagementEvents: { select: { type: true, caseCategory: true, points: true, occurredAt: true } },
      gifts: { select: { giftDate: true, amountCents: true, fund: true, appeal: true } },
      outcomeReports: { select: { reportedAt: true, helpedByInstitution: true, shareMilestone: true } },
      enrollments: { select: { status: true, payer: true, appliedAt: true, completedAt: true, credentialName: true, cohort: { select: { name: true, program: { select: { name: true } } } } } },
      eventRsvps: { select: { status: true, checkedInAt: true, event: { select: { title: true, startsAt: true } } } },
      caseloadAssignments: { select: { assignedAt: true, endedAt: true } },
      volunteerSignups: { select: { status: true, createdAt: true, role: { select: { title: true } } } },
      groupMemberships: { select: { role: true, group: { select: { name: true } } } },
      mentorProfile: { select: { industries: true, maxCallsPerMonth: true, isActive: true } },
    },
  })
  if (!m) return null
  const { candidateId: _c, ...rest } = m
  return { exportedAt: new Date().toISOString(), note: 'What this college holds about you in NextChapter. Your own NextChapter account data is separate and yours.', member: rest }
}

export async function findMembers(institutionId: string, q: string) {
  const term = q.trim()
  if (term.length < 3) return []
  return prisma.institutionMember.findMany({
    where: { institutionId, OR: [{ email: { contains: term, mode: 'insensitive' } }, { lastName: { contains: term, mode: 'insensitive' } }, { externalId: term }] },
    take: 10,
    select: { id: true, firstName: true, lastName: true, email: true, classYear: true, status: true, externalId: true },
  })
}

export async function openRequest(args: { institutionId: string; memberId: string; email: string; kind: 'EXPORT' | 'CORRECT' | 'DELETE'; note: string | null; requestedBy: string }) {
  const r = await prisma.dataRequest.create({ data: { ...args }, select: { id: true } })
  return r.id
}

export async function listRequests(institutionId: string) {
  return prisma.dataRequest.findMany({ where: { institutionId }, orderBy: [{ status: 'desc' }, { createdAt: 'desc' }], take: 50 })
}

export async function completeRequest(institutionId: string, id: string, by: string) {
  return (await prisma.dataRequest.updateMany({ where: { id, institutionId, status: 'OPEN' }, data: { status: 'DONE', completedBy: by, completedAt: new Date() } })).count > 0
}

// Delete the college's record of one person. Logged as a DONE request that
// keeps only the email (so the college can show it honored the request).
export async function deleteMemberRecord(args: { institutionId: string; memberId: string; by: string; requestId?: string | null }) {
  const m = await prisma.institutionMember.findFirst({ where: { id: args.memberId, institutionId: args.institutionId }, select: { id: true, email: true } })
  if (!m) return { error: 'That record is already gone.' }
  await prisma.$transaction([
    prisma.institutionGift.updateMany({ where: { memberId: m.id }, data: { memberId: null } }),
    prisma.institutionMember.delete({ where: { id: m.id } }),
    args.requestId
      ? prisma.dataRequest.update({ where: { id: args.requestId }, data: { status: 'DONE', completedBy: args.by, completedAt: new Date(), memberId: null } })
      : prisma.dataRequest.create({ data: { institutionId: args.institutionId, email: m.email, kind: 'DELETE', status: 'DONE', requestedBy: args.by, completedBy: args.by, completedAt: new Date() } }),
    prisma.dataRequest.updateMany({ where: { memberId: m.id }, data: { memberId: null } }),
  ])
  captureServerEvent(args.by, 'he_member_record_deleted', { institutionId: args.institutionId })
  return { ok: true }
}
