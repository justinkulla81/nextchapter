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
import { entryOf } from '@/lib/onboarding/resume-rule'
import { DETAILS_PATH, needsContactDetails } from '@/lib/onboarding/details'
import { skipResume } from '@/app/onboarding/bundle-actions'
import { SkipResumeButton } from '@/components/onboarding/bundles/SkipResumeButton'
import { ResumeParseProgress } from '@/components/onboarding/bundles/ResumeParseProgress'
import { ResumeParseProblem } from '@/components/onboarding/bundles/ResumeParseProblem'
import { readParseState } from '@/lib/resume/parse-state'
import { parseView } from '@/lib/resume/parse-view'

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
  // Why the last upload was turned down, when it was (not a résumé, or no contact details on it).
  let rejectedReason: string | undefined

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

    // The upload returns once the file is stored; the reading happens afterwards (startResumeUpload). While it
    // runs, or after it failed, this page is the only place that answers for it: nothing later in onboarding
    // may show half-filled answers, so the steps after this one stay behind resumeStepComplete as before.
    const reading = parseView(readParseState(profile.journeyDetails))
    if (reading.kind === 'processing' || reading.kind === 'failed') {
      return (
        <ReadingFrame bundles={bundles}>
          {reading.kind === 'processing' ? (
            <ResumeParseProgress fileName={reading.fileName} />
          ) : (
            <ResumeParseProblem fileName={reading.fileName} stalled={reading.stalled} />
          )}
        </ReadingFrame>
      )
    }
    if (reading.kind === 'rejected') rejectedReason = reading.reason

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
            <PrimaryLink href={needsContactDetails(profile) ? DETAILS_PATH : BUNDLE_ROUTE.aiming}>Continue</PrimaryLink>
            <p className="text-sm text-muted-foreground">
              {needsContactDetails(profile) ? 'Next: we need your name and email.' : 'Next: check three answers we read from it.'}
            </p>
          </div>
        </BundleShell>
      )
    }
  }

  if (bundles) {
    // Never required: skipping goes to the details step (name, email, LinkedIn). A Market Reality arrival is told what the résumé adds.
    const marketReality = entryOf(profile?.journeyDetails) !== null
    return (
      <BundleShell id="resume" title="Add your résumé, or skip for now">
        <ResumeUploadForm showNarrativePicker={false} resumeBookOptIn={profile?.resumeBookOptIn ?? true} background initialError={rejectedReason} />
        <form action={skipResume} className="space-y-2">
          <SkipResumeButton />
          <p className="text-sm text-muted-foreground">
            {marketReality
              ? 'No résumé handy? Skip it and give us your name and email instead. Your Market Reality is sharpest with a résumé, and you can add one any time.'
              : 'No résumé handy? Skip it and give us your name and email instead. You can add one any time.'}
          </p>
        </form>
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

      <ResumeUploadForm showNarrativePicker={false} resumeBookOptIn={profile?.resumeBookOptIn ?? true} background initialError={rejectedReason} />
    </div>
  )
}

// The frame around the reading/failed states: the bundle shell on the short question flow, the plain heading otherwise.
function ReadingFrame({ bundles, children }: { bundles: boolean; children: React.ReactNode }) {
  if (bundles) {
    return (
      <BundleShell id="resume" title="Reading your résumé">
        {children}
      </BundleShell>
    )
  }
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Reading your resume</h1>
      {children}
    </div>
  )
}
