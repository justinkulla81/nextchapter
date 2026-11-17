// People at a member company, each with the part of the company's view they work in (owner, 2026-11-17): HIRING sees
// shared profiles, intros and the jobs it posts; OUTPLACEMENT sees layoff seats and how its people are doing. The
// company's main connected login (member-access.ts) keeps the whole view. The org invites contacts from Talent Hub >
// Member companies; each gets a one-time sign-in link to /i/<slug>/member/<token>, the same page as the main invite.

import 'server-only'
import { randomBytes } from 'crypto'
import { prisma } from '@/lib/prisma'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendMemberCompanyInviteEmail } from '@/lib/email/send-member-company-invite'
import { orgCallbackOrigin } from '@/lib/org-hosts'
import { memberInvitePath } from './member-access'

export const CONTACT_ROLES = ['HIRING', 'OUTPLACEMENT'] as const
export type ContactRole = (typeof CONTACT_ROLES)[number]
export const CONTACT_ROLE_LABELS: Record<ContactRole, string> = { HIRING: 'Hiring', OUTPLACEMENT: 'Outplacement' }

export function parseContactRoles(values: string[]): ContactRole[] {
  return CONTACT_ROLES.filter((r) => values.includes(r))
}

// The contacts at an org's member companies, for the Member companies screen. A handful of narrow rows per company.
export async function companyContacts(institutionId: string) {
  return prisma.memberCompanyContact.findMany({
    where: { institutionId },
    orderBy: [{ memberCompanyId: 'asc' }, { createdAt: 'asc' }],
    select: { id: true, memberCompanyId: true, email: true, roles: true, invitedAt: true, acceptedAt: true },
    take: 500,
  })
}

// Adds (or changes the roles of) a contact. A contact who already accepted keeps their login and gets the new roles
// at once; anyone else gets a fresh one-time link. Demo orgs never email: staff copy the link.
export async function inviteCompanyContact(args: { institutionId: string; companyId: string; email: string; roles: ContactRole[]; by: string }) {
  const email = args.email.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'Add the person’s work email.' }
  if (!args.roles.length) return { error: 'Pick what they work on: hiring, outplacement, or both.' }
  const company = await prisma.memberCompany.findFirst({
    where: { id: args.companyId, institutionId: args.institutionId },
    select: { id: true, name: true, employerProfileId: true, institution: { select: { slug: true, name: true, programBrandName: true, isDemo: true } } },
  })
  if (!company) return { error: 'That company is gone. Reload the page.' }
  // Hiring acts through the company's hiring login (intros and jobs it posts belong to it).
  if (args.roles.includes('HIRING') && !company.employerProfileId) {
    return { error: `Connect ${company.name}'s main contact first (Portal access). Hiring works through that login.` }
  }
  const existing = await prisma.memberCompanyContact.findUnique({ where: { memberCompanyId_email: { memberCompanyId: company.id, email } }, select: { id: true, acceptedAt: true } })
  if (existing?.acceptedAt) {
    await prisma.memberCompanyContact.update({ where: { id: existing.id }, data: { roles: args.roles } })
    return { ok: true as const, sent: false, updated: true, path: null }
  }
  const token = randomBytes(18).toString('base64url')
  await prisma.memberCompanyContact.upsert({
    where: { memberCompanyId_email: { memberCompanyId: company.id, email } },
    create: { institutionId: args.institutionId, memberCompanyId: company.id, email, roles: args.roles, inviteToken: token, createdBy: args.by, isSampleData: company.institution.isDemo },
    update: { roles: args.roles, inviteToken: token, invitedAt: new Date() },
  })
  const path = memberInvitePath(company.institution.slug, token)
  if (company.institution.isDemo) return { ok: true as const, sent: false, updated: false, path }
  const admin = createAdminClient()
  await admin.auth.admin.createUser({ email, email_confirm: true }).catch(() => null)
  const { data, error } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: { redirectTo: `${orgCallbackOrigin('workforce')}/auth/callback?next=institution-join&joinTo=${encodeURIComponent(path)}` },
  })
  if (error || !data.properties?.action_link) return { error: 'We couldn’t create the sign-in link. Try again in a minute.' }
  const r = await sendMemberCompanyInviteEmail(email, company.institution.programBrandName ?? company.institution.name, company.name, data.properties.action_link)
  return r.sent ? { ok: true as const, sent: true, updated: false, path } : { error: 'The email didn’t send. Try again, or copy the link instead.' }
}

// Takes a contact's access away. Their login stays; they just no longer see this company's view.
export async function removeCompanyContact(institutionId: string, id: string) {
  const r = await prisma.memberCompanyContact.deleteMany({ where: { id, institutionId } })
  return r.count ? { ok: true as const } : { error: 'That contact is already gone. Reload the page.' }
}

export async function contactInvite(slug: string, token: string) {
  return prisma.memberCompanyContact.findFirst({
    where: { inviteToken: token, memberCompany: { institution: { slug } } },
    select: { id: true, email: true, roles: true, institutionId: true, memberCompanyId: true, memberCompany: { select: { name: true } } },
  })
}

export async function acceptContactInvite(args: { slug: string; token: string; userId: string; email: string | null }) {
  const invite = await contactInvite(args.slug, args.token)
  if (!invite) return { error: 'This invite has been used or replaced. Ask for a new one.' }
  if (!args.email || invite.email !== args.email.toLowerCase()) return { error: `This invite was sent to ${invite.email}. Sign in with that email to accept it.` }
  await prisma.memberCompanyContact.update({ where: { id: invite.id }, data: { userId: args.userId, acceptedAt: new Date(), inviteToken: null } })
  return { ok: true as const, companyId: invite.memberCompanyId, institutionId: invite.institutionId, roles: invite.roles }
}
