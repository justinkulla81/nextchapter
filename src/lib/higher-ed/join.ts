// Alumni join (HE-06, "Live in a day"): one click from the college's email,
// two privacy choices and an optional "I'll take a call", then straight into
// their Market Reality Grade.
//
// The join link carries the OutreachSend's claimToken. It was mailed to the
// roster address, so it proves that address, the same way a magic link does:
// clicking "Join" signs the person in as that email without a password or a
// second email. A token works once; after that they sign in normally.
// Without a token, a signed-in person joins only if their login email is on
// the roster. Nobody joins a college they aren't listed at.

import 'server-only'
import type { InstitutionConsentScope } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { createAdminClient } from '@/lib/supabase/admin'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { grantRoleIfMissing } from '@/lib/auth/role-grants'
import { TOKEN_TTL_DAYS, isTokenExpired } from '@/lib/security/token-ttl'
import { callbackOriginForAppPath } from '@/lib/portal-hosts'

export type JoinableMember = {
  id: string
  institutionId: string
  email: string
  firstName: string | null
  status: string
  candidateId: string | null
  sendId: string | null
}

export async function findMemberByToken(slug: string, token: string): Promise<(JoinableMember & { tokenUsed: boolean }) | null> {
  const send = await prisma.outreachSend.findUnique({
    where: { claimToken: token },
    select: {
      id: true,
      claimedAt: true,
      sentAt: true,
      createdAt: true,
      member: { select: { id: true, institutionId: true, email: true, firstName: true, status: true, candidateId: true, institution: { select: { slug: true } } } },
    },
  })
  if (!send?.member || send.member.institution.slug !== slug || send.member.status === 'OPTED_OUT') return null
  // A join link signs the holder in as the roster email, so it lapses; a link
  // that was already used still resolves (the page says "already joined").
  if (!send.claimedAt && isTokenExpired(send.sentAt ?? send.createdAt, TOKEN_TTL_DAYS.higherEdJoin)) return null
  const { institution: _i, ...m } = send.member
  return { ...m, sendId: send.id, tokenUsed: !!send.claimedAt }
}

export async function findMemberByEmail(institutionId: string, email: string): Promise<JoinableMember | null> {
  const m = await prisma.institutionMember.findFirst({
    where: { institutionId, email: email.toLowerCase(), status: { not: 'OPTED_OUT' } },
    select: { id: true, institutionId: true, email: true, firstName: true, status: true, candidateId: true },
  })
  return m ? { ...m, sendId: null } : null
}


// The one-click sign-in for a token holder: makes sure a confirmed login
// exists for the roster email, and returns a magic link that lands on the
// college's welcome page signed in.
export async function joinLinkForToken(slug: string, token: string): Promise<{ url?: string; error?: string }> {
  const member = await findMemberByToken(slug, token)
  if (!member) return { error: 'This join link isn’t valid. Ask your alumni office for a new one.' }
  if (member.tokenUsed) return { error: 'used' }
  const admin = createAdminClient()
  // Ignore "already registered": an existing account just signs in.
  await admin.auth.admin.createUser({ email: member.email, email_confirm: true }).catch(() => null)
  const welcome = `/i/${slug}/welcome?t=${encodeURIComponent(token)}`
  const { data, error } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: member.email,
    options: { redirectTo: `${callbackOriginForAppPath('/dashboard')}/auth/callback?next=institution-join&joinTo=${encodeURIComponent(welcome)}` },
  })
  if (error || !data.properties?.action_link) return { error: 'We couldn’t sign you in just now. Try the link again in a minute.' }
  return { url: data.properties.action_link }
}

export type JoinChoices = { shareOutcome: boolean; shareSearchDetail: boolean; takeCalls: boolean; shareDossier?: boolean }

export async function completeJoin(args: { member: JoinableMember; userId: string; choices: JoinChoices }): Promise<{ candidateId: string }> {
  const { member, userId, choices } = args
  const profile = await getOrCreateCandidateProfile(userId)
  const now = new Date()
  await prisma.institutionMember.update({
    where: { id: member.id },
    data: { candidateId: profile.id, status: 'CLAIMED', claimedAt: now },
  })
  const consents: [InstitutionConsentScope, boolean][] = [
    ['SHARE_OUTCOME', choices.shareOutcome],
    ['SHARE_SEARCH_DETAIL_WITH_CAREER', choices.shareSearchDetail],
    // Asked only of a workforce org's participants (hiring member companies).
    ...(choices.shareDossier !== undefined ? ([['SHARE_DOSSIER_WITH_EMPLOYERS', choices.shareDossier]] as [InstitutionConsentScope, boolean][]) : []),
  ]
  await prisma.institutionConsent.createMany({
    data: consents.map(([scope, granted]) => ({ memberId: member.id, scope, granted, source: 'CLAIM', changedAt: now })),
  })
  if (choices.takeCalls) {
    await prisma.institutionMentor.upsert({
      where: { memberId: member.id },
      create: { institutionId: member.institutionId, memberId: member.id, isActive: true },
      update: { isActive: true },
    })
  }
  if (member.sendId) await prisma.outreachSend.update({ where: { id: member.sendId }, data: { claimedAt: now } })
  await grantRoleIfMissing(userId, 'alum')
  return { candidateId: profile.id }
}

// Consent toggles from Privacy & sharing: history rows, never overwrites.
export async function setConsent(memberId: string, scope: InstitutionConsentScope, granted: boolean): Promise<void> {
  await prisma.institutionConsent.create({ data: { memberId, scope, granted, source: 'MEMBER' } })
}
