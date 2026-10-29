import 'server-only'
import { prisma } from '@/lib/prisma'
import { linkInvitedCrmPerson } from '@/lib/candidates/link-invite'
import { captureServerEvent } from '@/lib/posthog/server'
import type { CandidateIdentityMatchSource, CandidateIdentityMatchStrength } from '@prisma/client'

export const AUTO_LINK_REVIEWER = 'auto: exact email match'

// Writes the link field on the OTHER record (CrmPerson/Reference/
// CoachClientInvite/SourcedCandidate/SupportNetworkContact). Shared by the
// admin's Confirm button and the automatic exact-email path. Returns false
// when the link could not be written (the source row was already linked by
// another path, or the CRM link threw) so callers can leave the flag pending.
export async function linkIdentityMatchSource(
  source: CandidateIdentityMatchSource,
  sourceRecordId: string,
  candidateId: string
): Promise<boolean> {
  try {
    switch (source) {
      case 'CRM_INVITE':
        await linkInvitedCrmPerson(sourceRecordId, candidateId)
        captureServerEvent('system', 'crm_invite_linked_to_candidate', { candidateId, personId: sourceRecordId })
        break
      case 'REFERENCE':
        await prisma.reference.update({ where: { id: sourceRecordId, refereeCandidateId: null }, data: { refereeCandidateId: candidateId } })
        break
      case 'COACH_INVITE':
        // updateMany, not update — candidateId is itself @unique on this
        // model, which makes Prisma's generated WhereUniqueInput reject
        // combining it as a plain filter alongside `id`.
        await prisma.coachClientInvite.updateMany({ where: { id: sourceRecordId, candidateId: null }, data: { candidateId } })
        break
      case 'RECRUITER_LEAD':
        await prisma.sourcedCandidate.updateMany({ where: { id: sourceRecordId, candidateId: null }, data: { candidateId } })
        break
      case 'CONTACT':
        await prisma.supportNetworkContact.update({ where: { id: sourceRecordId, linkedCandidateId: null }, data: { linkedCandidateId: candidateId } })
        break
    }
    return true
  } catch (error) {
    console.error('Failed to link identity match source record:', error)
    return false
  }
}

interface MatchDetails {
  name: string | null
  email: string | null
  company: string | null
}

// Records a match. An exact email match is the same person — it links
// straight away and is stored as already CONFIRMED, so it never reaches the
// review queue. Anything weaker (a look-alike name) stays PENDING for a
// human. The unique key means a pair already flagged or reviewed is never
// flagged, or asked about, a second time.
export async function recordIdentityMatch(
  candidateId: string,
  source: CandidateIdentityMatchSource,
  sourceRecordId: string,
  strength: CandidateIdentityMatchStrength,
  details: MatchDetails
): Promise<'auto-linked' | 'pending' | 'existing'> {
  const key = { candidateId_source_sourceRecordId: { candidateId, source, sourceRecordId } }
  if (await prisma.candidateIdentityMatch.findUnique({ where: key, select: { id: true } })) return 'existing'

  const autoLinked = strength === 'EMAIL_EXACT' && (await linkIdentityMatchSource(source, sourceRecordId, candidateId))
  await prisma.candidateIdentityMatch.upsert({
    where: key,
    update: {},
    create: {
      candidateId,
      source,
      sourceRecordId,
      strength,
      matchedName: details.name,
      matchedEmail: details.email,
      matchedCompany: details.company,
      ...(autoLinked ? { status: 'CONFIRMED', reviewedBy: AUTO_LINK_REVIEWER, reviewedAt: new Date() } : {}),
    },
  })
  return autoLinked ? 'auto-linked' : 'pending'
}
