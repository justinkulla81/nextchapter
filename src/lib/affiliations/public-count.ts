import 'server-only'
import { prisma } from '@/lib/prisma'
import { publicCount } from './public-count-rules'

// How many real members are connected to an organization, for a public page or a claim page. Counts only, never names.
//
// Who counts, the same rules the alumni networks use (src/lib/community/alumni-networks.ts):
//   - a real member: not in Confidential Search Mode, not a system or sample account
//   - a former employer is a job that has ended; current employees are never counted (it would reveal who works somewhere)
//   - "verified" means the job or school came from the member's resume, or the member confirmed it
// Under the floor (public-count-rules.ts) the answer is null and the page shows nothing.

const REAL_MEMBER = `c."confidentialSearchMode" = false AND c."isSystemAccount" = false AND c."isSampleData" = false`

/** Members who chose to connect with a workforce board. `boardIds` is the board's id plus any records folded into its page. */
export async function boardConnectionCount(boardIds: string[]): Promise<number | null> {
  if (boardIds.length === 0) return null
  try {
    const rows = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
      `SELECT COUNT(DISTINCT w."candidateId") AS n
         FROM "WorkforceBoardConnection" w JOIN "CandidateProfile" c ON c.id = w."candidateId"
        WHERE w."boardId" = ANY($1) AND w."status" = 'ACTIVE' AND ${REAL_MEMBER}`,
      boardIds,
    )
    return publicCount(Number(rows[0]?.n ?? 0))
  } catch {
    return null
  }
}

/** Former employees of a company, from resumes. */
export async function formerEmployeeCount(companyId: string): Promise<number | null> {
  try {
    const rows = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
      `SELECT COUNT(DISTINCT w."candidateId") AS n
         FROM "WorkHistoryEntry" w JOIN "CandidateProfile" c ON c.id = w."candidateId"
        WHERE w."companyId" = $1 AND w."isCurrent" = false AND (w."resumeDerived" = true OR w."verified" = true) AND ${REAL_MEMBER}`,
      companyId,
    )
    return publicCount(Number(rows[0]?.n ?? 0))
  } catch {
    return null
  }
}

/** Alumni of a school, from resumes. */
export async function alumniCount(schoolId: string): Promise<number | null> {
  try {
    const rows = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
      `SELECT COUNT(DISTINCT e."candidateId") AS n
         FROM "EducationEntry" e JOIN "CandidateProfile" c ON c.id = e."candidateId"
        WHERE e."schoolId" = $1 AND (e."resumeDerived" = true OR e."verified" = true) AND ${REAL_MEMBER}`,
      schoolId,
    )
    return publicCount(Number(rows[0]?.n ?? 0))
  } catch {
    return null
  }
}
