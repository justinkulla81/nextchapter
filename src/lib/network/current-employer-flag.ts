import 'server-only'
import { prisma } from '@/lib/prisma'
import { orgNamesMatch } from '@/lib/text/org-name-match'

// Shared primitive for two spec surfaces that both need "does this company
// match the candidate's current employer": §4.4 Outreach ("Flag contacts
// who currently work at their employer before sending") and §4.8
// Applications ("warn before applying to their current employer or a known
// subsidiary"). Reuses orgNamesMatch, the same fuzzy-match primitive
// src/lib/network/backchannel.ts already uses for a related but different
// purpose (matching an applied job's company against network contacts,
// not the candidate's own employer).
export async function getCurrentEmployerName(candidateId: string): Promise<string | null> {
  const current = await prisma.workHistoryEntry.findFirst({
    where: { candidateId, isCurrent: true },
    orderBy: { startDate: 'desc' },
    select: { companyName: true },
  })
  return current?.companyName ?? null
}

export function companyMatchesCurrentEmployer(currentEmployerName: string | null, companyName: string | null): boolean {
  if (!currentEmployerName || !companyName) return false
  return orgNamesMatch(currentEmployerName, companyName)
}
