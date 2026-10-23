import 'server-only'
import { prisma } from '@/lib/prisma'
import { getParallelPaths } from '@/lib/job-reviews/data'
import { effectiveJourney } from './journey'
import { workingNowOf } from './intensity'
import { INTEREST_LABELS, INTEREST_LEVELS, INTEREST_KEYS, effectiveLevelsOf } from './paths'

export type PathLevelView = { label: string; level: string }

// What a member is thinking about and how seriously, for their coach's pre-session brief. The caller has already passed the coach
// consent check (getCoachClient): this reads nothing the coach is not already allowed to see about the client.
export async function getPathLevelsForCoach(candidateId: string): Promise<PathLevelView[]> {
  const [p, kinds] = await Promise.all([
    prisma.candidateProfile.findUnique({ where: { id: candidateId }, select: { journey: true, journeyStage: true, currentJobStatus: true, journeyDetails: true, interimConsultingInterest: true } }),
    getParallelPaths(candidateId),
  ])
  if (!p) return []
  const levels = effectiveLevelsOf({ main: effectiveJourney(p), journeyDetails: p.journeyDetails, kinds, workingNow: workingNowOf(p.journeyDetails), interimInterest: p.interimConsultingInterest })
  return INTEREST_KEYS.flatMap((k) => (levels[k] ? [{ label: INTEREST_LABELS[k], level: INTEREST_LEVELS.find((l) => l.value === levels[k])!.label }] : []))
}
