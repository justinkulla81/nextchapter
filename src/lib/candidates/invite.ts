import 'server-only'
import { prisma } from '@/lib/prisma'
import { findSignupsForInvitedPerson } from '@/lib/candidates/lead-source'

/**
 * Marks a CRM person as invited to join NextChapter as a candidate: tags them
 * a job seeker and opens their deal on the "Job seekers" pipeline at
 * Contacted. A similar-named or same-email candidate is flagged for review
 * on their CRM record — one who signs up later (findCrmInviteMatches) or
 * one who already had (findSignupsForInvitedPerson).
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
  if (!person.candidateId) await findSignupsForInvitedPerson(personId)
  // Already has an account: the invite is how they found NextChapter. Same
  // rule as linking — outranks a guess, never an admin's own edit.
  else await prisma.candidateProfile.updateMany({
    where: { id: person.candidateId, OR: [{ leadSource: null }, { leadSourceSetBy: { in: ['auto', 'invite'] } }] },
    data: { leadSource: 'REFERRAL_ADMIN', leadSourceDetail: invitedBy, leadSourceSetBy: 'invite', leadSourceSetAt: new Date() },
  })
  return { alreadyMember: !!person.candidateId }
}
