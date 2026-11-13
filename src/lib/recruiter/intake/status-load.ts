import 'server-only'
import { prisma } from '@/lib/prisma'
import { buildCandidateStatus, coarseStatus, needsProfileRead, type CandidateStatusView } from './status'

// One candidate, two small reads, only when a scope allows it and the person
// has a NextChapter account.
export async function loadCandidateStatus(candidateId: string | null, scopes: readonly string[]): Promise<CandidateStatusView> {
  if (!candidateId || !needsProfileRead(scopes)) return { status: null, landing: null }
  const profile = await prisma.candidateProfile.findUnique({
    where: { id: candidateId },
    select: { journeyStage: true, journeyStageChangedAt: true },
  })
  if (!profile) return { status: null, landing: null }
  const landed = coarseStatus(profile.journeyStage) === 'LANDED' && scopes.includes('landing_details')
  const job = landed
    ? await prisma.workHistoryEntry.findFirst({
        where: { candidateId, isCurrent: true },
        orderBy: { startDate: 'desc' },
        select: { companyName: true, roleTitle: true, startDate: true },
      })
    : null
  return buildCandidateStatus(scopes, { ...profile, currentJob: job })
}
