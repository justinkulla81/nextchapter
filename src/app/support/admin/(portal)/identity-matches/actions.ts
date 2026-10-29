'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin/auth'
import { linkIdentityMatchSource } from '@/lib/candidates/identity-match-link'

// Every confirm/reject here requires requireAdmin() and is invoked only
// from an admin clicking a button. Only look-alike-name matches reach this
// queue — exact email matches link themselves (see recordIdentityMatch).
// Confirming writes the link field on the OTHER record; rejecting only ever
// changes this flag's own status.
export async function confirmIdentityMatch(matchId: string): Promise<void> {
  const admin = await requireAdmin()

  const match = await prisma.candidateIdentityMatch.findUnique({ where: { id: matchId } })
  if (!match || match.status !== 'PENDING') return

  // A failed link (already linked by another path) still records the review.
  await linkIdentityMatchSource(match.source, match.sourceRecordId, match.candidateId)

  await prisma.candidateIdentityMatch.update({
    where: { id: matchId },
    data: { status: 'CONFIRMED', reviewedBy: admin.email ?? null, reviewedAt: new Date() },
  })

  revalidatePath('/support/admin/identity-matches')
  revalidatePath('/support/admin/crm')
  revalidatePath('/support/admin/crm/needs-completion')
}

export async function rejectIdentityMatch(matchId: string): Promise<void> {
  const admin = await requireAdmin()

  await prisma.candidateIdentityMatch.updateMany({
    where: { id: matchId, status: 'PENDING' },
    data: { status: 'REJECTED', reviewedBy: admin.email ?? null, reviewedAt: new Date() },
  })

  revalidatePath('/support/admin/identity-matches')
  revalidatePath('/support/admin/crm')
  revalidatePath('/support/admin/crm/needs-completion')
}
