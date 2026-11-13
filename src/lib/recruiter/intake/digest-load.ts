import 'server-only'
import { prisma } from '@/lib/prisma'
import { visibleConnectionsWhere, type TalentContext } from './visibility'
import { buildWeeklyDigest, type DigestRow, type WeeklyDigest } from './digest'
import { needsProfileRead } from './status'

export const DIGEST_MAX_ROWS = 300

// One recruiter's rows: their visible connections (bounded), then one batched read of the profiles of the people who shared status.
export async function loadWeeklyDigest(ctx: TalentContext, now = new Date()): Promise<WeeklyDigest> {
  const connections = await prisma.intakeConnection.findMany({
    where: visibleConnectionsWhere(ctx),
    select: {
      id: true,
      createdAt: true,
      pipelineStage: true,
      nextStepAt: true,
      consentScopes: true,
      intakeCandidate: { select: { fullName: true, candidateId: true } },
    },
    orderBy: { updatedAt: 'desc' },
    take: DIGEST_MAX_ROWS,
  })
  const ids = connections.filter((c) => c.intakeCandidate.candidateId && needsProfileRead(c.consentScopes)).map((c) => c.intakeCandidate.candidateId!)
  const profiles = ids.length
    ? await prisma.candidateProfile.findMany({ where: { id: { in: ids } }, select: { id: true, journeyStage: true, journeyStageChangedAt: true } })
    : []
  const byId = new Map(profiles.map((p) => [p.id, p]))
  // The new job is read only for people who landed and shared it.
  const landedIds = connections
    .filter((c) => c.consentScopes.includes('landing_details') && byId.get(c.intakeCandidate.candidateId ?? '')?.journeyStage === 'LANDED')
    .map((c) => c.intakeCandidate.candidateId!)
  const jobs = landedIds.length
    ? await prisma.workHistoryEntry.findMany({
        where: { candidateId: { in: landedIds }, isCurrent: true },
        orderBy: { startDate: 'desc' },
        select: { candidateId: true, companyName: true, roleTitle: true, startDate: true },
      })
    : []
  const jobBy = new Map<string, (typeof jobs)[number]>()
  for (const j of jobs) if (!jobBy.has(j.candidateId)) jobBy.set(j.candidateId, j)

  const rows: DigestRow[] = connections.map((c) => {
    const p = byId.get(c.intakeCandidate.candidateId ?? '')
    const j = p ? jobBy.get(c.intakeCandidate.candidateId!) : undefined
    return {
      connectionId: c.id,
      name: c.intakeCandidate.fullName,
      createdAt: c.createdAt,
      pipelineStage: c.pipelineStage,
      nextStepAt: c.nextStepAt,
      scopes: c.consentScopes,
      source: p ? { journeyStage: p.journeyStage, journeyStageChangedAt: p.journeyStageChangedAt, currentJob: j ? { companyName: j.companyName, roleTitle: j.roleTitle, startDate: j.startDate } : null } : null,
    }
  })
  return buildWeeklyDigest(rows, now)
}
