import 'server-only'
import { prisma } from '@/lib/prisma'
import { createAdminClient } from '@/lib/supabase/admin'
import { mapFunctionInterestToJobIntent } from '@/lib/crucible/employers/function-interest'
import type { CrucibleContest } from '@prisma/client'

export interface EligibleSession {
  id: string
  email: string | null
  candidateId: string | null
}

// Same base filter as the candidate directory, optionally narrowed to the
// contest's targetFunction — a null targetFunction means open to everyone
// in the PASS + resume-share-consented pool.
export async function getEligibleCandidatesForContest(contest: CrucibleContest): Promise<EligibleSession[]> {
  return prisma.crucibleSession.findMany({
    where: {
      branch: 'PASS',
      resumeFilePath: { not: null },
      resumeShareConsent: true,
      ...(contest.targetFunction
        ? { jobIntent: mapFunctionInterestToJobIntent(contest.targetFunction) }
        : {}),
    },
    select: { id: true, email: true, candidateId: true },
  })
}

// LANDING-sourced sessions carry a real email column; NC-sourced sessions
// (already a NextChapter candidate) leave it null by design (see
// CrucibleSession.email's own schema comment) and need to be resolved via
// their real Supabase auth account instead.
export async function resolveCrucibleSessionEmail(session: EligibleSession): Promise<string | null> {
  if (session.email) return session.email
  if (!session.candidateId) return null

  const candidate = await prisma.candidateProfile.findUnique({
    where: { id: session.candidateId },
    select: { userId: true },
  })
  if (!candidate) return null

  const admin = createAdminClient()
  const { data } = await admin.auth.admin.getUserById(candidate.userId)
  return data.user?.email ?? null
}
