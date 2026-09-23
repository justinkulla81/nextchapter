'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin/auth'

/** Marks every open report for one rule as reviewed (the rule was fixed, or judged a one-off). */
export async function markRuleReviewed(rule: string) {
  await requireAdmin()
  await prisma.classificationFeedback.updateMany({
    where: { reviewedAt: null, matchedRule: rule === '__none__' ? null : rule },
    data: { reviewedAt: new Date() },
  })
  revalidatePath('/support/admin/classification-feedback')
}
