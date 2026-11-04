import 'server-only'
import { prisma } from '@/lib/prisma'

const ADMIN_URL = 'https://admin.launchyournextchapter.com'

/**
 * Where to find this candidate in the CRM, for the admin's own help email: their CRM person record when one is linked (crm-sync
 * creates it), otherwise their candidate page in Web Admin. Returns only a URL, to the admin; nothing from the record. Null for
 * partner-portal senders, who are not candidates, and when the lookup fails.
 */
export async function candidateCrmUrl(candidateId: string | null): Promise<string | null> {
  if (!candidateId) return null
  try {
    const person = await prisma.crmPerson.findFirst({ where: { candidateId, deletedAt: null }, select: { id: true }, orderBy: { createdAt: 'asc' } })
    return person ? `${ADMIN_URL}/support/admin/crm/people/${person.id}` : `${ADMIN_URL}/support/admin/candidates/${candidateId}`
  } catch (error) {
    console.error('Could not look up the CRM record for a help email:', error)
    return null
  }
}
