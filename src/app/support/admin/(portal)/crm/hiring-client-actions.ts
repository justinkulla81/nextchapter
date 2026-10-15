'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin/auth'
import { captureServerEvent } from '@/lib/posthog/server'

const CRM = '/support/admin/crm'

/** Marks a company as a hiring client (or clears it). Returns false if the organization is gone. */
export async function setHiringClient(orgId: string, value: boolean): Promise<boolean> {
  const admin = await requireAdmin()
  const org = await prisma.crmOrganization.findUnique({ where: { id: orgId }, select: { hiringClient: true } })
  if (!org) return false
  if (org.hiringClient === value) return true
  await prisma.crmOrganization.update({ where: { id: orgId }, data: { hiringClient: value, hiringClientAt: value ? new Date() : null } })
  captureServerEvent(admin.email ?? 'admin', 'hiring_client_set', { orgId, hiringClient: value })
  revalidatePath(`${CRM}/organizations/${orgId}`)
  revalidatePath(`${CRM}/organizations`)
  return true
}
