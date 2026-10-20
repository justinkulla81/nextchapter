import 'server-only'
import { prisma } from '@/lib/prisma'
import { groupContactsByCompany, type KnownPerson } from '@/lib/jobs/find-unposted'

/**
 * The member's OWN contacts, grouped by employer (companyKey), for "who you know" on a likely opening. Same wall as
 * job-contacts.ts: only the member's own list is read, never NextChapter's CRM, and nothing here crosses to another member.
 */
export async function loadOwnContactsByCompany(candidateId: string): Promise<Map<string, KnownPerson[]>> {
  const mine = await prisma.supportNetworkContact.findMany({
    where: {
      candidateId,
      removedAt: null,
      title: { not: null },
      OR: [{ company: { not: null } }, { inferredCompany: { not: null } }],
    },
    select: { id: true, name: true, title: true, company: true, inferredCompany: true },
  })
  return groupContactsByCompany(mine)
}
