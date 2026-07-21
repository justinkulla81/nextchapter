import { redirect } from 'next/navigation'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { getCoachTemplate, hasSubmittedCoachingOnboardingForm } from '@/lib/coach/onboarding-form'
import { prisma } from '@/lib/prisma'
import { CoachingOnboardingForm } from '@/components/onboarding/CoachingOnboardingForm'
import { submitCoachingOnboardingFormDashboard } from '@/app/dashboard/coaching-form/actions'

export default async function DashboardCoachingFormPage() {
  const profile = await getDashboardData()

  if (!profile.coachId || !profile.coachDossierConsentedAt) {
    redirect('/dashboard')
  }
  if (await hasSubmittedCoachingOnboardingForm(profile.id)) {
    redirect('/dashboard')
  }

  const coach = await prisma.coach.findUniqueOrThrow({ where: { id: profile.coachId }, select: { fullName: true } })
  const template = (await getCoachTemplate(profile.coachId)).filter((q) => q.enabled)

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          A few questions from {coach.fullName}
        </h1>
        <p className="text-muted-foreground">
          Standard kickoff questions — goal-setting and how you&apos;d like to work together. Nothing
          sensitive; save that for your actual conversations with {coach.fullName}.
        </p>
      </div>
      <CoachingOnboardingForm
        template={template}
        onSubmit={submitCoachingOnboardingFormDashboard}
        submitLabel="Continue to my dashboard"
      />
    </div>
  )
}
