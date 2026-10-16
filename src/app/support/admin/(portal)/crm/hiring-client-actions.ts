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

/** Flags or unflags every ticked organization. Returns how many actually changed. */
export async function bulkSetHiringClient(formData: FormData, value: boolean): Promise<{ changed: number; unchanged: number }> {
  const admin = await requireAdmin()
  const ids = [...new Set(formData.getAll('selected').map(String).filter(Boolean))]
  if (ids.length === 0) return { changed: 0, unchanged: 0 }
  const { count } = await prisma.crmOrganization.updateMany({
    where: { id: { in: ids }, hiringClient: !value },
    data: { hiringClient: value, hiringClientAt: value ? new Date() : null },
  })
  captureServerEvent(admin.email ?? 'admin', 'hiring_clients_bulk_set', {
    hiringClient: value, selected: ids.length, changed: count, orgIds: ids.slice(0, 100),
  })
  revalidatePath(`${CRM}/organizations`)
  return { changed: count, unchanged: ids.length - count }
}
