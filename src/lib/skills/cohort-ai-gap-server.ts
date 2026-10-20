import 'server-only'
import { prisma } from '@/lib/prisma'
import { skillTerms } from '@/lib/profile/skill-matrix'
import { computeCohortAiGap, type CohortAiGap } from '@/lib/skills/cohort-ai-gap'

/**
 * The AI-skill gap for a group of members (ids come from the caller's own scoped seats or
 * alumni, never from the request). Null when fewer than MIN_COHORT can be counted, or when
 * it can't be computed: a report must never fail because this did.
 */
export async function loadCohortAiGap(candidateIds: string[]): Promise<CohortAiGap | null> {
  if (candidateIds.length === 0) return null
  try {
    const rows = await prisma.candidateProfile.findMany({
      where: { id: { in: candidateIds } },
      select: { primaryFunction: true, resumeKeywords: true, confirmedSkillsHave: true, certifications: true, skillLevels: true },
    })
    return computeCohortAiGap(rows.map((r) => ({ fn: r.primaryFunction, keywords: skillTerms(r) })))
  } catch (error) {
    console.error('Could not compute cohort AI gap', error)
    return null
  }
}
