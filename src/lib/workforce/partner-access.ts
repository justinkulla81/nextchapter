import 'server-only'
// Partner accounts, the part that reads and writes: the steward gives access to a confirmed partner's contact, the person signs in from
// a one-time link, and holds the PARTNER token for that partner only. Demo organizations never email: the steward copies the link.

import { randomBytes } from 'crypto'
import { prisma } from '@/lib/prisma'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendPartnerAccessEmail } from '@/lib/email/send-partner-access'
import { orgCallbackOrigin } from '@/lib/org-hosts'
import { accessBlocked, cleanEmail, emailMatches, partnerAccessPath } from './partner-access-rules'

/** Gives (or re-sends) access. A contact who already accepted keeps their sign-in and nothing is sent. */
export async function giveAccess(args: { institutionId: string; partnerId: string; email: string; by: string }) {
  const email = cleanEmail(args.email)
  const partner = await prisma.ecosystemPartner.findFirst({
    where: { id: args.partnerId, institutionId: args.institutionId },
    select: { id: true, name: true, status: true, institution: { select: { slug: true, name: true, programBrandName: true, isDemo: true, plan: true } } },
  })
  if (!partner) return { error: 'That partner is gone. Reload the page.' }
  const [contactsInOrg, existing] = await Promise.all([
    prisma.ecosystemPartnerContact.count({ where: { institutionId: args.institutionId } }),
    prisma.ecosystemPartnerContact.findUnique({ where: { partnerId_email: { partnerId: partner.id, email } }, select: { id: true, acceptedAt: true } }),
  ])
  const blocked = accessBlocked({ plan: partner.institution.plan, partnerStatus: partner.status, email, contactsInOrg, alreadyContact: !!existing })
  if (blocked) return { error: blocked }
  if (existing?.acceptedAt) return { ok: true as const, sent: false, path: null, already: true as const }

  const token = randomBytes(18).toString('base64url')
  await prisma.ecosystemPartnerContact.upsert({
    where: { partnerId_email: { partnerId: partner.id, email } },
    create: { institutionId: args.institutionId, partnerId: partner.id, email, inviteToken: token, createdBy: args.by, isSampleData: partner.institution.isDemo },
    update: { inviteToken: token, invitedAt: new Date() },
  })
  const path = partnerAccessPath(partner.institution.slug, token)
  if (partner.institution.isDemo) return { ok: true as const, sent: false, path, already: false as const }
  const admin = createAdminClient()
  await admin.auth.admin.createUser({ email, email_confirm: true }).catch(() => null)
  const { data, error } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: { redirectTo: `${orgCallbackOrigin('workforce')}/auth/callback?next=institution-join&joinTo=${encodeURIComponent(path)}` },
  })
  if (error || !data.properties?.action_link) return { error: 'We couldn’t create the sign-in link. Try again in a minute.' }
  const r = await sendPartnerAccessEmail(email, partner.institution.programBrandName ?? partner.institution.name, partner.name, data.properties.action_link)
  return r.sent ? { ok: true as const, sent: true, path, already: false as const } : { error: 'The email didn’t send. Try again, or copy the link instead.' }
}

/** Takes access away. The person keeps their login; they just no longer open this partner's page. */
export async function removeAccess(institutionId: string, id: string) {
  const r = await prisma.ecosystemPartnerContact.deleteMany({ where: { id, institutionId } })
  return r.count ? { ok: true as const } : { error: 'That person is already gone. Reload the page.' }
}

export async function accessInvite(slug: string, token: string) {
  return prisma.ecosystemPartnerContact.findFirst({
    where: { inviteToken: token, institution: { slug }, partner: { status: 'CONFIRMED' } },
    select: { id: true, email: true, institutionId: true, partnerId: true, partner: { select: { name: true } } },
  })
}

export async function acceptAccess(args: { slug: string; token: string; userId: string; email: string | null }) {
  const invite = await accessInvite(args.slug, args.token)
  if (!invite) return { error: 'This link has been used or replaced. Ask for a new one.' }
  if (!emailMatches(invite.email, args.email)) return { error: `This link was sent to ${invite.email}. Sign in with that email to accept it.` }
  await prisma.ecosystemPartnerContact.update({ where: { id: invite.id }, data: { userId: args.userId, acceptedAt: new Date(), inviteToken: null } })
  return { ok: true as const, institutionId: invite.institutionId, partnerId: invite.partnerId }
}
