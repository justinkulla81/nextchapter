'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { createWebinar } from '@/lib/webinars/webinars'
import { captureServerEvent } from '@/lib/posthog/server'

export type FormState = { error?: string } | undefined

export async function createWebinarAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin()

  const title = (formData.get('title') as string | null)?.trim()
  const description = (formData.get('description') as string | null)?.trim() || null
  const hostLabel = (formData.get('hostLabel') as string | null)?.trim()
  const scheduledAtRaw = formData.get('scheduledAt') as string | null
  const durationMinutes = Number(formData.get('durationMinutes')) || 45

  if (!title || !hostLabel || !scheduledAtRaw) {
    return { error: 'Title, host, and date/time are required.' }
  }
  const scheduledAt = new Date(scheduledAtRaw)
  if (Number.isNaN(scheduledAt.getTime())) {
    return { error: 'Invalid date/time.' }
  }

  const webinar = await createWebinar({ title, description, hostLabel, scheduledAt, durationMinutes })
  captureServerEvent(admin?.email ?? 'admin', 'webinar_created', { webinarId: webinar.id })

  revalidatePath('/support/admin/webinars')
  return undefined
}

export async function cancelWebinarAction(webinarId: string) {
  const admin = await requireAdmin()
  await prisma.webinar.update({ where: { id: webinarId }, data: { cancelledAt: new Date() } })
  captureServerEvent(admin?.email ?? 'admin', 'webinar_cancelled', { webinarId })
  revalidatePath('/support/admin/webinars')
}
