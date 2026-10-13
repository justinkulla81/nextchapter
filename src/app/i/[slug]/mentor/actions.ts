'use server'

// Saying yes to Alumni Relations' mentor invitation: the email's token proves who it is.

import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { setMentorProfile } from '@/lib/higher-ed/mentor-network'
import { findMemberByToken } from '@/lib/higher-ed/join'

export async function joinMentors(slug: string, token: string, industries: string[], maxCallsPerMonth: number): Promise<{ error?: string; ok?: boolean }> {
  const m = await findMemberByToken(slug, token)
  if (!m) return { error: 'This link isn’t valid any more. Your alumni office can send a new one.' }
  if (!industries.length) return { error: 'Pick at least one industry you can speak to.' }
  await setMentorProfile({ institutionId: m.institutionId, memberId: m.id, isActive: true, industries, maxCallsPerMonth })
  if (m.sendId) await prisma.outreachSend.update({ where: { id: m.sendId }, data: { clickedAt: new Date() } })
  captureServerEvent(`member:${m.id}`, 'he_mentor_joined', { institutionId: m.institutionId, industries: industries.length, maxCallsPerMonth })
  return { ok: true }
}
