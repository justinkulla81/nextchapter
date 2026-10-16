import 'server-only'
import { prisma } from '@/lib/prisma'
import { normalizeOrgName } from '@/lib/text/org-name-match'
import { isCircularEmailMatch } from './backchannel-circular'

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
      select: { id: true, source: true, title: true, companyName: true, appliedAt: true },
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
        source: true,
        email: true,
        linkedinUrl: true,
      },
    }),
  ])

  // orgNamesMatch re-normalizes both names on every call, which is
  // jobs x contacts normalizations for a 27k-contact member. Normalize each
  // distinct string once and apply orgNamesMatch's exact rules to the results.
  const normCache = new Map<string, string>()
  const norm = (name: string) => {
    let n = normCache.get(name)
    if (n === undefined) {
      n = normalizeOrgName(name)
      normCache.set(name, n)
    }
    return n
  }
  const normalizedMatch = (normA: string, normB: string) => {
    if (!normA || !normB) return false
    if (normA === normB) return true
    const tightA = normA.replace(/\s+/g, '')
    const tightB = normB.replace(/\s+/g, '')
    if (tightA.length >= 4 && tightA === tightB) return true
    if (normA.length < 4 || normB.length < 4) return false
    return normA.includes(normB) || normB.includes(normA)
  }
  const normalizedContacts = contacts.map((c) => ({
    contact: c,
    company: c.company ? norm(c.company) : null,
    inferredCompany: c.inferredCompany ? norm(c.inferredCompany) : null,
  }))

  const matches: BackchannelMatch[] = []
  for (const job of jobs) {
    if (!job.companyName) continue
    const jobNorm = norm(job.companyName)
    const matchedContacts = normalizedContacts
      .filter(
        (c) =>
          (c.company !== null && normalizedMatch(c.company, jobNorm)) ||
          (c.inferredCompany !== null &&
            normalizedMatch(c.inferredCompany, jobNorm) &&
            !isCircularEmailMatch({ jobSource: job.source, contactSource: c.contact.source, matchedOnlyByInference: true }))
      )
      .map((c) => c.contact)
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
