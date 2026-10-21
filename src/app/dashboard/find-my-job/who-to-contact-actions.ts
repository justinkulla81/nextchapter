'use server'

import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { captureServerEvent } from '@/lib/posthog/server'
import { candidatePlusRequiredMessage } from '@/lib/jobs/candidate-plus-extras'
import { isDossierUnlocked } from '@/lib/scoring/dossier-unlock'
import { contactTargets, displayPersonName, isPersonName, linkedinPeopleSearchUrl, memberHeadline, outreachTemplate, type WhoToContactPanel } from '@/lib/jobs/who-to-contact'
import { loadMemberOrgSignal } from '@/lib/jobs/who-to-contact-crm'

// "Who to contact" on a board job, loaded only when the member opens the panel (never
// for the whole list). Free sources only: the posting's own named contact, a yes/no
// that NextChapter knows someone there, likely titles with LinkedIn searches, a guessed
// address for the named contact, and a fill-in-the-blanks note. No LLM, no Hunter.

export type WhoToContactResult = { ok: true; panel: WhoToContactPanel } | { ok: false; error: string }

async function authedProfile() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user ? getOrCreateCandidateProfile(user.id) : null
}

/** The posting, only when it is on the board (every member sees every board job). */
async function viewablePosting(postingId: string) {
  const posting = await prisma.exclusiveJobPosting.findFirst({
    where: { id: postingId, status: 'approved', archivedAt: null, distribution: { not: 'EXCLUDED' }, institutionScopeId: null },
    select: {
      id: true, title: true, companyName: true, companyId: true, level: true, disclosure: true,
      recruiterName: true,
    },
  })
  return posting
}

export async function loadWhoToContact(postingId: string): Promise<WhoToContactResult> {
  const profile = await authedProfile()
  if (!profile) return { ok: false, error: 'Sign in again to see who to contact.' }
  // Who to contact is open to every member (candidate-plus-extras.ts). The intro request below is still Candidate+.
  const posting = await viewablePosting(postingId)
  if (!posting) return { ok: false, error: 'This job is no longer on the board.' }
  // A confidential search names no employer: there is no one to look up.
  if (posting.disclosure === 'CONFIDENTIAL') {
    return { ok: false, error: 'This is a confidential search, so the employer is not named. Use “Request intro” below instead.' }
  }

  const contactName = isPersonName(posting.recruiterName) ? displayPersonName(posting.recruiterName!) : null
  const [signal, latestRole] = await Promise.all([
    loadMemberOrgSignal({ companyId: posting.companyId, companyName: posting.companyName, contactName }),
    prisma.workHistoryEntry.findFirst({
      where: { candidateId: profile.id },
      orderBy: [{ isCurrent: 'desc' }, { startDate: 'desc' }],
      select: { roleTitle: true, companyName: true, isCurrent: true },
    }),
  ])

  const { targets, basis } = contactTargets(posting)
  const headline = memberHeadline({ latestRole, yearsExperience: profile.yearsExperience, confidential: profile.confidentialSearchMode })
  const sources = [
    ...(contactName ? ['posting_contact'] : []),
    ...(signal.knownSomeone ? ['nextchapter_network'] : []),
    ...(signal.guessedEmail ? ['guessed_email'] : []),
    'targeting',
    'template',
  ]
  return {
    ok: true,
    panel: {
      jobId: posting.id,
      recruiter: contactName
        ? { name: contactName, guessedEmail: signal.guessedEmail, linkedinSearchUrl: linkedinPeopleSearchUrl(posting.companyName, contactName) }
        : null,
      knownSomeone: signal.knownSomeone,
      companyId: posting.companyId,
      targets,
      hiringManagerBasis: basis,
      template: outreachTemplate({
        jobTitle: posting.title,
        companyName: posting.companyName,
        recipientName: contactName,
        headline,
        memberFirstName: profile.firstName,
      }),
      sources,
    },
  }
}

export type IntroRequestResult = { ok: true; already: boolean } | { ok: false; error: string }

/**
 * "NextChapter knows someone here": records a request for Justin (the admin Requests
 * inbox, kind 'known_contact'). It reaches no one at the employer — Justin decides
 * whether and whom to ask.
 */
export async function requestKnownContactIntro(postingId: string): Promise<IntroRequestResult> {
  const profile = await authedProfile()
  if (!profile) return { ok: false, error: 'Sign in again to request an intro.' }
  if (!(await isDossierUnlocked(profile.id)).unlocked) return { ok: false, error: candidatePlusRequiredMessage('who_to_contact') }
  const posting = await viewablePosting(postingId)
  if (!posting || posting.disclosure === 'CONFIDENTIAL') return { ok: false, error: 'This job is no longer on the board.' }

  const existing = await prisma.jobBoardIntroRequest.findFirst({
    where: { candidateId: profile.id, postingId, kind: 'known_contact', status: 'pending' },
    select: { id: true },
  })
  if (existing) return { ok: true, already: true }
  await prisma.jobBoardIntroRequest.create({ data: { candidateId: profile.id, postingId, kind: 'known_contact' } })
  captureServerEvent(profile.id, 'intro_request_recorded', { jobId: postingId, orgId: posting.companyId })
  return { ok: true, already: false }
}
