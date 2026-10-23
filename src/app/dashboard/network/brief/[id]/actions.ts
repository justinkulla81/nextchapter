'use server'

import { revalidatePath } from 'next/cache'
import { getDashboardProfile } from '@/lib/dashboard/get-dashboard-data'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { briefOptOutUpdate } from '@/lib/senior-brief/rules'

/** "Not for me": no Monday message drafts or emails for 90 days. */
export async function pauseSeniorBrief(formData: FormData) {
  const profile = await getDashboardProfile()
  const update = briefOptOutUpdate('seniorBriefPause', new Date())
  if (!update) return
  await prisma.candidateProfile.update({ where: { id: profile.id }, data: update })
  captureServerEvent(profile.id, 'senior_brief_unsubscribed', {
    memberId: profile.id,
    kind: 'pause_90_days',
    source: 'dashboard',
    draftId: String(formData.get('draftId') ?? ''),
  })
  revalidatePath('/dashboard/network')
}
