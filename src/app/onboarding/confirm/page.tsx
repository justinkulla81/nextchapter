import { redirect } from 'next/navigation'
import { getCandidateProfileForUser } from '@/lib/onboarding/get-profile'
import { ResumeConfirmForm } from '@/components/onboarding/ResumeConfirmForm'
import { VictoriaAvatar } from '@/components/VictoriaAvatar'
import { StepLabel } from '@/components/onboarding/StepLabel'

export default async function ConfirmPage() {
  const profile = await getCandidateProfileForUser()

  if (!profile.resumeStepComplete) {
    redirect('/onboarding/resume')
  }
  if (profile.onboardingResumeConfirmedAt) {
    redirect('/onboarding/location')
  }

  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <div className="max-w-xl space-y-1 text-left">
        <StepLabel step={3} total={5} />
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
      <ResumeConfirmForm profile={profile} />
    </div>
  )
}
