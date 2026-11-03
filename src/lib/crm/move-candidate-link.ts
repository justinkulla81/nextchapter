import 'server-only'
import { prisma } from '@/lib/prisma'

/**
 * Moves the CRM person linked to one candidate profile onto another, for when the first profile is about to be
 * deleted as a leftover duplicate of the second (CrmPerson.candidateId is SET NULL, so deleting it would drop the
 * link). A lead filed under the member's email keeps its history this way.
 *
 * Does nothing if the target profile already has its own CRM person, or the source has none. Writes only; it returns
 * whether a person was moved and no CRM data.
 */
export async function moveCrmPersonToCandidate(fromCandidateId: string, toCandidateId: string): Promise<boolean> {
  const alreadyLinked = await prisma.crmPerson.findFirst({ where: { candidateId: toCandidateId }, select: { id: true } })
  if (alreadyLinked) return false
  const lead = await prisma.crmPerson.findFirst({ where: { candidateId: fromCandidateId, deletedAt: null }, select: { id: true } })
  if (!lead) return false
  await prisma.crmPerson.update({ where: { id: lead.id }, data: { candidateId: toCandidateId } })
  return true
}
