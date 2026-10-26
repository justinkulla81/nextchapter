'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/admin/auth'
import { captureServerEvent } from '@/lib/posthog/server'
import { resolveCollegeAsDifferent, resolveCollegeAsSame, resolveReviewGroupAsDifferent, REVIEW_GROUPS, type ReviewGroup } from '@/lib/workforce/college-org-link'

export async function linkCollegeToSuggestedOrg(unitid: string): Promise<void> {
  const admin = await requireAdmin()
  await resolveCollegeAsSame(unitid)
  captureServerEvent(admin.email ?? 'admin', 'college_match_resolved', { unitid, decision: 'same' })
  revalidatePath('/support/admin/crm/needs-completion')
}

export async function addCollegeAsNewOrg(unitid: string): Promise<void> {
  const admin = await requireAdmin()
  await resolveCollegeAsDifferent(unitid)
  captureServerEvent(admin.email ?? 'admin', 'college_match_resolved', { unitid, decision: 'different' })
  revalidatePath('/support/admin/crm/needs-completion')
}

/** Review List: settle the next batch of one kind of suggestion as "different, add as new". */
export async function addCollegeGroupAsNewOrgs(group: ReviewGroup): Promise<void> {
  const admin = await requireAdmin()
  if (!(group in REVIEW_GROUPS)) throw new Error('Unknown group.')
  const done = await resolveReviewGroupAsDifferent(group)
  captureServerEvent(admin.email ?? 'admin', 'college_match_group_resolved', { group, count: done, decision: 'different' })
  revalidatePath('/support/admin/crm/needs-completion')
}
