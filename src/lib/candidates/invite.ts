import 'server-only'
import { prisma } from '@/lib/prisma'

/**
 * Marks a CRM person as invited to join NextChapter as a candidate: tags them
 * a job seeker and opens their deal on the "Job seekers" pipeline at
 * Contacted. When someone with a similar name or the same email signs up,
 * they're flagged on Identity Matches (see findCrmInviteMatches).
 * Idempotent — re-inviting keeps the original date.
 */
export async function markInvitedAsCandidate(personId: string, invitedBy: string): Promise<{ alreadyMember: boolean }> {
  const person = await prisma.crmPerson.findUniqueOrThrow({
    where: { id: personId },
    select: { fullName: true, roles: true, goals: true, candidateId: true, candidateInvitedAt: true },
  })
  await prisma.crmPerson.update({
    where: { id: personId },
    data: {
      candidateInvitedAt: person.candidateInvitedAt ?? new Date(),
      candidateInvitedBy: person.candidateInvitedAt ? undefined : invitedBy,
      ...(person.roles.includes('JOB_SEEKER') ? {} : { roles: { push: 'JOB_SEEKER' } }),
      ...(person.goals.includes('USER_ACQUISITION') ? {} : { goals: { push: 'USER_ACQUISITION' } }),
    },
  })

  const pipeline = await prisma.crmPipeline.findUnique({
    where: { key: 'job_seekers' },
    select: { id: true, stages: { where: { key: { in: ['contacted', 'committed'] } }, select: { id: true, key: true } } },
  })
  if (pipeline) {
    const existing = await prisma.crmOpportunity.findFirst({ where: { pipelineId: pipeline.id, primaryPersonId: personId } })
    const stage = pipeline.stages.find((s) => s.key === (person.candidateId ? 'committed' : 'contacted'))
    if (!existing && stage) {
      await prisma.crmOpportunity.create({
        data: { pipelineId: pipeline.id, stageId: stage.id, primaryPersonId: personId, title: `${person.fullName} — invited to NextChapter` },
      })
    }
  }
  return { alreadyMember: !!person.candidateId }
}
