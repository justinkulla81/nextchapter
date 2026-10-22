import 'server-only'
import { prisma } from '@/lib/prisma'
import { careerOf } from './career'
import { effectiveJourney, getJourney } from './journey'
import { deriveLearningPaths, pathProgressOf, type LearningPath, type PathProgress } from './learning-paths'
import { ownedFunctionsFrom } from './pathway'
import { pivotOf } from './pivot'

// The member's learning paths and how far along they are. Same inputs as the weekly plan.
export async function getLearningPaths(candidateId: string): Promise<{ paths: LearningPath[]; progress: PathProgress }> {
  const [p, tr] = await Promise.all([
    prisma.candidateProfile.findUnique({
      where: { id: candidateId },
      select: { journey: true, currentJobStatus: true, journeyDetails: true, primaryFunction: true, skillsToBuild: true, aiJobLossReason: true, boardAdvisoryWillingness: true, levelRankScore: true },
    }),
    prisma.trackRecordResponse.findUnique({ where: { candidateId }, select: { functionsOwnedOutsideCore: true } }),
  ])
  if (!p) return { paths: [], progress: {} }
  const journey = effectiveJourney(p)
  const searching = !journey || getJourney(journey).searching
  return {
    paths: deriveLearningPaths({
      from: p.primaryFunction,
      pivot: searching ? pivotOf(p.journeyDetails) : null,
      career: journey === 'GROWING' || journey === 'PROMOTION' ? careerOf(p.journeyDetails) : null,
      skillsToBuild: p.skillsToBuild ?? [],
      aiJobLoss: p.aiJobLossReason === 'yes' || p.aiJobLossReason === 'partly',
      boardInterest: p.boardAdvisoryWillingness === true,
      seniorLevel: (p.levelRankScore ?? 0) >= 60,
      ownedFunctions: ownedFunctionsFrom(tr?.functionsOwnedOutsideCore),
    }),
    progress: pathProgressOf(p.journeyDetails),
  }
}
