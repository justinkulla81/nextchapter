'use server'

import { revalidatePath } from 'next/cache'
import type { PrivacyTier } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin/auth'
import { captureServerEvent } from '@/lib/posthog/server'

export type FormState = { error?: string } | undefined

const PRIVACY_TIERS: PrivacyTier[] = ['PUBLIC', 'SEMI_PUBLIC', 'PRIVATE', 'STEALTH', 'LOCKED']

function parseCommon(formData: FormData) {
  const title = (formData.get('title') as string | null)?.trim() ?? ''
  const description = (formData.get('description') as string | null)?.trim() || null
  const introCopy = (formData.get('introCopy') as string | null)?.trim() || null
  const sendHourUtcRaw = (formData.get('sendHourUtc') as string | null)?.trim() ?? ''
  const isActive = formData.get('isActive') === 'on'
  const eligiblePrivacyTiers = PRIVACY_TIERS.filter((tier) => formData.get(`privacyTier_${tier}`) === 'on')

  if (!title) return { error: 'Title is required.' as const }
  const sendHourUtc = Number(sendHourUtcRaw)
  if (!Number.isInteger(sendHourUtc) || sendHourUtc < 0 || sendHourUtc > 23) {
    return { error: 'Send hour must be a whole number between 0 and 23.' as const }
  }

  return {
    data: { title, description, introCopy, sendHourUtc, isActive, eligiblePrivacyTiers },
  }
}

export async function updateEmailSchedule(
  scheduleId: string,
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const admin = await requireAdmin()
  const parsed = parseCommon(formData)
  if ('error' in parsed) return { error: parsed.error }

  await prisma.candidateEmailSchedule.update({ where: { id: scheduleId }, data: parsed.data })
  captureServerEvent(admin?.email ?? 'admin', 'email_schedule_updated', { scheduleId })
  revalidatePath('/support/admin/email-cadence')
}

export async function toggleEmailScheduleActive(scheduleId: string, current: boolean) {
  await requireAdmin()
  await prisma.candidateEmailSchedule.update({ where: { id: scheduleId }, data: { isActive: !current } })
  revalidatePath('/support/admin/email-cadence')
}
