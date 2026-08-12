import 'server-only'
import { prisma } from '@/lib/prisma'
import { orgNamesMatch } from '@/lib/text/org-name-match'

export interface BackchannelMatch {
  job: { id: string; title: string | null; companyName: string; appliedAt: Date }
  contacts: { id: string; name: string; title: string | null; email: string | null; linkedinUrl: string | null }[]
  isNew: boolean
}

// Applied-job companies matched against the candidate's own contact list —
// "you already know someone here" is the single highest-leverage thing a
// candidate can act on for an application already in flight, and the
// contacts they already have (LinkedIn import, calendar sync, manual add)
// are the only real "who do I know here" signal this app has (no LinkedIn
// API access to search live connections).
export async function getBackchannelMatches(candidateId: string, since: Date): Promise<BackchannelMatch[]> {
  const [jobs, contacts] = await Promise.all([
    prisma.jobPosting.findMany({
      where: { candidateId, appliedAt: { not: null }, companyName: { not: null } },
      select: { id: true, title: true, companyName: true, appliedAt: true },
    }),
    prisma.supportNetworkContact.findMany({
      where: { candidateId, OR: [{ company: { not: null } }, { inferredCompany: { not: null } }] },
      select: {
        id: true,
        name: true,
        title: true,
        company: true,
        inferredCompany: true,
        createdAt: true,
        email: true,
        linkedinUrl: true,
      },
    }),
  ])

  const matches: BackchannelMatch[] = []
  for (const job of jobs) {
    if (!job.companyName) continue
    const matchedContacts = contacts.filter(
      (c) =>
        (c.company && orgNamesMatch(c.company, job.companyName!)) ||
        (c.inferredCompany && orgNamesMatch(c.inferredCompany, job.companyName!))
    )
    if (matchedContacts.length === 0) continue

    matches.push({
      job: { id: job.id, title: job.title, companyName: job.companyName, appliedAt: job.appliedAt! },
      contacts: matchedContacts.map((c) => ({
        id: c.id,
        name: c.name,
        title: c.title,
        email: c.email,
        linkedinUrl: c.linkedinUrl,
      })),
      isNew: job.appliedAt! > since || matchedContacts.some((c) => c.createdAt > since),
    })
  }

  return matches
}
