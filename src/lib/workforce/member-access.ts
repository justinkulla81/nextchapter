// Portal access for a workforce org's member companies: the org invites the
// company's contact; the contact signs in from the one-time link, gets (or
// keeps) a NextChapter Talent employer account, and is connected to the
// company as an approved employer of the org ("Your company" workspace:
// layoffs and seats, how its people are doing, jobs it posts). While the
// company is marked hiring it also sees the Dossiers participants chose to
// share, and can ask for introductions they accept or decline.

import 'server-only'
import { randomBytes } from 'crypto'
import { prisma } from '@/lib/prisma'
import { createAdminClient } from '@/lib/supabase/admin'
import { getOrCreateEmployerProfile } from '@/lib/profile'
import { sendMemberCompanyInviteEmail } from '@/lib/email/send-member-company-invite'

const appUrl = () => process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
export const memberInvitePath = (slug: string, token: string) => `/i/${slug}/member/${token}`

// Sends (or, on a demo, only returns) the invite. Re-inviting replaces the token.
export async function inviteMemberCompany(args: { institutionId: string; companyId: string; email: string }) {
  const company = await prisma.memberCompany.findFirst({
    where: { id: args.companyId, institutionId: args.institutionId },
    select: { id: true, name: true, employerProfileId: true, institution: { select: { slug: true, name: true, programBrandName: true, isDemo: true } } },
  })
  if (!company) return { error: 'That company is gone. Reload the page.' }
  if (company.employerProfileId) return { error: `${company.name} is already connected.` }
  const email = args.email.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'Add the contact’s email.' }
  const token = randomBytes(18).toString('base64url')
  await prisma.memberCompany.update({ where: { id: company.id }, data: { inviteToken: token, invitedEmail: email, invitedAt: new Date(), contactEmail: email } })
  const path = memberInvitePath(company.institution.slug, token)
  // Demo orgs never email: staff copy the link instead.
  if (company.institution.isDemo) return { ok: true as const, sent: false, path }
  const admin = createAdminClient()
  await admin.auth.admin.createUser({ email, email_confirm: true }).catch(() => null)
  const { data, error } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: { redirectTo: `${appUrl()}/auth/callback?next=institution-join&joinTo=${encodeURIComponent(path)}` },
  })
  if (error || !data.properties?.action_link) return { error: 'We couldn’t create the sign-in link. Try again in a minute.' }
  const r = await sendMemberCompanyInviteEmail(email, company.institution.programBrandName ?? company.institution.name, company.name, data.properties.action_link)
  return r.sent ? { ok: true as const, sent: true, path } : { error: 'The email didn’t send. Try again, or share the link from the company row.' }
}

export async function memberInvite(slug: string, token: string) {
  return prisma.memberCompany.findFirst({
    where: { inviteToken: token, institution: { slug } },
    select: { id: true, name: true, invitedEmail: true, institutionId: true, institution: { select: { name: true, programBrandName: true, logoUrl: true, accentColor: true } } },
  })
}

// The signed-in contact accepts: employer account, approved link, connected.
export async function acceptMemberInvite(args: { slug: string; token: string; userId: string; email: string | null }) {
  const invite = await memberInvite(args.slug, args.token)
  if (!invite) return { error: 'This invite has been used or replaced. Ask for a new one.' }
  if (invite.invitedEmail && args.email && invite.invitedEmail !== args.email.toLowerCase()) {
    return { error: `This invite was sent to ${invite.invitedEmail}. Sign in with that email to accept it.` }
  }
  const profile = await getOrCreateEmployerProfile(args.userId, invite.name)
  const taken = await prisma.memberCompany.findFirst({ where: { employerProfileId: profile.id, id: { not: invite.id } }, select: { name: true } })
  if (taken) return { error: `This login is already connected to ${taken.name}. Use a different email for ${invite.name}.` }
  await prisma.$transaction([
    prisma.institutionEmployer.upsert({
      where: { institutionId_employerProfileId: { institutionId: invite.institutionId, employerProfileId: profile.id } },
      create: { institutionId: invite.institutionId, employerProfileId: profile.id, status: 'APPROVED', approvedBy: 'member-invite', approvedAt: new Date() },
      update: { status: 'APPROVED', approvedBy: 'member-invite', approvedAt: new Date() },
    }),
    prisma.memberCompany.update({ where: { id: invite.id }, data: { employerProfileId: profile.id, connectedAt: new Date(), inviteToken: null } }),
  ])
  return { ok: true as const, companyId: invite.id, institutionId: invite.institutionId }
}

// A connected company keeps its portal access; "hiring" only decides
// whether it sees shared Dossiers (checked where they're listed).
export async function syncMemberAccess(institutionId: string, companyId: string) {
  const c = await prisma.memberCompany.findFirst({ where: { id: companyId, institutionId }, select: { employerProfileId: true } })
  if (!c?.employerProfileId) return
  await prisma.institutionEmployer.updateMany({ where: { institutionId, employerProfileId: c.employerProfileId }, data: { status: 'APPROVED' } })
}
