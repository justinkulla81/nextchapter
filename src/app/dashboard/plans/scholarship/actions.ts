'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { captureServerEvent } from '@/lib/posthog/server'

export type ScholarshipFormState = { error?: string; submitted?: boolean } | undefined

const RECOMMENDED_TIER = 'dtc_coaching_premium'

// Always routes to manual admin review (ScholarshipApplication.status starts
// PENDING and only an admin-invoked action in the support portal ever moves
// it to APPROVED/REJECTED — see support/admin/(portal)/scholarship-applications/actions.ts).
// No keyword matching, no self-reported-severity scoring, no automatic
// approval path exists here or anywhere else in this flow.
export async function submitScholarshipApplication(
  _prevState: ScholarshipFormState,
  formData: FormData
): Promise<ScholarshipFormState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'You need to be logged in to do this.' }

  const profile = await getOrCreateCandidateProfile(user.id)

  const existing = await prisma.scholarshipApplication.findFirst({
    where: { candidateId: profile.id, status: 'PENDING' },
  })
  if (existing) return { error: "You already have an application under review — we'll follow up soon." }

  const story = (formData.get('story') as string | null)?.trim()
  if (!story || story.length < 20) {
    return { error: 'Tell us a little more about your situation so we can review it fairly.' }
  }

  await prisma.scholarshipApplication.create({
    data: { candidateId: profile.id, tier: RECOMMENDED_TIER, story },
  })
  captureServerEvent(profile.id, 'scholarship_application_submitted', { tier: RECOMMENDED_TIER })

  revalidatePath('/dashboard/plans/scholarship')
  return { submitted: true }
}
