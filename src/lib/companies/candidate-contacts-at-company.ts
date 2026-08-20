import 'server-only'
import type { SupportNetworkContact } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { orgNamesMatch, normalizeOrgName } from '@/lib/text/org-name-match'

// The candidate's own SupportNetworkContact rows at a given company — "your
// contacts here" on the Company page. SupportNetworkContact has no
// normalized company column (unlike WorkHistoryEntry), so matching happens
// at read time via the same loose orgNamesMatch() used everywhere else, not
// exact string equality — "Jobs for the Future (JFF)" and "Jobs for the
// Future" both resolve here for the same company. A cheap DB-level
// `contains` prefilter (the first meaningful word of the company name)
// keeps this from scanning a candidate's entire contact list in memory —
// some candidates have 27,000+ rows from a real LinkedIn export.
export async function getCandidateContactsAtCompany(
  candidateId: string,
  companyName: string
): Promise<SupportNetworkContact[]> {
  const normalized = normalizeOrgName(companyName)
  const prefilterToken = normalized.split(' ').find((w) => w.length >= 4) ?? normalized

  const candidates = prefilterToken
    ? await prisma.supportNetworkContact.findMany({
        where: {
          candidateId,
          removedAt: null,
          OR: [
            { company: { contains: prefilterToken, mode: 'insensitive' } },
            { inferredCompany: { contains: prefilterToken, mode: 'insensitive' } },
          ],
        },
      })
    : []

  return candidates.filter(
    (c) => orgNamesMatch(c.company ?? '', companyName) || orgNamesMatch(c.inferredCompany ?? '', companyName)
  )
}
