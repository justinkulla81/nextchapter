import 'server-only'
import type { User } from '@supabase/supabase-js'
import { prisma } from '@/lib/prisma'
import type { CandidateProfile } from '@prisma/client'
import { captureServerEvent } from '@/lib/posthog/server'
import { findExistingRegisteredAccount } from '@/lib/onboarding/duplicate-check'

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
  // Google identity linking (SecureAccountForm's "Connect Google instead")
  // redirects straight to the OAuth provider, so there's no reliable moment
  // in that flow to stamp passwordSetAt directly — catch it here instead,
  // the same opportunistic way registrationCompletedAt itself is caught.
  if (!profile.passwordSetAt && user.identities?.some((i) => i.provider === 'google')) {
    profile = await prisma.candidateProfile.update({
      where: { id: profile.id },
      data: { passwordSetAt: new Date() },
    })
  }

  // A real candidate only ever stops being anonymous at the very last
  // onboarding step (create-account), which itself refuses to run until
  // assessmentComplete is already true (see onboarding/create-account/
  // page.tsx) — so requiring it here changes nothing for any normal user.
  // It guards against the one edge case that doesn't go through that path:
  // an account created directly (e.g. an admin-side recreation) that's
  // non-anonymous from birth but has done none of the actual onboarding —
  // without this, that shape gets stamped "registered" immediately, while
  // every step-completion flag stays false, and pages that gate on one but
  // not the other end up redirecting a candidate in circles.
  if (
    user.is_anonymous ||
    profile.registrationCompletedAt ||
    profile.duplicateEmailBlockedAt ||
    !profile.assessmentComplete
  ) {
    return { profile, justRegistered: false }
  }

  // The Supabase auth user itself has already been confirmed as
  // non-anonymous at this point (email confirmed, or a Google identity
  // linked) — that can't be undone here. What we still control is whether
  // THIS profile gets treated as a second, real account for someone who
  // already has one: if the now-confirmed email matches another registered
  // candidate, refuse to complete registration and flag it instead, so the
  // create-account page can send them to log into their existing account
  // rather than silently building a duplicate. `user.email` (not
  // `profile.email`, which is only ever resume-derived) is the authoritative
  // address here, since it's the one Supabase just confirmed.
  const confirmedEmail = user.email ?? profile.email
  if (confirmedEmail) {
    const existing = await findExistingRegisteredAccount(confirmedEmail, profile.id)
    if (existing) {
      const blocked = await prisma.candidateProfile.update({
        where: { id: profile.id },
        data: { duplicateEmailBlockedAt: new Date() },
      })
      captureServerEvent(blocked.id, 'duplicate_account_blocked', { email: confirmedEmail })
      return { profile: blocked, justRegistered: false }
    }
  }

  const updated = await prisma.candidateProfile.update({
    where: { id: profile.id },
    data: { registrationCompletedAt: new Date(), email: confirmedEmail ?? undefined },
  })

  captureServerEvent(updated.id, 'account_created', { email: updated.email ?? undefined })

  return { profile: updated, justRegistered: true }
}
