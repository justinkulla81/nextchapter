import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { isAdminEmail } from '@/lib/admin/auth'

// A logged-in user with no CandidateProfile falls through every
// candidate-flow entry point's "no profile -> create one" logic exactly
// like a brand-new signup, unless that entry point explicitly rules out
// the other portal roles first. Centralizing the check here so a future
// call site can't reintroduce the same gap that let admin/coach/recruiter
// accounts pick up a stray CandidateProfile (e.g. via a password-reset
// fallback redirect landing on /dashboard or /onboarding/resume directly).
export async function redirectIfNotCandidate(userId: string, email: string | null | undefined) {
  if (isAdminEmail(email)) {
    redirect('/support/admin')
  }

  const employer = await prisma.employerProfile.findUnique({ where: { userId }, select: { id: true } })
  if (employer) redirect('/talent')

  const recruiter = await prisma.recruiter.findUnique({ where: { userId }, select: { id: true } })
  if (recruiter) redirect('/recruiters/dashboard')

  const coach = await prisma.coach.findUnique({ where: { userId }, select: { id: true } })
  if (coach) redirect('/support/coach')
}
