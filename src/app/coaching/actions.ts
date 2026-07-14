'use server'

import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateCandidateProfile } from '@/lib/profile'

export type CoachingWaitlistFormState = { error?: string; sent?: boolean } | undefined

export async function joinCoachingWaitlist(
  source: string,
  _prevState: CoachingWaitlistFormState,
  formData: FormData
): Promise<CoachingWaitlistFormState> {
  const email = (formData.get('email') as string | null)?.trim()
  const firstName = (formData.get('firstName') as string | null)?.trim() || null
  const lastName = (formData.get('lastName') as string | null)?.trim() || null
  const challenge = (formData.get('challenge') as string | null)?.trim() || null

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: 'Enter a valid email.' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const candidateId = user ? (await getOrCreateCandidateProfile(user.id)).id : null

  await prisma.coachingWaitlist.create({
    data: { candidateId, email, firstName, lastName, challenge, source },
  })

  return { sent: true }
}
