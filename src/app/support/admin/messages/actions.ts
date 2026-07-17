'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin/auth'
import { captureServerEvent } from '@/lib/posthog/server'

export type FormState = { error?: string } | undefined

export async function createDashboardMessage(_prevState: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin()

  const title = (formData.get('title') as string | null)?.trim()
  const bulletsRaw = (formData.get('bullets') as string | null) ?? ''
  const footer = (formData.get('footer') as string | null)?.trim()
  const bullets = bulletsRaw
    .split('\n')
    .map((b) => b.trim())
    .filter(Boolean)

  if (!title) return { error: 'Title is required.' }
  if (bullets.length === 0) return { error: 'Add at least one bullet.' }

  const message = await prisma.dashboardMessage.create({
    data: { title, bullets, footer: footer || null },
  })

  captureServerEvent(admin?.email ?? 'admin', 'dashboard_message_created', { messageId: message.id })
  revalidatePath('/support/admin/messages')
}

export async function toggleDashboardMessageActive(messageId: string, current: boolean) {
  await requireAdmin()
  await prisma.dashboardMessage.update({ where: { id: messageId }, data: { isActive: !current } })
  revalidatePath('/support/admin/messages')
}
