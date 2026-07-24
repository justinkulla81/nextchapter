import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/supabase/get-current-user'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { syncRegistrationCompletion } from '@/lib/onboarding/sync-registration'
import { prisma } from '@/lib/prisma'

export async function getCandidateProfileForUser() {
  const user = await getCurrentUser()

  if (!user) {
    // No session at all (not even anonymous) — send them to the actual
    // first step, which lazily starts an anonymous session on upload,
    // rather than a login page that implies a password is required.
    redirect('/onboarding/resume')
  }

  // A hiring manager, recruiter, or coach who ends up here by mistake
  // should never silently get a stray CandidateProfile created for them.
  const employer = await prisma.employerProfile.findUnique({
    where: { userId: user.id },
    select: { id: true },
  })
  if (employer) {
    redirect('/talent')
  }

  const recruiter = await prisma.recruiter.findUnique({
    where: { userId: user.id },
    select: { id: true },
  })
  if (recruiter) {
    redirect('/recruiters/dashboard')
  }

  const coach = await prisma.coach.findUnique({
    where: { userId: user.id },
    select: { id: true },
  })
  if (coach) {
    redirect('/support/coach')
  }

  const profile = await getOrCreateCandidateProfile(user.id)
  const { profile: synced } = await syncRegistrationCompletion(user, profile)
  return synced
}
