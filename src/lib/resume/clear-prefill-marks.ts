import 'server-only'
import { prisma } from '@/lib/prisma'
import type { PrefillField } from '@/lib/resume/resume-prefill'

/**
 * The member set these fields themselves (onboarding, Search Strategy, the board's
 * city prompt): drop their "From your résumé — confirm" marks so a later résumé
 * never replaces them. One statement, a no-op when none are marked. Never throws.
 */
export async function clearResumePrefillMarks(candidateId: string, fields: readonly PrefillField[]): Promise<void> {
  if (fields.length === 0) return
  const list = [...fields]
  await prisma.$executeRaw`
    UPDATE "CandidateProfile"
    SET "resumePrefilledFields" = ARRAY(SELECT f FROM unnest("resumePrefilledFields") AS f WHERE NOT (f = ANY(${list}::text[])))
    WHERE id = ${candidateId} AND "resumePrefilledFields" && ${list}::text[]
  `.catch((error) => console.error('Failed to clear résumé prefill marks:', error))
}
