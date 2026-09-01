import 'server-only'
import type { CandidateStakeholderType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getMatchedAlumniGroups } from '@/lib/network/alumni-groups'
import { getCandidateThreads, getThreadWithMessages } from '@/lib/messaging/threads'

// The shared notes CRUD every Relationships sub-tab calls into — see
// CandidateStakeholderNote's own schema comment for why this is one
// reusable model instead of a bespoke notes field per stakeholder type.
export async function listStakeholderNotes(candidateId: string, stakeholderType: CandidateStakeholderType) {
  return prisma.candidateStakeholderNote.findMany({
    where: { candidateId, stakeholderType },
    orderBy: { createdAt: 'desc' },
  })
}

export async function addStakeholderNote(
  candidateId: string,
  stakeholderType: CandidateStakeholderType,
  body: string,
  authorAdminEmail: string,
  stakeholderId?: string | null
) {
  return prisma.candidateStakeholderNote.create({
    data: { candidateId, stakeholderType, body, authorAdminEmail, stakeholderId: stakeholderId ?? null },
  })
}

// Coach's "system info" is already fully assembled by getAdminCandidateDetail/
// getFullClientView (detail.coach, view.sessions) — deliberately no new query
// here, the caller passes that existing data straight through.

export async function getRecruiterRelationships(candidateId: string) {
  const [introductions, submissions] = await Promise.all([
    prisma.recruiterCandidateIntroduction.findMany({
      where: { candidateId },
      orderBy: { requestedAt: 'desc' },
      include: { recruiter: { select: { id: true, fullName: true, firmName: true } } },
    }),
    prisma.recruiterCandidateSubmission.findMany({
      where: { candidateId },
      orderBy: { createdAt: 'desc' },
      include: {
        recruiter: { select: { id: true, fullName: true, firmName: true } },
        placement: { select: { placedAt: true, startDate: true } },
      },
    }),
  ])
  return { introductions, submissions }
}

export async function getEmployerRelationships(candidateId: string) {
  const [interactions, conflictFlags] = await Promise.all([
    prisma.candidateInteraction.findMany({
      where: { candidateId },
      orderBy: { updatedAt: 'desc' },
      include: { employer: { select: { id: true, companyName: true } }, role: { select: { roleTitle: true } } },
    }),
    prisma.hiringConflictFlag.findMany({
      where: { candidateId },
      orderBy: { detectedAt: 'desc' },
      include: { employer: { select: { id: true, companyName: true } } },
    }),
  ])
  return { interactions, conflictFlags }
}

// candidateId here is read only for this strictly internal admin view — see
// OutplacementSeat's own schema comment: this field must never be read by
// employer-facing code (src/lib/employer/candidate-identity-guard.ts is the
// gated path for that side).
export async function getOutplacementRelationship(candidateId: string) {
  return prisma.outplacementSeat.findMany({
    where: { candidateId },
    orderBy: { enrolledAt: 'desc' },
    include: { contract: { include: { org: true } } },
  })
}

export async function getAlumniOrgMatches(candidateId: string) {
  return getMatchedAlumniGroups(candidateId)
}

// COACH/RECRUITER/EMPLOYER are the only real ThreadPartnerType values with a
// messaging channel today — Outplacement/Alumni Org have none, so callers
// for those two types should skip this and render the "no channel" state
// instead of calling in with an unsupported type.
export async function getStakeholderThreads(
  candidateId: string,
  partnerType: Extract<CandidateStakeholderType, 'COACH' | 'RECRUITER' | 'EMPLOYER'>
) {
  const threads = await getCandidateThreads(candidateId)
  const scoped = threads.filter((t) => t.partnerType === partnerType)
  const withMessages = await Promise.all(scoped.map((t) => getThreadWithMessages(t.id)))
  return withMessages.filter((t): t is NonNullable<typeof t> => !!t)
}
