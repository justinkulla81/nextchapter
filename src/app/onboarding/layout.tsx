import type { Metadata } from 'next'
import { getCurrentUser } from '@/lib/supabase/get-current-user'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { redirectIfNotCandidate } from '@/lib/auth/redirect-non-candidate'
import { OnboardingStepper } from '@/components/onboarding/OnboardingStepper'
import { Logo } from '@/components/Logo'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  // Fetched directly (not via getCandidateProfileForUser) — this layout
  // wraps /onboarding/desire itself, and that function redirects
  // session-less visitors to /onboarding/desire, which would self-loop.
  // A brand-new visitor simply has no profile yet; render the stepper with
  // nothing marked done rather than redirecting.
  const user = await getCurrentUser()

  // An admin, hiring manager, recruiter, or coach landing anywhere under
  // /onboarding (e.g. a password-reset fallback redirect) should never
  // silently get a stray CandidateProfile created — this layout wraps
  // every page below it, so the check has to live here too, not just in
  // the individual pages.
  if (user) {
    await redirectIfNotCandidate(user.id, user.email)
  }

  const profile = user ? await getOrCreateCandidateProfile(user.id) : null

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border">
        <div className="mx-auto max-w-2xl px-6 pt-4">
          <Logo className="text-2xl" />
        </div>
        <OnboardingStepper
          completion={[profile?.desireComplete ?? false, profile?.resumeStepComplete ?? false]}
        />
      </header>
      <main className="flex flex-1 justify-center px-6 py-12">
        <div className="w-full max-w-2xl">{children}</div>
      </main>
    </div>
  )
}
