import type { Metadata } from 'next'
import { getCurrentUser } from '@/lib/supabase/get-current-user'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { OnboardingStepper } from '@/components/onboarding/OnboardingStepper'
import { Logo } from '@/components/Logo'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  // Fetched directly (not via getCandidateProfileForUser) — this layout
  // wraps /onboarding/resume itself, and that function redirects
  // session-less visitors to /onboarding/resume, which would self-loop.
  // A brand-new visitor simply has no profile yet; render the stepper with
  // nothing marked done rather than redirecting.
  const user = await getCurrentUser()
  const profile = user ? await getOrCreateCandidateProfile(user.id) : null

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border">
        <div className="mx-auto max-w-2xl px-6 pt-4">
          <Logo className="text-2xl" />
        </div>
        <OnboardingStepper
          completion={[
            profile?.resumeStepComplete ?? false,
            profile?.desireComplete ?? false,
            profile?.part1Complete ?? false,
            profile?.part3Complete ?? false,
            profile?.part4Complete ?? false,
          ]}
        />
      </header>
      <main className="flex flex-1 justify-center px-6 py-12">
        <div className="w-full max-w-2xl">{children}</div>
      </main>
    </div>
  )
}
