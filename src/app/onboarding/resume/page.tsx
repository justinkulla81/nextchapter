import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/supabase/get-current-user'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { prisma } from '@/lib/prisma'
import { ResumeUploadForm } from '@/components/dashboard/ResumeUploadForm'
import { ExistingAccountNotice } from '@/components/auth/ExistingAccountNotice'
import { checkAndDeleteDuplicateProfile, findExistingRegisteredAccount } from '@/lib/onboarding/duplicate-check'
import { redirectIfNotCandidate } from '@/lib/auth/redirect-non-candidate'
import { BundleShell } from '@/components/onboarding/bundles/BundleShell'
import { PayoffPanel } from '@/components/onboarding/bundles/PayoffPanel'
import { PrimaryLink } from '@/components/onboarding/bundles/PrimaryLink'
import { flowOfProfile } from '@/lib/onboarding/flag'
import { computePayoff } from '@/lib/onboarding/payoff'
import { prefilledAnswers } from '@/lib/onboarding/prefilled'
import { BUNDLE_ROUTE } from '@/lib/onboarding/bundles'
import { effectiveJourney } from '@/lib/journey/journey'
import { entryOf, resumeRequired } from '@/lib/onboarding/resume-rule'
import { skipResume } from '@/app/onboarding/bundle-actions'
import { SkipResumeButton } from '@/components/onboarding/bundles/SkipResumeButton'

export default async function OnboardingResumePage() {
  const user = await getCurrentUser()

  // An admin, hiring manager, recruiter, or coach landing here (e.g. a
  // password-reset fallback redirect) should never silently get a stray
  // CandidateProfile created.
  if (user) {
    await redirectIfNotCandidate(user.id, user.email)
  }

  // No session yet at all — nothing to show a prior state for. The upload
  // form's action (uploadResume) lazily starts an anonymous session on
  // submit, so we don't need to create one just to render this page.
  const profile = user ? await getOrCreateCandidateProfile(user.id) : null
  // Members on the short question bundles (O2) get the same upload and the same duplicate-account checks, in the bundle's frame.
  const bundles = flowOfProfile(profile, user?.email) === 'bundles'

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
    // instead of just resuming — deletes this profile outright on a match,
    // same as uploadResume's own check.
    if (
      profile.resumeStepComplete ||
      (await prisma.resume.count({ where: { candidateId: profile.id, looksLikeResume: { not: false } } })) > 0
    ) {
      if (profile.email) {
        const existingAccount = await checkAndDeleteDuplicateProfile(profile.id, profile.email)
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
      // Your Path (desire) is now step 1 and always answered before resume
      // is reachable at all (see requireCandidateId in onboarding/actions.ts),
      // so the next step from here is always the confirm screen (§10's new
      // 4-screen sequence between resume upload and the contract screen).
      if (!bundles) redirect('/onboarding/confirm')

      // Bundles: show what the résumé already answered, then let them go on. Going back here stays possible.
      const prefilled = prefilledAnswers(profile)
      return (
        <BundleShell id="resume" title="We read your résumé.">
          <PayoffPanel payoff={computePayoff('resume', {}, { journey: null, prefilled })} label="What you gained" />
          <div className="flex flex-wrap items-center gap-5">
            <PrimaryLink href={BUNDLE_ROUTE.aiming}>Continue</PrimaryLink>
            <p className="text-sm text-muted-foreground">Next: check three answers we read from it.</p>
          </div>
        </BundleShell>
      )
    }
  }

  if (bundles) {
    // Required for people out of work and for Market Reality arrivals; everyone else may skip it and is asked on login.
    const required = resumeRequired({ journey: profile ? effectiveJourney(profile) : null, entry: entryOf(profile?.journeyDetails) })
    return (
      <BundleShell id="resume" title={required ? 'Start with your résumé' : 'Add your résumé, or skip for now'}>
        <ResumeUploadForm showNarrativePicker={false} resumeBookOptIn={profile?.resumeBookOptIn ?? true} />
        {required ? (
          <p className="text-sm text-muted-foreground">Your Market Reality is worked out from your résumé, so this step cannot be skipped.</p>
        ) : (
          <form action={skipResume} className="space-y-2">
            <SkipResumeButton />
            <p className="text-sm text-muted-foreground">You can add it any time. We will remind you on your home page, and it unlocks your Market Reality.</p>
          </form>
        )}
        <PayoffPanel payoff={computePayoff('resume', {}, { journey: null, prefilled: [] })} />
      </BundleShell>
    )
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
        <li>
          • <span className="font-semibold text-foreground">A free account to start</span> — no
          credit card, no catch.
        </li>
        <li>
          •{' '}
          <span className="font-semibold text-foreground">
            An honest resume review with your Market Reality Assessment
          </span>{' '}
          — see exactly what&apos;s holding you back.
        </li>
        <li>
          • <span className="font-semibold text-foreground">A personalized action plan built for you</span>{' '}
          — real steps, not vague advice.
        </li>
        <li>
          •{' '}
          <span className="font-semibold text-foreground">
            A community that truly gets what you&apos;re going through
          </span>{' '}
          — you&apos;re not alone in this.
        </li>
        <li>
          • <span className="font-semibold text-foreground">Resources to bridge the gap</span> —
          interim work, new skills, and a path to your next great job.
        </li>
      </ul>

      <p className="text-sm text-muted-foreground">
        Your answers are private by default — never visible to recruiters or other members unless
        you explicitly choose to share them. This is just a baseline: once you&apos;ve worked your
        action plan, you&apos;ll be able to retake it — so don&apos;t overthink your answers here.
      </p>

      <ResumeUploadForm showNarrativePicker={false} resumeBookOptIn={profile?.resumeBookOptIn ?? true} />
    </div>
  )
}
