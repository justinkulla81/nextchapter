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

export interface ConfidentialDisclosureDisplay {
  hasDisclosure: boolean
  disclosureText: string | null
  submittedAt: Date
}

// Resolves the candidate's confidential-disclosure answer for their coach's
// Coaching Notes view — see ConfidentialDisclosureForm, which tells the
// candidate "this stays between you and [coach]." Null until they've
// answered the (optional) question at all. hasDisclosure can be false
// (candidate chose "Nothing to share"); disclosureText is only ever
// non-null alongside hasDisclosure === true, per submitConfidentialDisclosure
// above.
export async function getConfidentialDisclosureForDisplay(
  candidateId: string
): Promise<ConfidentialDisclosureDisplay | null> {
  return prisma.coachingConfidentialDisclosure.findUnique({
    where: { candidateId },
    select: { hasDisclosure: true, disclosureText: true, submittedAt: true },
  })
}
