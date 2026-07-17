import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/supabase/get-current-user'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { prisma } from '@/lib/prisma'
import { ResumeUploadForm } from '@/components/dashboard/ResumeUploadForm'

export default async function OnboardingResumePage() {
  const user = await getCurrentUser()

  // No session yet at all — nothing to show a prior state for. The upload
  // form's action (uploadResume) lazily starts an anonymous session on
  // submit, so we don't need to create one just to render this page.
  const profile = user ? await getOrCreateCandidateProfile(user.id) : null

  if (profile) {
    if (profile.resumeStepComplete) {
      redirect('/onboarding/desire')
    }

    const resumeCount = await prisma.resume.count({ where: { candidateId: profile.id } })
    if (resumeCount > 0) {
      await prisma.candidateProfile.update({
        where: { id: profile.id },
        data: { resumeStepComplete: true },
      })
      redirect('/onboarding/desire')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Let&apos;s start with your resume</h1>
        <p className="mt-1 text-muted-foreground">
          Upload your resume — we&apos;ll use it to auto-fill most of your profile (name, contact
          info, experience) so you don&apos;t have to retype everything. Required to continue.
          This can take a minute or two while we read it closely — no need to refresh.
        </p>
      </div>

      <ul className="space-y-1.5 text-sm text-muted-foreground">
        <li>• A free account, no credit card required.</li>
        <li>• A free, honest review of your resume — see exactly what&apos;s holding it back.</li>
        <li>• Your Market Reality Grade, Search Action Grade, and a personalized action plan, not vague advice.</li>
        <li>• Access to a community of people who get exactly what you&apos;re going through.</li>
      </ul>

      <p className="text-sm text-muted-foreground">
        Your answers are private by default — never visible to recruiters or other members unless
        you explicitly choose to share them. This is just a baseline: once you&apos;ve worked your
        action plan, you&apos;ll be able to retake it — so don&apos;t overthink your answers here.
      </p>

      <ResumeUploadForm />
    </div>
  )
}
