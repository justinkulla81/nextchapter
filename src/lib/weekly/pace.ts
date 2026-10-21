import 'server-only'
import { cache } from 'react'
import { prisma } from '@/lib/prisma'
import { isCasuallySearching } from '@/lib/scoring/search-intensity'
import { paceFor } from '@/lib/weekly/action-effort'
import { effectiveJourney, effectiveStage } from '@/lib/journey/journey'
import { isNotSearching } from '@/lib/journey/intensity'

// The pace for one member: 1 for someone looking actively, half for someone
// looking casually (open to the right thing, maybe doing fractional work).
// Scales the weekly point target everywhere it is a target: the dashboard,
// badges, emails and the weekly effort that feeds the grade.
export const getPace = cache(async (candidateId: string): Promise<number> => {
  const p = await prisma.candidateProfile.findUnique({
    where: { id: candidateId },
    select: { searchIntensity: true, jobSearchDifficultyLevel: true, journey: true, journeyStage: true, currentJobStatus: true },
  })
  // Not looking (managing a career, on a break, fractional, building something) is the light pace too.
  const light = !!p && (isNotSearching(effectiveJourney(p), effectiveStage(p)) || isCasuallySearching(p.jobSearchDifficultyLevel, p.searchIntensity))
  return paceFor(light)
})
