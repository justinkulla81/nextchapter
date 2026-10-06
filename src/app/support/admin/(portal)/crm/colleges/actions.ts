'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin/auth'
import { captureServerEvent } from '@/lib/posthog/server'
import { isDealStatus } from '@/lib/crm/deal-status'
import { ensureCollegeOrg } from '@/lib/workforce/college-crm'
import { rankColleges } from '@/lib/workforce/college-rank'

/**
 * Sets a college's deal status from the Colleges page. The status lives on
 * the college's CRM organization, made here if the college has none yet,
 * and the colleges are re-ranked so the deal shows in the order at once.
 */
export async function setCollegeDealStatus(collegeId: string, value: string): Promise<{ orgId: string }> {
  const admin = await requireAdmin()
  if (value && !isDealStatus(value)) throw new Error(`Unknown deal status: ${value}`)
  const college = await prisma.localCollege.findUniqueOrThrow({
    where: { id: collegeId },
    select: { id: true, name: true, website: true, city: true, state: true },
  })
  const org = await ensureCollegeOrg(college)
  await prisma.crmOrganization.update({
    where: { id: org.id },
    data: { dealStatus: value && isDealStatus(value) ? value : null, dealStatusAt: new Date() },
  })
  await rankColleges()
  captureServerEvent(admin.email ?? 'admin', 'crm_deal_status_set', { orgId: org.id, collegeId, status: value || null, surface: 'colleges' })
  revalidatePath('/support/admin/crm/colleges')
  revalidatePath(`/support/admin/crm/organizations/${org.id}`)
  return { orgId: org.id }
}
