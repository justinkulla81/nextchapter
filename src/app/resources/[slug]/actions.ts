'use server'

import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { captureServerEvent } from '@/lib/posthog/server'
import { sendGuideDeliveryEmail } from '@/lib/email/send-guide-delivery'
import { GUIDES } from '@/lib/constants/guides'
import { allowByIp, allowByTarget, DAY_MS, HOUR_MS, RATE_LIMITED_MESSAGE } from '@/lib/security/rate-limit'
import { notifyNewLead } from '@/lib/leads/notify-new-lead'

export type GuideLeadFormState = { error?: string; sent?: boolean } | undefined

export async function submitGuideLead(
  slug: string,
  source: string,
  _prevState: GuideLeadFormState,
  formData: FormData
): Promise<GuideLeadFormState> {
  const email = (formData.get('email') as string | null)?.trim()
  const firstName = (formData.get('firstName') as string | null)?.trim() || null

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: 'Enter a valid email.' }
  }

  const guide = GUIDES.find((g) => g.slug === slug)
  if (!guide) {
    return { error: 'Guide not found.' }
  }

  if (!(await allowByIp('guide-lead', 15, HOUR_MS))) return { error: RATE_LIMITED_MESSAGE }
  if (!(await allowByTarget('guide-lead-email', email, 5, DAY_MS))) {
    return { error: 'We already sent guides to that address today. Check your inbox, or try again tomorrow.' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const candidateId = user ? (await getOrCreateCandidateProfile(user.id)).id : null

  await prisma.guideLead.create({
    data: { candidateId, email, firstName, guideSlug: slug, source },
  })
  notifyNewLead({ email, name: firstName, channel: 'Guide download', detail: `${slug} · ${source}` })

  await sendGuideDeliveryEmail(email, firstName, guide.title, slug)

  captureServerEvent(candidateId ?? email, 'guide_email_captured', { guideSlug: slug, source })

  return { sent: true }
}
