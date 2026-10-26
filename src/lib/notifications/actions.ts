'use server'

import { prisma } from '@/lib/prisma'
import { getDashboardProfile } from '@/lib/dashboard/get-dashboard-data'
import { captureServerEvent } from '@/lib/posthog/server'

/** Marks every unread notification read (the member opened the bell). */
export async function markNotificationsRead(): Promise<void> {
  const profile = await getDashboardProfile()
  await prisma.memberNotification.updateMany({ where: { candidateId: profile.id, readAt: null }, data: { readAt: new Date() } })
}

/** Records a click on one notification. The link itself is a normal page link. */
export async function recordNotificationClick(id: string, kind: string): Promise<void> {
  const profile = await getDashboardProfile()
  await prisma.memberNotification.updateMany({ where: { id, candidateId: profile.id, readAt: null }, data: { readAt: new Date() } })
  captureServerEvent(profile.email ?? profile.id, 'notification_clicked', { kind })
}
