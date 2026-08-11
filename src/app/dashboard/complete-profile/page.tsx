import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { getProfileChecklistItems, type ProfileChecklistActionType } from '@/lib/weekly/profile-checklist'
import { ProfileConfirmForm } from '@/components/dashboard/ProfileConfirmForm'
import { IndustryConfirmForm } from '@/components/dashboard/IndustryConfirmForm'
import { FunctionConfirmForm } from '@/components/dashboard/FunctionConfirmForm'
import { SalaryConfirmForm } from '@/components/dashboard/SalaryConfirmForm'
import { PrivacyTierSelector } from '@/components/candidates/PrivacyTierSelector'
import { ComfortCheckTab } from '@/components/dashboard/interview-prep/ComfortCheckTab'
import { NetworkComfortCheck } from '@/components/dashboard/NetworkComfortCheck'
import { WorkSampleTypeGateForm } from '@/components/dashboard/WorkSampleTypeGateForm'
import { ThoughtLeadershipUnlockForm } from '@/components/dashboard/ThoughtLeadershipUnlockForm'
import { GigDirectoryUnlockForm } from '@/components/dashboard/GigDirectoryUnlockForm'
import { LinkedInUnlockForm } from '@/components/dashboard/LinkedInUnlockForm'
import { AvatarUploadForm } from '@/components/ui/avatar-upload-form'
import { uploadMyProfilePicture, removeMyProfilePicture, toggleMyProfilePictureVisible } from '@/app/dashboard/actions'
import { LinkedInConfirmForm } from '@/components/dashboard/LinkedInConfirmForm'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Complete Your Profile' }

// Every truly one-time profile/gate confirmation in the app, aggregated
// onto one page — most reuse each item's original gate component/server
// action so completing it here works exactly like completing it on its
// original page (Profile, Privacy, Network, Work Samples, Marketing Plan,
// Interim Work, LinkedIn). A few (work authorization, screening questions,
// optional search questions, comp & benefits) instead link out to their own
// permanent page — see ACTION_TYPE_LINK in action-effort.ts. See profile-checklist.ts
// for why this exists: these no longer clutter the Weekly Search Sprint's
// task list. Redirects away once everything is done — there's nothing left
// to show.
export default async function CompleteProfilePage() {
  const profile = await getDashboardData()
  const items = await getProfileChecklistItems(profile.id)

  if (items.every((item) => item.complete)) {
    redirect('/dashboard')
  }

  const complete = new Map<ProfileChecklistActionType, boolean>(items.map((i) => [i.actionType, i.complete]))
  const isIncomplete = (type: ProfileChecklistActionType) => !complete.get(type)

  const totalPoints = items.reduce((sum, i) => sum + i.points, 0)
  const earnedPoints = items.filter((i) => i.complete).reduce((sum, i) => sum + i.points, 0)
  const doneItems = items.filter((i) => i.complete)

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Complete Your Profile</h1>
        <p className="mt-1 text-muted-foreground">
          Every one-time setup item across the app, in one place. Answer a box and it saves
          immediately — no separate submit step for the page as a whole. This page goes away once
          everything below is done.
        </p>
        <p className="mt-2 text-sm font-medium text-foreground">
          <span className="tabular-nums">{earnedPoints}</span> of{' '}
          <span className="tabular-nums">{totalPoints}</span> points earned
        </p>
      </div>

      {doneItems.length > 0 && (
        <div className="space-y-1.5 rounded-lg border border-border bg-off-white p-4">
          {doneItems.map((item) => (
            <p key={item.actionType} className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="text-success" aria-hidden>
                ✓
              </span>
              <span className="line-through">{item.label}</span>
              <span className="ml-auto shrink-0 tabular-nums">{item.points} pts</span>
            </p>
          ))}
        </div>
      )}

      <div className="space-y-6">
        {isIncomplete('WORKING_STYLE_QUIZ') && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-4">
            <div>
              <p className="text-sm font-medium text-foreground">Take the Behavioral Assessment</p>
              <p className="mt-1 text-xs text-muted-foreground">
                A short assessment of how you work best — takes about 10 minutes.
              </p>
            </div>
            <Link
              href="/dashboard/retake-assessment"
              className="shrink-0 rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand/90"
            >
              Start — 25 pts
            </Link>
          </div>
        )}

        {isIncomplete('PROFILE_CONFIRM') && (
          <div className="rounded-lg border border-border p-4">
            <ProfileConfirmForm
              firstName={profile.firstName}
              lastName={profile.lastName}
              phone={profile.phone}
              streetAddress={profile.streetAddress}
              currentCity={profile.currentCity}
              currentState={profile.currentState}
              confirmedAt={profile.profileConfirmedAt}
            />
          </div>
        )}

        {isIncomplete('INDUSTRY_CONFIRM') && (
          <div className="rounded-lg border border-border p-4">
            <IndustryConfirmForm industryContext={profile.industryContext} confirmedAt={profile.industryConfirmedAt} />
          </div>
        )}

        {isIncomplete('FUNCTION_CONFIRM') && (
          <div className="rounded-lg border border-border p-4">
            <FunctionConfirmForm
              primaryFunction={profile.primaryFunction}
              resumeLatestJobTitle={profile.resumeLatestJobTitle}
              yearsExperience={profile.yearsExperience}
              confirmedAt={profile.functionConfirmedAt}
            />
          </div>
        )}

        {isIncomplete('SALARY_CONFIRM') && (
          <div className="rounded-lg border border-border p-4">
            <SalaryConfirmForm lastSalary={profile.lastSalary} confirmedAt={profile.salaryConfirmedAt} />
          </div>
        )}

        {isIncomplete('WORK_AUTHORIZATION') && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-4">
            <div>
              <p className="text-sm font-medium text-foreground">Confirm your work authorization</p>
              <p className="mt-1 text-xs text-muted-foreground">On the Screening Questions page.</p>
            </div>
            <Link
              href="/dashboard/profile/screening#work-authorization"
              className="shrink-0 rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand/90"
            >
              Answer — 5 pts
            </Link>
          </div>
        )}

        {isIncomplete('ANSWER_OPTIONAL_QUESTIONS') && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-4">
            <div>
              <p className="text-sm font-medium text-foreground">A few optional search questions</p>
              <p className="mt-1 text-xs text-muted-foreground">On the Search Strategy page.</p>
            </div>
            <Link
              href="/dashboard/search-strategy#optional-questions"
              className="shrink-0 rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand/90"
            >
              Answer — 5 pts
            </Link>
          </div>
        )}

        {isIncomplete('PRIVACY_CONFIRMED') && (
          <div className="rounded-lg border border-border p-4">
            <PrivacyTierSelector currentTier={profile.privacyTier} alreadyAwarded={false} />
          </div>
        )}

        {isIncomplete('COMFORT_CHECK_CONFIRM') && (
          <div>
            <p className="mb-2 text-sm font-medium text-foreground">Interview Prep Comfort Check</p>
            <ComfortCheckTab
              storyComfort={profile.storyComfort}
              interviewComfort={profile.interviewComfort}
              elevatorPitchReady={profile.elevatorPitchReady}
            />
          </div>
        )}

        {isIncomplete('NETWORK_COMFORT_CONFIRMED') && (
          <div className="rounded-lg border border-border p-4">
            <NetworkComfortCheck />
          </div>
        )}

        {isIncomplete('WORK_SAMPLE_TYPE_CONFIRMED') && (
          <div className="rounded-lg border border-border p-4">
            <WorkSampleTypeGateForm alreadyAwarded={false} />
          </div>
        )}

        {isIncomplete('MARKETING_PLAN_UNLOCK') && <ThoughtLeadershipUnlockForm />}

        {isIncomplete('GIG_DIRECTORY_UNLOCK') && <GigDirectoryUnlockForm />}

        {isIncomplete('LINKEDIN_UNLOCK') && <LinkedInUnlockForm />}

        {isIncomplete('PROFILE_PICTURE_UPLOADED') && (
          <div className="rounded-lg border border-border p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-foreground">Add a profile picture</p>
              <span className="shrink-0 rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand">
                +5 pts, one time
              </span>
            </div>
            <p className="mb-3 text-sm text-muted-foreground">
              Shown to your coach and recruiter/employer contacts in messaging, and in weekly
              recognition. Never shown on your resume, dossier, or to hiring managers reviewing your
              report.
            </p>
            <AvatarUploadForm
              displayName={[profile.firstName, profile.lastName].filter(Boolean).join(' ') || 'You'}
              currentUrl={profile.profilePictureUrl}
              visible={profile.profilePictureVisible}
              uploadAction={uploadMyProfilePicture}
              removeAction={removeMyProfilePicture}
              toggleVisibilityAction={toggleMyProfilePictureVisible}
            />
          </div>
        )}

        {isIncomplete('LINKEDIN_PROFILE_ADDED') && (
          <div className="rounded-lg border border-border p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-foreground">Add your LinkedIn profile</p>
              <span className="shrink-0 rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand">
                +25 pts, one time
              </span>
            </div>
            <LinkedInConfirmForm />
          </div>
        )}

        {isIncomplete('RED_FLAGS_CONFIRMED') && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-4">
            <div>
              <p className="text-sm font-medium text-foreground">Screening questions</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Drug test, background check, and other deal-breakers — on the Screening Questions
                page.
              </p>
            </div>
            <Link
              href="/dashboard/profile/screening#screening-questions"
              className="shrink-0 rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand/90"
            >
              Answer — 5 pts
            </Link>
          </div>
        )}

        {isIncomplete('BENEFITS_PRIORITIES_CONFIRMED') && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-4">
            <div>
              <p className="text-sm font-medium text-foreground">Search Goals — comp &amp; benefits</p>
              <p className="mt-1 text-xs text-muted-foreground">On the Search Goals page.</p>
            </div>
            <Link
              href="/dashboard/profile/search-goals#comp-benefits"
              className="shrink-0 rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand/90"
            >
              Answer — 10 pts
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
