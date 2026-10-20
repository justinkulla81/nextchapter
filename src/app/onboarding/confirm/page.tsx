import { redirect } from 'next/navigation'
import { getCandidateProfileForUser } from '@/lib/onboarding/get-profile'
import { ResumeConfirmForm } from '@/components/onboarding/ResumeConfirmForm'
import { VictoriaAvatar } from '@/components/VictoriaAvatar'
import { getPrimaryEducation } from '@/lib/early-career/data'
import { BundleShell } from '@/components/onboarding/bundles/BundleShell'
import { BundleForm } from '@/components/onboarding/bundles/BundleForm'
import { submitAiming } from '@/app/onboarding/bundle-actions'
import { effectiveJourney } from '@/lib/journey/journey'
import { flowOfProfile } from '@/lib/onboarding/flag'
import { storedAnswers } from '@/lib/onboarding/answers'
import { usableAnswers } from '@/lib/onboarding/bundles'

export default async function ConfirmPage() {
  const profile = await getCandidateProfileForUser()

  if (!profile.resumeStepComplete) {
    redirect('/onboarding/resume')
  }
  // The short question bundles (O3). Like the other bundle pages it never skips forward, so Back and "change my answer" work.
  if (flowOfProfile(profile) === 'bundles') {
    const journey = effectiveJourney(profile)
    return (
      <BundleShell id="aiming">
        <BundleForm
          bundle="aiming"
          initial={usableAnswers('aiming', { journey }, storedAnswers(profile))}
          storedJourney={journey}
          payoffInput={{ storedStage: profile.journeyStage }}
          action={submitAiming}
          previewJobs="aiming"
        />
      </BundleShell>
    )
  }
  if (profile.onboardingResumeConfirmedAt) {
    redirect('/onboarding/location')
  }
  // The résumé's school, pre-filled for students and early-career members.
  const education = await getPrimaryEducation(profile.id).catch(() => null)

  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <div className="max-w-xl space-y-1 text-left">
        <div className="flex items-center gap-2">
          <VictoriaAvatar size={56} />
          <p className="text-muted-foreground">Victoria says:</p>
        </div>
        <div className="relative ml-2 rounded-2xl bg-muted/50 px-6 py-5">
          <div className="absolute -top-2 left-8 size-4 rotate-45 rounded-[3px] bg-muted/50" />
          <p className="text-sm text-foreground">
            &ldquo;Here&apos;s what I pulled off your resume. Quick check before we go
            further — did I get it right?&rdquo;
          </p>
        </div>
      </div>
      <ResumeConfirmForm profile={profile} education={education} />
    </div>
  )
}
