'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { captureServerEvent } from '@/lib/posthog/server'
import { recordReferral } from '@/lib/candidates/referral'
import { HOW_HEARD_OPTIONS } from '@/lib/onboarding/how-heard-options'

export async function submitHowHeard(formData: FormData): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  const profile = await prisma.candidateProfile.findUnique({ where: { userId: user.id }, select: { id: true, leadSource: true, leadSourceSetBy: true } })
  if (!profile) return

  const option = HOW_HEARD_OPTIONS.find((o) => o.value === String(formData.get('howHeard') ?? ''))
  const who = String(formData.get('whoRecommended') ?? '').trim().slice(0, 120) || null
  if (!option) return

  if (option.referrer) {
    await recordReferral({ candidateId: profile.id, kind: option.referrer, channel: 'SIGNUP_QUESTION', setBy: 'self', referrerName: who })
  } else if (!profile.leadSource || profile.leadSourceSetBy === 'auto') {
    await prisma.candidateProfile.update({
      where: { id: profile.id },
      data: { leadSource: option.source, leadSourceDetail: who, leadSourceSetBy: 'self', leadSourceSetAt: new Date() },
    })
  }
  captureServerEvent(profile.id, 'how_heard_submitted', { answer: option.value, namedRecommender: !!who })
  revalidatePath('/onboarding/welcome')
}
