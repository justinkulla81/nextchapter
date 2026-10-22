'use server'

import { revalidatePath, updateTag } from 'next/cache'
import { requireAdmin } from '@/lib/admin/auth'
import { countyJobsTag } from '@/lib/crm/org-context-data'

/** Drops the cached open-job count for a county so the next view of the panel recounts it. Everything else in the panel is already live. */
export async function refreshOrgContext(fips: string | null, path: string) {
  await requireAdmin()
  if (fips) updateTag(countyJobsTag(fips))
  revalidatePath(path)
}
