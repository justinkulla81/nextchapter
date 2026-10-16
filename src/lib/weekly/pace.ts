import 'server-only'
import { cache } from 'react'
import { prisma } from '@/lib/prisma'
import { isCasuallySearching } from '@/lib/scoring/search-intensity'
import { paceFor } from '@/lib/weekly/action-effort'

// The pace for one member: 1 for someone looking actively, half for someone
// looking casually (open to the right thing, maybe doing fractional work).
// Scales the weekly point target everywhere it is a target: the dashboard,
// badges, emails and the weekly effort that feeds the grade.
export const getPace = cache(async (candidateId: string): Promise<number> => {
  const p = await prisma.candidateProfile.findUnique({
    where: { id: candidateId },
    select: { searchIntensity: true, jobSearchDifficultyLevel: true },
  })
  return paceFor(p ? isCasuallySearching(p.jobSearchDifficultyLevel, p.searchIntensity) : false)
})
