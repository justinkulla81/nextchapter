'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin/auth'
import { captureServerEvent } from '@/lib/posthog/server'
import { resolveFirmAsDifferent, resolveFirmAsSame } from '@/lib/search-firms/sync'

const BASE = '/support/admin/crm/search-firms'
const REQUEST_STATUSES = ['NEW', 'SHORTLISTING', 'SENT', 'CLOSED'] as const

/** Review List: the firm and the suggested organization are the same. */
export async function linkFirmToSuggestedOrg(firmId: string): Promise<void> {
  const admin = await requireAdmin()
  await resolveFirmAsSame(firmId)
  captureServerEvent(admin.email ?? 'admin', 'search_firm_match_resolved', { firmId, decision: 'same' })
  revalidatePath(BASE)
  revalidatePath('/support/admin/crm/needs-completion')
}

/** Review List: different organizations — add the firm as its own. */
export async function addFirmAsNewOrg(firmId: string): Promise<void> {
  const admin = await requireAdmin()
  await resolveFirmAsDifferent(firmId)
  captureServerEvent(admin.email ?? 'admin', 'search_firm_match_resolved', { firmId, decision: 'different' })
  revalidatePath(BASE)
  revalidatePath('/support/admin/crm/needs-completion')
}

export async function setSearchRequestStatus(requestId: string, status: string): Promise<void> {
  const admin = await requireAdmin()
  if (!(REQUEST_STATUSES as readonly string[]).includes(status)) throw new Error('Unknown status.')
  await prisma.searchRequest.update({ where: { id: requestId }, data: { status } })
  captureServerEvent(admin.email ?? 'admin', 'search_request_status_changed', { searchRequestId: requestId, status })
  revalidatePath(BASE)
}
