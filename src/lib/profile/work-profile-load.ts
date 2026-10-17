import 'server-only'
import { prisma } from '@/lib/prisma'
import { workProfile, type WorkProfile } from './work-profile'

// Everything workProfile() reads for one person, in one round of queries.
// Tables that may not exist yet (deploy before DDL) read as missing.
export async function loadWorkProfile(candidateId: string): Promise<WorkProfile> {
  const safe = async <T,>(p: Promise<T>): Promise<T | null> => {
    try {
      return await p
    } catch {
      return null
    }
  }
  const [profile, assessment, needs, track, pref] = await Promise.all([
    prisma.candidateProfile.findUniqueOrThrow({
      where: { id: candidateId },
      select: {
        workStyleAnswers: true,
        remotePreference: true,
        creativityConfidence: true,
        managementSkillConfidence: true,
        isPeopleManager: true,
        equityImportant: true,
        priorityJobSecurity: true,
        priorityMaxComp: true,
        priorityWorkLife: true,
      },
    }),
    safe(prisma.candidateAssessmentResponse.findFirst({ where: { candidateId }, orderBy: { completedAt: 'desc' }, select: { dimensionVectors: true } })),
    safe(prisma.whatINeedResponse.findUnique({ where: { candidateId }, select: { itemRatings: true } })),
    safe(prisma.trackRecordResponse.findUnique({ where: { candidateId }, select: { largestTeamManaged: true, droveOutcomesThroughOthers: true } })),
    safe(prisma.pivotPreference.findUnique({ where: { candidateId }, select: { peopleEnergy: true } })),
  ])
  const raw = (assessment?.dimensionVectors ?? {}) as Record<string, unknown>
  // The archived instrument scored -2..+2; the current one -1..+1.
  const vectors = Object.fromEntries(Object.entries(raw).filter(([, x]) => typeof x === 'number').map(([k, x]) => [k, Math.abs(x as number) > 1 ? (x as number) / 2 : (x as number)]))
  const ratings = Array.isArray(needs?.itemRatings) ? Object.fromEntries((needs!.itemRatings as { itemId: string; rating: number }[]).map((r) => [r.itemId, r.rating])) : null
  const energy = pref?.peopleEnergy
  return workProfile({
    ...profile,
    vectors,
    needs: ratings,
    peopleEnergy: energy === 'HIGH' || energy === 'SOME' || energy === 'LOW' ? energy : null,
    largestTeamManaged: track?.largestTeamManaged ?? null,
    droveOutcomesThroughOthers: track?.droveOutcomesThroughOthers ?? null,
  })
}
