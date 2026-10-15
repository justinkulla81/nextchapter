import 'server-only'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { sendSupporterInviteEmail } from '@/lib/email/send-supporter-email'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export const MAX_SUPPORTERS = 3
export const MAX_CHEER_LENGTH = 280

export type InviteResult = { ok: true } | { ok: false; error: string }

export async function inviteSupporter(candidateId: string, nameRaw: string, emailRaw: string): Promise<InviteResult> {
  const name = nameRaw.trim()
  const email = emailRaw.trim().toLowerCase()
  if (!name) return { ok: false, error: 'Add their name so the invite feels personal.' }
  if (!EMAIL.test(email)) return { ok: false, error: 'That email does not look right. Check it and try again.' }

  const profile = await prisma.candidateProfile.findUnique({
    where: { id: candidateId },
    select: { firstName: true, confidentialSearchMode: true },
  })
  if (!profile) return { ok: false, error: 'Finish setting up your account first.' }
  if (profile.confidentialSearchMode) {
    return { ok: false, error: 'Confidential mode is on, so nothing about your search can be shared with anyone outside NextChapter. Turn it off in Privacy to invite someone.' }
  }
  const active = await prisma.searchSupporter.count({ where: { candidateId, revokedAt: null } })
  if (active >= MAX_SUPPORTERS) return { ok: false, error: `You can invite up to ${MAX_SUPPORTERS} supporters. Remove one to add another.` }

  const supporter = await prisma.searchSupporter.upsert({
    where: { candidateId_email: { candidateId, email } },
    create: { candidateId, name, email },
    update: { name, revokedAt: null },
  })
  await sendSupporterInviteEmail({ to: email, supporterName: name, memberFirstName: profile.firstName ?? 'a friend', token: supporter.token })
  captureServerEvent(candidateId, 'supporter_invited', { supporterId: supporter.id, activeSupporters: active + 1 })
  return { ok: true }
}

export async function revokeSupporter(candidateId: string, supporterId: string): Promise<void> {
  const res = await prisma.searchSupporter.updateMany({ where: { id: supporterId, candidateId, revokedAt: null }, data: { revokedAt: new Date() } })
  if (res.count > 0) captureServerEvent(candidateId, 'supporter_removed', { supporterId })
}

export async function sendCheer(token: string, messageRaw: string): Promise<InviteResult> {
  const message = messageRaw.trim().slice(0, MAX_CHEER_LENGTH)
  if (!message) return { ok: false, error: 'Write a line or two first.' }
  const supporter = await prisma.searchSupporter.findUnique({ where: { token }, select: { id: true, candidateId: true, revokedAt: true } })
  if (!supporter || supporter.revokedAt) return { ok: false, error: 'This link is no longer active.' }
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
  if ((await prisma.supporterCheer.count({ where: { supporterId: supporter.id, createdAt: { gte: since } } })) >= 2) {
    return { ok: false, error: 'You have sent a couple of cheers today. They landed. Come back tomorrow.' }
  }
  await prisma.supporterCheer.create({ data: { supporterId: supporter.id, message } })
  captureServerEvent(supporter.candidateId, 'supporter_cheer_sent', { supporterId: supporter.id, length: message.length })
  return { ok: true }
}
