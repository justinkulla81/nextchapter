'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'

export interface SubmitApplicationState {
  error?: string
}

export async function submitEqOverIqApplication(
  _prevState: SubmitApplicationState | undefined,
  formData: FormData
): Promise<SubmitApplicationState> {
  const background = (formData.get('background') as string | null)?.trim()
  const experienceSummary = (formData.get('experienceSummary') as string | null)?.trim()
  const whyFractionalAiWork = (formData.get('whyFractionalAiWork') as string | null)?.trim()
  const portfolioLinks = ((formData.get('portfolioLinks') as string | null) ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  const interestAreas = formData.getAll('interestAreas') as string[]

  if (!background || !experienceSummary || !whyFractionalAiWork) {
    return { error: 'Please fill in your background, experience, and why fractional AI work interests you.' }
  }
  if (interestAreas.length === 0) {
    return { error: 'Select at least one area you’re interested in.' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/eqoveriq/contributors/login')

  const profile = await prisma.eqOverIqContributorProfile.findUnique({ where: { userId: user.id } })
  if (!profile) redirect('/eqoveriq/contributors/signup')

  await prisma.eqOverIqContributorProfile.update({
    where: { id: profile.id },
    data: {
      background,
      experienceSummary,
      portfolioLinks,
      interestAreas,
      whyFractionalAiWork,
      submittedAt: new Date(),
    },
  })

  captureServerEvent(user.id, 'eqoveriq_application_submitted', {
    interestAreas,
    portfolioLinkCount: portfolioLinks.length,
  })

  redirect('/eqoveriq/contributors')
}
