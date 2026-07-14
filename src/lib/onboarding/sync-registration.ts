import 'server-only'
import type { User } from '@supabase/supabase-js'
import { prisma } from '@/lib/prisma'
import type { CandidateProfile } from '@prisma/client'

// Registration completes the moment the candidate's Supabase auth user
// stops being anonymous — whether via clicking the "create your account"
// confirmation link, clicking a reminder-email magic link, Google OAuth, or
// classic email+password signup. Rather than hook every one of those entry
// points individually, we opportunistically sync the cached
// `registrationCompletedAt` flag (used for fast dashboard/report gating)
// against the live session's `is_anonymous` value wherever a profile is
// fetched for an authenticated request. Returns whether this call just
// transitioned the profile to registered, so the caller can trigger
// one-time side effects (report generation).
export async function syncRegistrationCompletion(
  user: User,
  profile: CandidateProfile
): Promise<{ profile: CandidateProfile; justRegistered: boolean }> {
  if (user.is_anonymous || profile.registrationCompletedAt) {
    return { profile, justRegistered: false }
  }

  const updated = await prisma.candidateProfile.update({
    where: { id: profile.id },
    data: { registrationCompletedAt: new Date() },
  })

  return { profile: updated, justRegistered: true }
}
