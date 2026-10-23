import 'server-only'
import { prisma } from '@/lib/prisma'
import { pathInterestCounts, type PathInterestCounts } from '@/lib/journey/path-interest-counts'

// For partnership conversations: how many members are curious, researching or doing each thing, never who. Real members only
// (not system or sample accounts), and nobody in Confidential Search Mode. Cells under the floor come back null.
export async function getPathInterestCounts(): Promise<PathInterestCounts> {
  const rows = await prisma.candidateProfile.findMany({
    where: { isSystemAccount: false, isSampleData: false, confidentialSearchMode: false },
    select: { journeyDetails: true },
  })
  return pathInterestCounts(rows.map((r) => r.journeyDetails).filter((d) => d !== null))
}
