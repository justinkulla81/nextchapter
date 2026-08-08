import 'server-only'
import { prisma } from '@/lib/prisma'

export async function hasSubmittedConfidentialDisclosure(candidateId: string): Promise<boolean> {
  const existing = await prisma.coachingConfidentialDisclosure.findUnique({
    where: { candidateId },
    select: { id: true },
  })
  return existing !== null
}

export async function submitConfidentialDisclosure(
  candidateId: string,
  coachId: string,
  hasDisclosure: boolean,
  disclosureText: string
): Promise<void> {
  await prisma.coachingConfidentialDisclosure.upsert({
    where: { candidateId },
    create: { candidateId, coachId, hasDisclosure, disclosureText: hasDisclosure ? disclosureText.trim() : null },
    update: { hasDisclosure, disclosureText: hasDisclosure ? disclosureText.trim() : null },
  })
}
