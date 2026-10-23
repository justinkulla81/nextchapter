import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getDashboardProfile } from '@/lib/dashboard/get-dashboard-data'
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
import { uploadMyProfilePicture, removeMyProfilePicture } from '@/app/dashboard/actions'
import { LinkedInConfirmForm } from '@/components/dashboard/LinkedInConfirmForm'
import { Children } from 'react'
import { PageHeader } from '@/components/candidate/PageHeader'
import { MoreDetails } from '@/components/dashboard/MoreDetails'
import { ListRow } from '@/components/candidate/ListRow'
import { ActionLink } from '@/components/candidate/ActionLink'

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
  const profile = await getDashboardProfile()
  const items = await getProfileChecklistItems(profile.id)

  if (items.every((item) => item.complete)) {
    redirect('/dashboard')
  }

  const complete = new Map<ProfileChecklistActionType, boolean>(items.map((i) => [i.actionType, i.complete]))
  const isIncomplete = (type: ProfileChecklistActionType) => !complete.get(type)

  const totalPoints = items.reduce((sum, i) => sum + i.points, 0)
  const earnedPoints = items.filter((i) => i.complete).reduce((sum, i) => sum + i.points, 0)
  const doneItems = items.filter((i) => i.complete)

  // Every open item, in order. The first two show; the rest are one click away.
  const buildBlocks = () => {
    const card = 'space-y-3'
    // A task that is a link to another page: a plain row with its reason and what it is worth.
    const linkTask = (key: string, title: string, note: string, href: string, pts: number, verb: string) =>
      <ul key={key} className="rounded-2xl border border-border">
        <ListRow
          title={title}
          why={note.replace(/ — /g, '. ')}
          fact={`Worth ${pts} minutes toward Candidate+.`}
          actions={
            <ActionLink href={href} variant="secondary" event="complete_profile_task_opened" props={{ task: key }}>
              {verb}
            </ActionLink>
          }
        />
      </ul>
    return (
    <>
        {isIncomplete('WORKING_STYLE_QUIZ') && linkTask('WORKING_STYLE_QUIZ', 'Take the Behavioral Assessment', 'A short assessment of how you work best — takes about 10 minutes.', '/dashboard/retake-assessment', 25, 'Start')}

        {isIncomplete('PROFILE_CONFIRM') && (
          <div className={card}>
            <ProfileConfirmForm
              firstName={profile.firstName}
              lastName={profile.lastName}
              phone={profile.phone}
              streetAddress={profile.streetAddress}
              currentCity={profile.currentCity}
              currentState={profile.currentState}
              confirmedAt={profile.profileConfirmedAt}
              prefilled={profile.resumePrefilledFields}
            />
          </div>
        )}

        {isIncomplete('INDUSTRY_CONFIRM') && (
          <div className={card}>
            <IndustryConfirmForm industryContext={profile.industryContext} confirmedAt={profile.industryConfirmedAt} prefilled={profile.resumePrefilledFields} />
          </div>
        )}

        {isIncomplete('FUNCTION_CONFIRM') && (
          <div className={card}>
            <FunctionConfirmForm
              primaryFunction={profile.primaryFunction}
              resumeLatestJobTitle={profile.resumeLatestJobTitle}
              yearsExperience={profile.yearsExperience}
              confirmedAt={profile.functionConfirmedAt}
              prefilled={profile.resumePrefilledFields}
            />
          </div>
        )}

        {isIncomplete('SALARY_CONFIRM') && (
          <div className={card}>
            <SalaryConfirmForm lastSalary={profile.lastSalary} confirmedAt={profile.salaryConfirmedAt} />
          </div>
        )}

        {isIncomplete('WORK_AUTHORIZATION') && linkTask('WORK_AUTHORIZATION', 'Confirm your work authorization', 'On the Screening Questions page.', '/dashboard/profile/screening#work-authorization', 5, 'Answer')}

        {isIncomplete('ANSWER_OPTIONAL_QUESTIONS') && linkTask('ANSWER_OPTIONAL_QUESTIONS', 'Complete your Search Strategy questions', 'On the Search Strategy page.', '/dashboard/search-strategy#optional-questions', 5, 'Answer')}

        {isIncomplete('PRIVACY_CONFIRMED') && (
          <div className={card}>
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
          <div className={card}>
            <NetworkComfortCheck />
          </div>
        )}

        {isIncomplete('WORK_SAMPLE_TYPE_CONFIRMED') && (
          <div className={card}>
            <WorkSampleTypeGateForm alreadyAwarded={false} />
          </div>
        )}

        {isIncomplete('MARKETING_PLAN_UNLOCK') && <ThoughtLeadershipUnlockForm />}

        {isIncomplete('GIG_DIRECTORY_UNLOCK') && <GigDirectoryUnlockForm />}

        {isIncomplete('LINKEDIN_UNLOCK') && <LinkedInUnlockForm />}

        {isIncomplete('PROFILE_PICTURE_UPLOADED') && (
          <div className={card}>
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-foreground">Add a profile picture</p>
              
            </div>
            <p className="mb-3 text-sm text-muted-foreground">
              Shown to your coach and recruiter/employer contacts in messaging, and in weekly
              recognition. Never shown on your resume, dossier, or to hiring managers reviewing your
              report.
            </p>
            <AvatarUploadForm
              displayName={[profile.firstName, profile.lastName].filter(Boolean).join(' ') || 'You'}
              currentUrl={profile.profilePictureUrl}
              uploadAction={uploadMyProfilePicture}
              removeAction={removeMyProfilePicture}
            />
          </div>
        )}

        {isIncomplete('LINKEDIN_PROFILE_ADDED') && (
          <div className={card}>
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-foreground">Add your LinkedIn profile</p>
              
            </div>
            <LinkedInConfirmForm />
          </div>
        )}

        {isIncomplete('RED_FLAGS_CONFIRMED') && linkTask('RED_FLAGS_CONFIRMED', 'Complete Screening Questions', 'Drug test, background check, and other deal-breakers — on the Screening Questions page.', '/dashboard/profile/screening#screening-questions', 5, 'Answer')}

        {isIncomplete('BENEFITS_PRIORITIES_CONFIRMED') && linkTask('BENEFITS_PRIORITIES_CONFIRMED', 'Compensation & benefits', 'On the Know your worth page.', '/dashboard/pay#asks', 10, 'Answer')}
    </>
    )
  }
  const openBlocks = Children.toArray(buildBlocks().props.children)

  return (
    <div className="space-y-8">
      <PageHeader
        title="Finish setting up"
        intro={`${openBlocks.length} ${openBlocks.length === 1 ? 'thing is' : 'things are'} left. Each answer saves as you go, and each one makes your matches and your advice fit you better.`}
      />
      <div className="space-y-6">{openBlocks.slice(0, 2)}</div>
      {openBlocks.length > 2 && (
        <MoreDetails summary={`Show more: ${openBlocks.length - 2} more to finish`}>
          <div className="space-y-6">{openBlocks.slice(2)}</div>
        </MoreDetails>
      )}
      {doneItems.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer font-medium text-brand underline underline-offset-4">Done so far ({doneItems.length})</summary>
          <ul className="mt-2 space-y-1.5">
            {doneItems.map((item) => (
              <li key={item.actionType} className="flex items-center gap-2 text-muted-foreground">
                <span className="text-success" aria-hidden>✓</span>
                <span>{item.label}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
      <p className="text-sm text-muted-foreground">1 point is 1 minute of real search work. You have earned {earnedPoints} of {totalPoints}. This page goes away when everything is done.</p>
    </div>
  )
}
