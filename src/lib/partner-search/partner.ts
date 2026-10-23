import 'server-only'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { sendPartnerInviteEmail } from '@/lib/email/send-partner-email'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type Result = { ok: true } | { ok: false; error: string }

export interface Partnership {
  id: string
  /** The member who invited; the move plan belongs to them. */
  ownerId: string
  partnerId: string | null
  partnerName: string
  partnerEmail: string
  sharePlaces: boolean
  shareJobsPay: boolean
  joined: boolean
}

/** The member's active partnership, as the inviter or as the partner who joined. Invited-but-not-joined counts for the inviter. */
export async function loadPartnership(candidateId: string): Promise<{ role: 'owner' | 'partner'; link: Partnership; ownerFirstName: string | null; partnerFirstName: string | null } | null> {
  const row = await prisma.partnerLink.findFirst({
    where: { revokedAt: null, OR: [{ ownerId: candidateId }, { partnerId: candidateId }] },
    include: { owner: { select: { firstName: true } }, partner: { select: { firstName: true } } },
    orderBy: { createdAt: 'desc' },
  })
  if (!row) return null
  const link: Partnership = {
    id: row.id,
    ownerId: row.ownerId,
    partnerId: row.partnerId,
    partnerName: row.partnerName,
    partnerEmail: row.partnerEmail,
    sharePlaces: row.sharePlaces,
    shareJobsPay: row.shareJobsPay,
    joined: !!row.partnerId,
  }
  return { role: row.ownerId === candidateId ? 'owner' : 'partner', link, ownerFirstName: row.owner.firstName, partnerFirstName: row.partner?.firstName ?? null }
}

/** An invitation sent to this email address that has not been accepted. Only the email on a verified account is used. */
export async function pendingInviteFor(email: string | null | undefined): Promise<{ id: string; ownerFirstName: string | null } | null> {
  const e = (email ?? '').trim().toLowerCase()
  if (!e) return null
  const row = await prisma.partnerLink.findFirst({
    where: { partnerEmail: e, partnerId: null, revokedAt: null },
    orderBy: { createdAt: 'desc' },
    select: { id: true, owner: { select: { firstName: true } } },
  })
  return row ? { id: row.id, ownerFirstName: row.owner.firstName } : null
}

export async function invitePartner(ownerId: string, ownerAuthEmail: string | null, nameRaw: string, emailRaw: string, sharing: { sharePlaces: boolean; shareJobsPay: boolean }): Promise<Result> {
  const name = nameRaw.trim()
  const email = emailRaw.trim().toLowerCase()
  if (!name) return { ok: false, error: 'Add their name so the invite feels personal.' }
  if (!EMAIL.test(email)) return { ok: false, error: 'That email does not look right. Check it and try again.' }
  if (ownerAuthEmail && email === ownerAuthEmail.trim().toLowerCase()) return { ok: false, error: 'That is your own email. Enter your partner’s.' }
  const profile = await prisma.candidateProfile.findUnique({ where: { id: ownerId }, select: { firstName: true, confidentialSearchMode: true } })
  if (!profile) return { ok: false, error: 'Finish setting up your account first.' }
  if (profile.confidentialSearchMode) {
    return { ok: false, error: 'Confidential mode is on, so nothing about your search can be shared with anyone outside NextChapter. Turn it off in Privacy to invite your partner.' }
  }
  const existing = await loadPartnership(ownerId)
  if (existing) return { ok: false, error: existing.role === 'owner' ? 'You already have a partner on your search. Remove them first to invite someone else.' : 'You are already searching with a partner. Leave that first to invite someone else.' }
  const link = await prisma.partnerLink.upsert({
    where: { ownerId_partnerEmail: { ownerId, partnerEmail: email } },
    create: { ownerId, partnerName: name, partnerEmail: email, sharePlaces: sharing.sharePlaces, shareJobsPay: sharing.shareJobsPay },
    update: { partnerName: name, sharePlaces: sharing.sharePlaces, shareJobsPay: sharing.shareJobsPay, revokedAt: null, partnerId: null, joinedAt: null },
  })
  await sendPartnerInviteEmail({ to: email, partnerName: name, memberFirstName: profile.firstName ?? 'Your partner' })
  captureServerEvent(ownerId, 'partner_invited', { linkId: link.id, sharePlaces: sharing.sharePlaces, shareJobsPay: sharing.shareJobsPay })
  return { ok: true }
}

/** Either side ends the partnership. Places stay with the member who invited; the partner’s access stops. */
export async function endPartnership(candidateId: string, linkId: string): Promise<void> {
  const res = await prisma.partnerLink.updateMany({
    where: { id: linkId, revokedAt: null, OR: [{ ownerId: candidateId }, { partnerId: candidateId }] },
    data: { revokedAt: new Date() },
  })
  if (res.count > 0) captureServerEvent(candidateId, 'partner_link_ended', { linkId })
}

export async function acceptPartnerInvite(candidateId: string, authEmail: string | null | undefined, linkId: string): Promise<Result> {
  const e = (authEmail ?? '').trim().toLowerCase()
  const link = await prisma.partnerLink.findUnique({ where: { id: linkId }, select: { partnerEmail: true, partnerId: true, revokedAt: true, ownerId: true } })
  if (!e || !link || link.revokedAt || link.partnerId || link.partnerEmail !== e) return { ok: false, error: 'This invitation is no longer open.' }
  if (link.ownerId === candidateId) return { ok: false, error: 'You cannot accept your own invitation.' }
  if (await loadPartnership(candidateId)) return { ok: false, error: 'You already have a partner on your search.' }
  await prisma.partnerLink.update({ where: { id: linkId }, data: { partnerId: candidateId, joinedAt: new Date() } })
  captureServerEvent(candidateId, 'partner_joined', { linkId, ownerId: link.ownerId })
  return { ok: true }
}

/** The inviter changes what the partner can see. */
export async function updateSharing(ownerId: string, linkId: string, sharing: { sharePlaces: boolean; shareJobsPay: boolean }): Promise<void> {
  const res = await prisma.partnerLink.updateMany({ where: { id: linkId, ownerId, revokedAt: null }, data: sharing })
  if (res.count > 0) captureServerEvent(ownerId, 'partner_sharing_changed', { linkId, ...sharing })
}
