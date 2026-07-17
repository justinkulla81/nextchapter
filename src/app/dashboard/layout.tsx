import type { Metadata } from 'next'
import { DashboardNav } from '@/components/dashboard/DashboardNav'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { computeHireabilityGrade } from '@/lib/scoring/hireability-grade'
import { IdentifyUser } from '@/lib/posthog/IdentifyUser'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

// The first-registration report generation + email (see get-dashboard-data.ts's
// `after()` block) runs an LLM call plus an email send in the background after
// the response is sent — comfortably past the platform's default function
// duration, which was silently truncating it before the email ever went out.
export const maxDuration = 60

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const profile = await getDashboardData()
  const grade = await computeHireabilityGrade(profile)
  const recruiterUnlocked = grade.searchExecution.grade === 'A'

  return (
    <div className="min-h-screen">
      <IdentifyUser candidateId={profile.id} email={profile.email} />
      <DashboardNav hideWorkSamples={profile.workSampleType === 'none'} recruiterUnlocked={recruiterUnlocked} />
      <main className="px-6 py-12 lg:pl-[calc(16rem+1.5rem)]">
        <div className="mx-auto max-w-4xl">{children}</div>
      </main>
    </div>
  )
}
