import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getDashboardProfile } from '@/lib/dashboard/get-dashboard-data'
import { getCoachTemplate, hasSubmittedCoachingOnboardingForm } from '@/lib/coach/onboarding-form'
import { hasSubmittedConfidentialDisclosure } from '@/lib/coach/confidential-disclosure'
import { prisma } from '@/lib/prisma'
import { PageHeader } from '@/components/candidate/PageHeader'
import { CoachingOnboardingForm } from '@/components/onboarding/CoachingOnboardingForm'
import { ConfidentialDisclosureForm } from '@/components/onboarding/ConfidentialDisclosureForm'
import { submitCoachingOnboardingFormDashboard, submitConfidentialDisclosureDashboard } from '@/app/dashboard/coaching-form/actions'

export const metadata: Metadata = { title: 'Coaching Intake Form' }

export default async function DashboardCoachingFormPage() {
  const profile = await getDashboardProfile()

  if (!profile.coachId || !profile.coachDossierConsentedAt) {
    redirect('/dashboard')
  }

  const [mainFormDone, disclosureDone, coach] = await Promise.all([
    hasSubmittedCoachingOnboardingForm(profile.id),
    hasSubmittedConfidentialDisclosure(profile.id),
    prisma.coach.findUniqueOrThrow({ where: { id: profile.coachId }, select: { fullName: true } }),
  ])
  if (mainFormDone && disclosureDone) {
    redirect('/dashboard')
  }

  if (mainFormDone) {
    return (
      <div className="mx-auto max-w-lg space-y-6">
        <ConfidentialDisclosureForm coachFirstName={coach.fullName.split(' ')[0]} onSubmit={submitConfidentialDisclosureDashboard} />
      </div>
    )
  }

  const template = (await getCoachTemplate(profile.coachId)).filter((q) => q.enabled)

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <PageHeader
        title={`A few questions from ${coach.fullName}`}
        intro={`Your answers help ${coach.fullName} make the first session useful. They cover your goals and how you like to work together, nothing sensitive.`}
      />
      <CoachingOnboardingForm
        template={template}
        onSubmit={submitCoachingOnboardingFormDashboard}
        submitLabel="Continue"
      />
    </div>
  )
}
