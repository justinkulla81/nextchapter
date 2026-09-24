import 'server-only'
import { prisma } from '@/lib/prisma'
import { mergePersonRecords } from '@/lib/crm/merge-person'
import { syncCandidateToCrm } from '@/lib/crm/candidate-sync'

/**
 * The admin confirmed that a new candidate is someone they invited from the
 * CRM. Links the invited CrmPerson to the candidate, folds in the record the
 * CRM may already have created for them at signup (it only knew their email
 * then, not that they were invited), moves their "Job seekers" deal to
 * Signed up, and credits the admin's referral as the lead source.
 */
export async function linkInvitedCrmPerson(invitedPersonId: string, candidateId: string): Promise<void> {
  const invited = await prisma.crmPerson.findUniqueOrThrow({
    where: { id: invitedPersonId },
    select: { id: true, roles: true, goals: true, candidateInvitedAt: true, candidateInvitedBy: true, deletedAt: true, email: true, emails: true },
  })
  if (invited.deletedAt) return
  const candidate = await prisma.candidateProfile.findUniqueOrThrow({ where: { id: candidateId }, select: { email: true } })
  const signupEmail = candidate.email?.trim().toLowerCase() || null

  const autoCreated = await prisma.crmPerson.findFirst({
    where: { candidateId, deletedAt: null, id: { not: invitedPersonId } },
    select: { id: true },
  })
  if (autoCreated) {
    // mergePersonIntoPerson moves activities, sources and the rest, but not
    // deals — move those here, dropping a duplicate in a pipeline the
    // invited person already has a deal in.
    const kept = new Set(
      (await prisma.crmOpportunity.findMany({ where: { primaryPersonId: invitedPersonId }, select: { pipelineId: true } })).map((o) => o.pipelineId),
    )
    for (const opp of await prisma.crmOpportunity.findMany({ where: { primaryPersonId: autoCreated.id }, select: { id: true, pipelineId: true } })) {
      if (kept.has(opp.pipelineId)) await prisma.crmOpportunity.delete({ where: { id: opp.id } })
      else await prisma.crmOpportunity.update({ where: { id: opp.id }, data: { primaryPersonId: invitedPersonId } })
    }
    await prisma.crmPerson.update({ where: { id: autoCreated.id }, data: { candidateId: null } })
    await mergePersonRecords(autoCreated.id, invitedPersonId)
  }

  await prisma.crmPerson.update({
    where: { id: invitedPersonId },
    data: {
      candidateId,
      // The address they signed up with — an invite from LinkedIn usually
      // had none on file.
      ...(signupEmail && !invited.email ? { email: signupEmail } : {}),
      ...(signupEmail && !invited.emails.includes(signupEmail) ? { emails: { push: signupEmail } } : {}),
      ...(invited.roles.includes('JOB_SEEKER') ? {} : { roles: { push: 'JOB_SEEKER' } }),
      ...(invited.goals.includes('MEMBERSHIP_UPGRADE') ? {} : { goals: { push: 'MEMBERSHIP_UPGRADE' } }),
    },
  })

  const signedUp = await prisma.crmStage.findFirst({ where: { key: 'committed', pipeline: { key: 'job_seekers' } } })
  if (signedUp) {
    await prisma.crmOpportunity.updateMany({
      where: { primaryPersonId: invitedPersonId, pipelineId: signedUp.pipelineId, outcome: 'OPEN' },
      data: { stageId: signedUp.id },
    })
  }

  // A confirmed referral outranks any guess, but not a source the admin set
  // by hand. Only for someone you actually invited — linking a sign-up to a
  // record you merely had (a LinkedIn import) says nothing about how they
  // found NextChapter.
  if (invited.candidateInvitedAt) await prisma.candidateProfile.updateMany({
    where: { id: candidateId, OR: [{ leadSource: null }, { leadSourceSetBy: { in: ['auto', 'invite'] } }] },
    data: {
      leadSource: 'REFERRAL_ADMIN',
      leadSourceDetail: invited.candidateInvitedBy ?? 'Invited from the CRM',
      leadSourceSetBy: 'invite',
      leadSourceSetAt: new Date(),
    },
  })

  await syncCandidateToCrm(candidateId)
}
