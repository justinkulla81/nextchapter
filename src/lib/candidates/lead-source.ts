import 'server-only'
import type { CandidateLeadSource } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { classifyTrafficSource } from '@/lib/marketing/classify-traffic-source'
import { namesLookAlike } from '@/lib/text/person-name-match'
import { recordReferral } from '@/lib/candidates/referral'
import { recordIdentityMatch } from '@/lib/candidates/identity-match-link'

export const LEAD_SOURCE_LABELS: Record<CandidateLeadSource, string> = {
  REFERRAL_ADMIN: 'Referral — you',
  REFERRAL_OTHER: 'Referral — someone else',
  LINKEDIN: 'LinkedIn',
  SEARCH: 'Search / AI answer',
  SOCIAL: 'Other social',
  EMAIL: 'Email / newsletter',
  COACH: 'Coach invite',
  RECRUITER: 'Recruiter invite',
  OUTPLACEMENT: 'Outplacement seat',
  ORGANIC: 'Organic / direct',
  HIGHER_ED: 'Higher-ed referral',
  CONTACT_FORM: 'Contact form',
  INVITE_LINK: 'Referral link',
  OTHER: 'Other',
}
export const LEAD_SOURCES = Object.keys(LEAD_SOURCE_LABELS) as CandidateLeadSource[]

// classifyTrafficSource's labels, bucketed into lead sources.
const TRAFFIC_TO_LEAD: Record<string, CandidateLeadSource> = {
  LinkedIn: 'LINKEDIN',
  Google: 'SEARCH', Bing: 'SEARCH', ChatGPT: 'SEARCH', Perplexity: 'SEARCH', Gemini: 'SEARCH', Copilot: 'SEARCH',
  Facebook: 'SOCIAL', Instagram: 'SOCIAL', 'Twitter/X': 'SOCIAL', Reddit: 'SOCIAL', YouTube: 'SOCIAL',
  Email: 'EMAIL',
  Direct: 'ORGANIC',
}

/**
 * Best guess at how a candidate found NextChapter, from real signals only,
 * strongest first: an invite that brought them (coach, recruiter, an
 * outplacement seat), then the referrer of their first visit before
 * signing up. Never overwrites a source already set — a referral the admin
 * confirmed, or an admin's own edit, always outranks a guess.
 */
export async function inferLeadSource(candidateId: string): Promise<void> {
  const candidate = await prisma.candidateProfile.findUnique({
    where: { id: candidateId },
    select: {
      leadSource: true, signupIp: true, createdAt: true, registrationCompletedAt: true,
      email: true,
      sourcedCandidate: { select: { recruiterId: true, recruiter: { select: { fullName: true } } } },
      outplacementSeats: { take: 1, select: { contract: { select: { org: { select: { name: true } } } } } },
    },
  })
  if (!candidate || candidate.leadSource) return
  // CoachClientInvite.candidateId is a bare id (no relation), so it's a separate lookup.
  const coachInvite = await prisma.coachClientInvite.findUnique({
    where: { candidateId }, select: { coachId: true, coach: { select: { fullName: true } } },
  })

  let source: CandidateLeadSource | null = null
  let detail: string | null = null
  if (coachInvite) {
    source = 'COACH'; detail = coachInvite.coach.fullName
    await recordReferral({ candidateId, kind: 'COACH', channel: 'INVITE_LINK', setBy: 'auto', referrerName: detail, referrerCoachId: coachInvite.coachId })
  } else if (candidate.sourcedCandidate) {
    source = 'RECRUITER'; detail = candidate.sourcedCandidate.recruiter.fullName
    await recordReferral({ candidateId, kind: 'RECRUITER', channel: 'INVITE_LINK', setBy: 'auto', referrerName: detail, referrerRecruiterId: candidate.sourcedCandidate.recruiterId })
  } else if (candidate.outplacementSeats[0]) {
    source = 'OUTPLACEMENT'; detail = candidate.outplacementSeats[0].contract.org.name
  } else if (candidate.email && (await prisma.contactSubmission.findFirst({ where: { email: { equals: candidate.email, mode: 'insensitive' } }, select: { id: true } }))) {
    // They wrote to us through the contact form before signing up.
    source = 'CONTACT_FORM'
  } else {
    // First marketing-site visit from this person before they signed up —
    // matched by their own session when they were logged in, otherwise by
    // the IP they signed up from.
    const until = candidate.registrationCompletedAt ?? new Date()
    const visits = await prisma.homepageVisitEvent.findMany({
      where: {
        eventType: 'PAGE_VIEW',
        createdAt: { lte: until },
        OR: [{ candidateId }, ...(candidate.signupIp ? [{ ip: candidate.signupIp }] : [])],
      },
      orderBy: { createdAt: 'asc' },
      take: 50,
      select: { path: true, referrer: true },
    })
    let cameBackViaOurEmail = false
    for (const v of visits) {
      // A click from one of our own welcome or reminder emails (utm_source=lead_email) says how they came
      // back, not how they found us: look past it for the first real visit.
      if (v.path?.includes('utm_source=lead_email')) {
        cameBackViaOurEmail = true
        continue
      }
      const label = classifyTrafficSource(v.path, v.referrer)
      if (label === 'Internal') continue
      source = TRAFFIC_TO_LEAD[label] ?? 'OTHER'
      detail = source === 'OTHER' || source === 'SEARCH' || source === 'SOCIAL' ? label : null
      break
    }
    if (!source && cameBackViaOurEmail) {
      source = 'EMAIL'
      detail = 'Website lead: came back through our welcome or reminder email'
    }
  }
  if (!source) return

  await prisma.candidateProfile.updateMany({
    where: { id: candidateId, leadSource: null },
    data: { leadSource: source, leadSourceDetail: detail, leadSourceSetBy: 'auto', leadSourceSetAt: new Date() },
  })
}

/**
 * Flags every unlinked CRM person whose email or name resembles this new
 * candidate's — people you invited above all, but anyone already in the CRM.
 * An exact email match is the same person and links automatically; a
 * look-alike name is flagged for review on the Review List (and Identity
 * Matches). Returns how many were left for review.
 */
export async function findCrmInviteMatches(candidateId: string): Promise<number> {
  const candidate = await prisma.candidateProfile.findUnique({
    where: { id: candidateId },
    select: { firstName: true, lastName: true, email: true, isSampleData: true, isSystemAccount: true },
  })
  if (!candidate || candidate.isSampleData || candidate.isSystemAccount) return 0
  const fullName = [candidate.firstName, candidate.lastName].filter(Boolean).join(' ').trim()
  const email = candidate.email?.trim().toLowerCase() || null
  if (!fullName && !email) return 0

  // Everyone in the CRM not already tied to an account — invited or not. A
  // sign-up that resembles someone you already track (a LinkedIn import, an
  // advisor) is a merge to review, not a new person; when in doubt it goes
  // to the Review List rather than being guessed either way.
  const people = await prisma.crmPerson.findMany({
    where: { deletedAt: null, candidateId: null },
    select: { id: true, fullName: true, email: true, emails: true, affiliations: { where: { isPrimary: true }, take: 1, select: { org: { select: { name: true } } } } },
  })

  let flagged = 0
  for (const p of people) {
    const emailHit = !!email && (p.email?.toLowerCase() === email || p.emails.some((e) => e.toLowerCase() === email))
    const nameHit = !!fullName && namesLookAlike(fullName, p.fullName)
    if (!emailHit && !nameHit) continue
    const outcome = await recordIdentityMatch(candidateId, 'CRM_INVITE', p.id, emailHit ? 'EMAIL_EXACT' : 'NAME_SIMILAR', {
      name: p.fullName, email: p.email, company: p.affiliations[0]?.org.name ?? null,
    })
    if (outcome === 'pending') flagged++
  }
  return flagged
}

/**
 * The other direction: someone flagged as invited AFTER they'd already
 * signed up (you invited them on LinkedIn, then marked it in the CRM once
 * they'd joined). findCrmInviteMatches only runs at signup, so it never saw
 * them — this checks existing candidates when the flag is set. Same bar:
 * an exact email links automatically, a look-alike name is flagged for review.
 */
export async function findSignupsForInvitedPerson(personId: string): Promise<number> {
  const person = await prisma.crmPerson.findUnique({
    where: { id: personId },
    select: { fullName: true, email: true, emails: true, candidateId: true, deletedAt: true, affiliations: { where: { isPrimary: true }, take: 1, select: { org: { select: { name: true } } } } },
  })
  if (!person || person.deletedAt || person.candidateId) return 0
  const emails = new Set([person.email, ...person.emails].filter(Boolean).map((e) => e!.trim().toLowerCase()))

  const candidates = await prisma.candidateProfile.findMany({
    where: { isSampleData: false, isSystemAccount: false },
    select: { id: true, firstName: true, lastName: true, email: true },
  })
  let flagged = 0
  for (const c of candidates) {
    const fullName = [c.firstName, c.lastName].filter(Boolean).join(' ').trim()
    const emailHit = !!c.email && emails.has(c.email.trim().toLowerCase())
    const nameHit = !!fullName && namesLookAlike(fullName, person.fullName)
    if (!emailHit && !nameHit) continue
    const outcome = await recordIdentityMatch(c.id, 'CRM_INVITE', personId, emailHit ? 'EMAIL_EXACT' : 'NAME_SIMILAR', {
      name: person.fullName, email: person.email, company: person.affiliations[0]?.org.name ?? null,
    })
    if (outcome === 'pending') flagged++
  }
  return flagged
}
