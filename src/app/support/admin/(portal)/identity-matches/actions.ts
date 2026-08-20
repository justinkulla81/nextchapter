'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin/auth'

// Every confirm/reject here requires requireAdmin() and is invoked only
// from an admin clicking a button — same "always human-reviewed" pattern as
// bounty claims and scholarship applications. Confirming is the one place
// that actually writes the link field on the OTHER record (Reference/
// CoachClientInvite/SourcedCandidate/SupportNetworkContact); rejecting only
// ever changes this flag's own status.
export async function confirmIdentityMatch(matchId: string): Promise<void> {
  const admin = await requireAdmin()

  const match = await prisma.candidateIdentityMatch.findUnique({ where: { id: matchId } })
  if (!match || match.status !== 'PENDING') return

  try {
    switch (match.source) {
      case 'REFERENCE':
        await prisma.reference.update({
          where: { id: match.sourceRecordId, refereeCandidateId: null },
          data: { refereeCandidateId: match.candidateId },
        })
        break
      case 'COACH_INVITE':
        // updateMany, not update — candidateId is itself @unique on this
        // model, which makes Prisma's generated WhereUniqueInput reject
        // combining it as a plain filter alongside `id`. updateMany takes a
        // normal filter object instead.
        await prisma.coachClientInvite.updateMany({
          where: { id: match.sourceRecordId, candidateId: null },
          data: { candidateId: match.candidateId },
        })
        break
      case 'RECRUITER_LEAD':
        await prisma.sourcedCandidate.updateMany({
          where: { id: match.sourceRecordId, candidateId: null },
          data: { candidateId: match.candidateId },
        })
        break
      case 'CONTACT':
        await prisma.supportNetworkContact.update({
          where: { id: match.sourceRecordId, linkedCandidateId: null },
          data: { linkedCandidateId: match.candidateId },
        })
        break
    }
  } catch (error) {
    // The source record may have already been linked by a different path
    // between detection and review (e.g. the coach-invite link was clicked
    // after all) — nothing to do, just record the review outcome below.
    console.error('Failed to link identity match source record:', error)
  }

  await prisma.candidateIdentityMatch.update({
    where: { id: matchId },
    data: { status: 'CONFIRMED', reviewedBy: admin.email ?? null, reviewedAt: new Date() },
  })

  revalidatePath('/support/admin/identity-matches')
}

export async function rejectIdentityMatch(matchId: string): Promise<void> {
  const admin = await requireAdmin()

  await prisma.candidateIdentityMatch.updateMany({
    where: { id: matchId, status: 'PENDING' },
    data: { status: 'REJECTED', reviewedBy: admin.email ?? null, reviewedAt: new Date() },
  })

  revalidatePath('/support/admin/identity-matches')
}
