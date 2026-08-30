import 'server-only'
import { prisma } from '@/lib/prisma'
import type { ResearchLibraryItem, DigestSend, DigestAudience } from '@prisma/client'

export async function getQueuedDigestItems(): Promise<ResearchLibraryItem[]> {
  return prisma.researchLibraryItem.findMany({
    where: { digestAudiences: { isEmpty: false } },
    orderBy: { dateFound: 'desc' },
  })
}

export async function getDigestSendHistory(audience?: string): Promise<DigestSend[]> {
  return prisma.digestSend.findMany({
    where: audience ? { audience } : undefined,
    orderBy: { sentAt: 'desc' },
    take: 50,
  })
}

// Every article ever included in any send, most-recent first — a durable
// record independent of the current queue (an item can be unqueued or
// re-queued later without losing its own sent history).
export async function getSentDigestItems(): Promise<ResearchLibraryItem[]> {
  return prisma.researchLibraryItem.findMany({
    where: { sentAt: { not: null } },
    orderBy: { sentAt: 'desc' },
  })
}

export async function recordDigestSend(audience: string, recipientCount: number, itemIds: string[]): Promise<void> {
  await prisma.digestSend.create({ data: { audience, recipientCount, itemIds } })
}

// Stamps sentAt (first-sent wins) and appends to sentAudiences for every
// item included in a send that actually went out (recipientCount > 0) —
// called alongside recordDigestSend by each of the 4 send paths. This is
// also what makes getDigestNuggets self-dequeuing: once sentAt is set, an
// item drops out of the nugget pool automatically instead of repeating
// forever until an admin remembers to manually unqueue it.
export async function markItemsSent(itemIds: string[], audience: DigestAudience): Promise<void> {
  if (itemIds.length === 0) return
  const items = await prisma.researchLibraryItem.findMany({
    where: { id: { in: itemIds } },
    select: { id: true, sentAt: true, sentAudiences: true },
  })
  await Promise.all(
    items.map((item) =>
      prisma.researchLibraryItem.update({
        where: { id: item.id },
        data: {
          sentAt: item.sentAt ?? new Date(),
          sentAudiences: item.sentAudiences.includes(audience) ? undefined : { push: audience },
        },
      })
    )
  )
}

// Resolves a click event's polymorphic recipientId back to a real name for
// admin display — same per-audience model switch the unsubscribe route
// already uses (src/app/api/unsubscribe/audience/[audience]/[id]/route.ts).
export async function resolveDigestRecipientName(audience: DigestAudience, recipientId: string): Promise<string> {
  switch (audience) {
    case 'CANDIDATE': {
      const candidate = await prisma.candidateProfile.findUnique({
        where: { id: recipientId },
        select: { firstName: true, lastName: true, email: true },
      })
      if (!candidate) return 'Unknown candidate'
      return [candidate.firstName, candidate.lastName].filter(Boolean).join(' ') || candidate.email || recipientId
    }
    case 'COACH': {
      const coach = await prisma.coach.findUnique({ where: { id: recipientId }, select: { fullName: true } })
      return coach?.fullName ?? 'Unknown coach'
    }
    case 'RECRUITER': {
      const recruiter = await prisma.recruiter.findUnique({ where: { id: recipientId }, select: { fullName: true } })
      return recruiter?.fullName ?? 'Unknown recruiter'
    }
    case 'EMPLOYER': {
      const employer = await prisma.employerProfile.findUnique({
        where: { id: recipientId },
        select: { companyName: true, contactName: true },
      })
      if (!employer) return 'Unknown employer'
      return employer.contactName ? `${employer.contactName} (${employer.companyName})` : employer.companyName
    }
  }
}

export interface DigestNugget {
  id: string
  title: string | null
  url: string
  summary: string | null
}

// Queued-and-not-yet-sent-to-THIS-AUDIENCE items, most-recently-queued
// first — replaces the old bucket-only, audience-blind getDigestNugget.
// Checks sentAudiences (per-audience), not the single sentAt timestamp —
// an item queued for both Coach and Recruiter that's already gone out to
// Coach must still be eligible for Recruiter's own next send. This is what
// makes the pool self-dequeuing per audience (see markItemsSent above).
export async function getDigestNuggets(audience: DigestAudience, limit: number): Promise<DigestNugget[]> {
  return prisma.researchLibraryItem.findMany({
    where: { digestAudiences: { has: audience }, NOT: { sentAudiences: { has: audience } } },
    orderBy: { dateFound: 'desc' },
    take: limit,
    select: { id: true, title: true, url: true, summary: true },
  })
}
