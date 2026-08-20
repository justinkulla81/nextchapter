import 'server-only'
import { prisma } from '@/lib/prisma'
import { orgNamesMatch } from '@/lib/text/org-name-match'
import type { CandidateIdentityMatchSource, CandidateIdentityMatchStrength } from '@prisma/client'

function normalizePersonName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

interface MatchDetails {
  name: string | null
  email: string | null
  company: string | null
}

async function flagMatch(
  candidateId: string,
  source: CandidateIdentityMatchSource,
  sourceRecordId: string,
  strength: CandidateIdentityMatchStrength,
  details: MatchDetails
): Promise<void> {
  await prisma.candidateIdentityMatch.upsert({
    where: { candidateId_source_sourceRecordId: { candidateId, source, sourceRecordId } },
    update: {},
    create: {
      candidateId,
      source,
      sourceRecordId,
      strength,
      matchedName: details.name,
      matchedEmail: details.email,
      matchedCompany: details.company,
    },
  })
}

// Runs once, right after a candidate's email is confirmed
// (syncRegistrationCompletion) — checks whether this real person already
// exists elsewhere as a reference, a coach/recruiter invite lead, or
// someone else's outreach/LinkedIn contact, and flags every match for
// admin review. Never links anything itself — see CandidateIdentityMatch's
// schema comment for why even an exact email match still requires a click.
export async function findIdentityMatchesForCandidate(
  candidateId: string,
  email: string,
  fullName: string | null
): Promise<void> {
  const [references, coachInvites, sourcedLeads, contacts] = await Promise.all([
    prisma.reference.findMany({
      where: { refereeEmail: { equals: email, mode: 'insensitive' }, refereeCandidateId: null },
      select: { id: true, refereeName: true, refereeEmail: true },
    }),
    prisma.coachClientInvite.findMany({
      where: { invitedEmail: { equals: email, mode: 'insensitive' }, candidateId: null },
      select: { id: true, invitedName: true, invitedEmail: true },
    }),
    prisma.sourcedCandidate.findMany({
      where: { email: { equals: email, mode: 'insensitive' }, candidateId: null },
      select: { id: true, name: true, email: true },
    }),
    prisma.supportNetworkContact.findMany({
      where: {
        OR: [{ email: { equals: email, mode: 'insensitive' } }, { emails: { has: email } }],
        linkedCandidateId: null,
        candidateId: { not: candidateId },
        removedAt: null,
      },
      select: { id: true, name: true, email: true, company: true },
    }),
  ])

  await Promise.all([
    ...references.map((r) =>
      flagMatch(candidateId, 'REFERENCE', r.id, 'EMAIL_EXACT', { name: r.refereeName, email: r.refereeEmail, company: null })
    ),
    ...coachInvites.map((c) =>
      flagMatch(candidateId, 'COACH_INVITE', c.id, 'EMAIL_EXACT', { name: c.invitedName, email: c.invitedEmail, company: null })
    ),
    ...sourcedLeads.map((s) =>
      flagMatch(candidateId, 'RECRUITER_LEAD', s.id, 'EMAIL_EXACT', { name: s.name, email: s.email, company: null })
    ),
    ...contacts.map((c) =>
      flagMatch(candidateId, 'CONTACT', c.id, 'EMAIL_EXACT', { name: c.name, email: c.email, company: c.company })
    ),
  ])

  // Fuzzy pass — CONTACT only, since it's the one source with real
  // work-history-comparable data (company). Requires BOTH an exact
  // (normalized) name match AND real overlap with this candidate's own
  // WorkHistoryEntry companies — deliberately conservative: name alone is
  // far too common to flag on its own.
  if (!fullName) return
  const workHistory = await prisma.workHistoryEntry.findMany({ where: { candidateId }, select: { companyName: true } })
  if (workHistory.length === 0) return

  const alreadyFlaggedContactIds = new Set(contacts.map((c) => c.id))
  const normName = normalizePersonName(fullName)
  const nameCandidates = await prisma.supportNetworkContact.findMany({
    where: {
      name: { equals: fullName, mode: 'insensitive' },
      linkedCandidateId: null,
      candidateId: { not: candidateId },
      removedAt: null,
    },
    select: { id: true, name: true, company: true, inferredCompany: true },
  })

  for (const contact of nameCandidates) {
    if (alreadyFlaggedContactIds.has(contact.id)) continue
    if (normalizePersonName(contact.name) !== normName) continue
    const matchedCompany = workHistory.find(
      (w) => orgNamesMatch(w.companyName, contact.company ?? '') || orgNamesMatch(w.companyName, contact.inferredCompany ?? '')
    )
    if (matchedCompany) {
      await flagMatch(candidateId, 'CONTACT', contact.id, 'FUZZY_NAME_WORK_LOCATION', {
        name: contact.name,
        email: null,
        company: contact.company ?? contact.inferredCompany,
      })
    }
  }
}
