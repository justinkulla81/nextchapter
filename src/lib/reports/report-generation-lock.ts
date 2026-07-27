import 'server-only'
import { prisma } from '@/lib/prisma'

// Two near-simultaneous /dashboard loads can both read "no report exists yet"
// before either has finished generating one — this claims that window so only
// one caller proceeds. The updateMany's WHERE clause is evaluated atomically by
// Postgres, so concurrent claims can't both succeed even though this app has no
// in-process shared state to lock on (each request may hit a different
// serverless instance). Stale after this long in case a claiming invocation
// crashed or was killed before it could finish and let a retry through.
const CLAIM_STALE_MS = 10 * 60 * 1000

export async function claimReportGeneration(candidateId: string): Promise<boolean> {
  const staleThreshold = new Date(Date.now() - CLAIM_STALE_MS)
  const result = await prisma.candidateProfile.updateMany({
    where: {
      id: candidateId,
      OR: [{ reportGenerationClaimedAt: null }, { reportGenerationClaimedAt: { lt: staleThreshold } }],
    },
    data: { reportGenerationClaimedAt: new Date() },
  })
  return result.count > 0
}
