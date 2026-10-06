import 'server-only'
import { prisma } from '@/lib/prisma'

/**
 * Logs a candidate's Help & feedback message on their CRM record (the one
 * mirrored from their account) as an inbound note. Never throws: the CRM is
 * a side record, and a hiccup there must not fail the candidate's message.
 */
export async function logHelpOnCrm(candidateId: string, subject: string, body: string, sourceRef: string): Promise<void> {
  try {
    const person = await prisma.crmPerson.findFirst({ where: { candidateId, deletedAt: null }, select: { id: true } })
    if (!person) return
    await prisma.crmActivity.create({
      data: {
        type: 'NOTE', direction: 'INBOUND', personId: person.id,
        subject, body, isAutoLogged: true, sourceRef,
      },
    })
  } catch (e) {
    console.error('Could not log Help & feedback on the CRM record:', e)
  }
}
