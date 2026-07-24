'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { captureServerEvent } from '@/lib/posthog/server'

async function requireCandidateId(): Promise<string> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const profile = await prisma.candidateProfile.findUniqueOrThrow({ where: { userId: user.id }, select: { id: true } })
  return profile.id
}

export async function submitCoachPreferences(formData: FormData) {
  const candidateId = await requireCandidateId()
  const get = (key: string) => (formData.get(key) as string | null)?.trim() || null

  await prisma.candidateProfile.update({
    where: { id: candidateId },
    data: {
      coachGenderPreference: get('genderPreference'),
      coachCommunicationStylePreference: get('communicationStylePreference'),
      coachLanguagePreference: get('languagePreference'),
      coachTimezonePreference: get('timezonePreference'),
    },
  })

  captureServerEvent(candidateId, 'coach_match_preferences_submitted')
  redirect('/dashboard/coaching-match?step=shortlist')
}

export async function selectCoach(coachId: string) {
  const candidateId = await requireCandidateId()

  // coachId is set once and never re-assigned elsewhere in this codebase
  // (see the field comment on CandidateProfile) — if a coach is already
  // assigned, this is a no-op rather than silently overwriting it.
  const current = await prisma.candidateProfile.findUniqueOrThrow({ where: { id: candidateId }, select: { coachId: true } })
  if (current.coachId) {
    redirect('/dashboard')
  }

  await prisma.candidateProfile.update({ where: { id: candidateId }, data: { coachId } })
  captureServerEvent(candidateId, 'coach_matched', { coachId })
  revalidatePath('/dashboard')
  redirect('/dashboard')
}
