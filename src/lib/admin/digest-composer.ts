import 'server-only'
import { prisma } from '@/lib/prisma'
import type { ResearchLibraryItem, DigestSend, ResearchBucket } from '@prisma/client'

export async function getQueuedDigestItems(): Promise<ResearchLibraryItem[]> {
  return prisma.researchLibraryItem.findMany({
    where: { queuedForDigest: true },
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

export async function recordDigestSend(audience: string, recipientCount: number, itemIds: string[]): Promise<void> {
  await prisma.digestSend.create({ data: { audience, recipientCount, itemIds } })
}

export interface DigestNugget {
  id: string
  title: string | null
  url: string
  summary: string | null
}

// Most-recently-queued item in a given bucket — shared, non-personalized
// content, safe to reuse across every recipient in a given audience's send.
export async function getDigestNugget(bucket: ResearchBucket): Promise<DigestNugget | null> {
  return prisma.researchLibraryItem.findFirst({
    where: { bucket, queuedForDigest: true },
    orderBy: { dateFound: 'desc' },
    select: { id: true, title: true, url: true, summary: true },
  })
}
