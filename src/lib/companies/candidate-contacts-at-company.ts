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

// Count-only, privacy-safe — never names or details, matching the existing
// "How members have fared"/insider-count aggregate pattern elsewhere on the
// Company page. Bounded to the first 500 matching rows (across ALL
// candidates, not just one) rather than a true unbounded count — a plain
// `contains` prefilter doesn't benefit from a btree index at this table's
// real size (one candidate alone can have 27,000+ imported contacts), so an
// exhaustive scan isn't worth it for a "roughly how many" stat.
export async function countOtherMembersWithContactAtCompany(
  candidateId: string,
  companyName: string
): Promise<number> {
  const normalized = normalizeOrgName(companyName)
  const prefilterToken = normalized.split(' ').find((w) => w.length >= 4) ?? normalized
  if (!prefilterToken) return 0

  const rows = await prisma.supportNetworkContact.findMany({
    where: {
      candidateId: { not: candidateId },
      removedAt: null,
      OR: [
        { company: { contains: prefilterToken, mode: 'insensitive' } },
        { inferredCompany: { contains: prefilterToken, mode: 'insensitive' } },
      ],
    },
    select: { candidateId: true, company: true, inferredCompany: true },
    take: 500,
  })

  const matchedCandidateIds = new Set(
    rows
      .filter((r) => orgNamesMatch(r.company ?? '', companyName) || orgNamesMatch(r.inferredCompany ?? '', companyName))
      .map((r) => r.candidateId)
  )
  return matchedCandidateIds.size
}

// orgNamesMatch's own containment rule (see org-name-match.ts), reimplemented
// against ALREADY-normalized strings — orgNamesMatch normalizes both inputs
// on every call, which is fine at the small scale it's normally used at, but
// turns into millions of redundant regex passes over the same handful of
// distinct company strings when cross-referencing every company (~100+)
// against every contact in the table (~30k+) below. Normalize once per
// distinct value, then reuse.
function normalizedNamesMatch(normA: string, normB: string): boolean {
  if (!normA || !normB) return false
  if (normA === normB) return true
  const tightA = normA.replace(/\s+/g, '')
  const tightB = normB.replace(/\s+/g, '')
  if (tightA.length >= 4 && tightA === tightB) return true
  if (normA.length < 4 || normB.length < 4) return false
  return normA.includes(normB) || normB.includes(normA)
}

// Distinct, pre-normalized company/inferredCompany strings from a batch of
// contact rows — the same handful of real companies recur across many rows
// (~30k rows resolve to ~19k distinct strings in production today), so
// normalizing once per distinct value instead of once per row is a real cut,
// on top of avoiding the O(companies × rows) redundant normalization below.
function distinctNormalizedCompanyStrings(rows: { company: string | null; inferredCompany: string | null }[]): string[] {
  const raw = new Set<string>()
  for (const r of rows) {
    if (r.company) raw.add(r.company)
    if (r.inferredCompany) raw.add(r.inferredCompany)
  }
  const normalized = new Set<string>()
  for (const value of raw) {
    const n = normalizeOrgName(value)
    if (n) normalized.add(n)
  }
  return Array.from(normalized)
}

// Which of the given companies has AT LEAST ONE other member with a
// personal contact there — the "NC connections (2nd degree)" filter on the
// Companies list page. Fetches every other candidate's contacts ONCE
// (~31k rows in production today) rather than one query per company, but
// only ever called when that filter is actually toggled on — not on every
// page load — since a full-table fetch on every visit isn't worth it for a
// filter most visits won't use.
export async function getCompaniesWithAnyMemberContact(
  excludeCandidateId: string,
  companyNames: string[]
): Promise<Set<string>> {
  const rows = await prisma.supportNetworkContact.findMany({
    where: { candidateId: { not: excludeCandidateId }, removedAt: null },
    select: { company: true, inferredCompany: true },
  })
  const contactNormalized = distinctNormalizedCompanyStrings(rows)

  const matched = new Set<string>()
  for (const companyName of companyNames) {
    const normCompany = normalizeOrgName(companyName)
    if (contactNormalized.some((n) => normalizedNamesMatch(n, normCompany))) {
      matched.add(companyName)
    }
  }
  return matched
}

export interface SecondDegreeConnection {
  bridge: { id: string; name: string; title: string | null }
  contactCount: number
}

// "Who do I know who knows someone here?" — a real 2-hop traversal, not an
// aggregate guess. Only follows contacts with a linkedCandidateId, which is
// admin-confirmed-only (see that field's schema comment) — a rare, curated
// subset, never inferred. For each such contact, checks whether THEY (as a
// real member in their own right) have their own contacts at this company.
//
// Deliberately returns only the bridge's identity and a COUNT of their
// contacts here — never the actual names of the bridge's contacts. Those
// belong to the bridge's own private network, not this candidate's; the
// actionable unit for "2nd degree" is "ask this person you already know",
// not browsing a stranger's contact list two hops away. Same privacy
// posture as countOtherMembersWithContactAtCompany above.
export async function getSecondDegreeContactsAtCompany(
  candidateId: string,
  companyName: string
): Promise<SecondDegreeConnection[]> {
  const ownLinkedContacts = await prisma.supportNetworkContact.findMany({
    where: { candidateId, removedAt: null, linkedCandidateId: { not: null } },
    select: { id: true, name: true, title: true, linkedCandidateId: true },
  })
  if (ownLinkedContacts.length === 0) return []

  const results = await Promise.all(
    ownLinkedContacts.map(async (bridge) => {
      const theirContactsHere = await getCandidateContactsAtCompany(bridge.linkedCandidateId!, companyName)
      return theirContactsHere.length > 0
        ? { bridge: { id: bridge.id, name: bridge.name, title: bridge.title }, contactCount: theirContactsHere.length }
        : null
    })
  )
  return results.filter((r): r is SecondDegreeConnection => r !== null)
}

// Per-company contact counts for the Companies list page — fetches the
// candidate's own contacts ONCE (bounded by their own real total, however
// large) and matches in memory against every company on the current page,
// rather than one DB round trip with a `contains` prefilter per company
// (25 round trips per page load, each re-scanning the same contact list).
// Pre-normalizes each contact row once (see normalizedNamesMatch above) —
// a candidate with a large real LinkedIn export (27,000+ rows) would
// otherwise re-normalize the same strings once per company on the page.
export async function getCandidateContactCountsByCompany(
  candidateId: string,
  companyNames: string[]
): Promise<Map<string, number>> {
  const ownContacts = await prisma.supportNetworkContact.findMany({
    where: { candidateId, removedAt: null },
    select: { company: true, inferredCompany: true },
  })
  // One entry per ROW (not per field) — a contact whose company AND
  // inferredCompany both happen to match the same target company must still
  // only count once, same as the original per-row `.filter()` semantics.
  const rowNormalized = ownContacts.map((c) => ({
    company: c.company ? normalizeOrgName(c.company) : '',
    inferredCompany: c.inferredCompany ? normalizeOrgName(c.inferredCompany) : '',
  }))

  const counts = new Map<string, number>()
  for (const companyName of companyNames) {
    const normCompany = normalizeOrgName(companyName)
    const count = rowNormalized.filter(
      (r) => normalizedNamesMatch(r.company, normCompany) || normalizedNamesMatch(r.inferredCompany, normCompany)
    ).length
    if (count > 0) counts.set(companyName, count)
  }
  return counts
}
