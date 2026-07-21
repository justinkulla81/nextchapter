import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/supabase/get-current-user'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { prisma } from '@/lib/prisma'
import { ResumeUploadForm } from '@/components/dashboard/ResumeUploadForm'
import { ExistingAccountNotice } from '@/components/auth/ExistingAccountNotice'
import { checkAndFlagDuplicateEmail, findExistingRegisteredAccount } from '@/lib/onboarding/duplicate-check'

export default async function OnboardingResumePage() {
  const user = await getCurrentUser()

  // No session yet at all — nothing to show a prior state for. The upload
  // form's action (uploadResume) lazily starts an anonymous session on
  // submit, so we don't need to create one just to render this page.
  const profile = user ? await getOrCreateCandidateProfile(user.id) : null

  if (profile) {
    if (profile.registrationCompletedAt) {
      redirect('/dashboard')
    }

    // A prior visit already flagged this profile's email as belonging to
    // someone else's registered account (either right here, or at upload
    // time in uploadResume) — show the same notice again rather than
    // silently resuming an onboarding session that can never finish.
    if (profile.duplicateEmailBlockedAt) {
      const existing = profile.email
        ? await findExistingRegisteredAccount(profile.email, profile.id)
        : null
      return (
        <div className="space-y-6">
          <h1 className="text-2xl font-semibold tracking-tight">You already have an account</h1>
          <ExistingAccountNotice needsPassword={!existing?.passwordSetAt} email={profile.email} />
        </div>
      )
    }

    // Returning to this page after the resume step was already completed —
    // either in an earlier visit (resumeStepComplete) or just now for the
    // first time (resumeCount > 0, the legacy fallback below). uploadResume's
    // own duplicate check only runs at the moment of upload, so a session
    // that uploaded a resume, then came back later without ever finishing
    // registration, would otherwise skip straight into "Your Path" every
    // time and only get caught at the very last step (create-account) after
    // redoing the whole flow. Re-check here, before either exit redirects,
    // instead of just resuming.
    if (profile.resumeStepComplete || (await prisma.resume.count({ where: { candidateId: profile.id } })) > 0) {
      if (profile.email) {
        const existingAccount = await checkAndFlagDuplicateEmail(profile.id, profile.email)
        if (existingAccount) {
          return (
            <div className="space-y-6">
              <h1 className="text-2xl font-semibold tracking-tight">You already have an account</h1>
              <ExistingAccountNotice
                needsPassword={!existingAccount.passwordSetAt}
                email={profile.email}
              />
            </div>
          )
        }
      }

      if (!profile.resumeStepComplete) {
        await prisma.candidateProfile.update({
          where: { id: profile.id },
          data: { resumeStepComplete: true },
        })
      }
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
