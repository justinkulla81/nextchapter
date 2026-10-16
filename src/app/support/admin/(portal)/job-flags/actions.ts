'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'

/** Marks every member flag on a posting as reviewed (it leaves the open list; ghost risk still counts it). */
export async function markJobFlagsReviewed(formData: FormData) {
  await requireAdmin()
  const postingId = String(formData.get('postingId') ?? '')
  if (!postingId) return
  await prisma.jobPostingFlag.updateMany({ where: { postingId, reviewedAt: null }, data: { reviewedAt: new Date() } })
  revalidatePath('/support/admin/job-flags')
}
