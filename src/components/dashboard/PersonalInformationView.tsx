import type { ReactNode } from 'react'
import { ProfileConfirmForm } from '@/components/dashboard/ProfileConfirmForm'
import { IndustryConfirmForm } from '@/components/dashboard/IndustryConfirmForm'
import { EducationConfirmForm } from '@/components/dashboard/EducationConfirmForm'
import { FunctionConfirmForm } from '@/components/dashboard/FunctionConfirmForm'
import { SalaryConfirmForm } from '@/components/dashboard/SalaryConfirmForm'
import { ResumeKeywordsForm } from '@/components/dashboard/ResumeKeywordsForm'
import { CanTeachForm } from '@/components/dashboard/CanTeachForm'
import { LinkedInConfirmForm } from '@/components/dashboard/LinkedInConfirmForm'
import { ProfileSaveAllButton } from '@/components/dashboard/ProfileSaveAllButton'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { AvatarUploadForm } from '@/components/ui/avatar-upload-form'
import { estimateActionEffort } from '@/lib/weekly/action-effort'
import { uploadMyProfilePicture, removeMyProfilePicture } from '@/app/dashboard/actions'
import type { getDashboardProfile } from '@/lib/dashboard/get-dashboard-data'

type Profile = Awaited<ReturnType<typeof getDashboardProfile>>

// A group of related forms. Open when something in it still needs the member (so nothing they have to do is hidden), folded when it is done.
function Group({ id, title, why, open, children }: { id: string; title: string; why: string; open: boolean; children: ReactNode }) {
  return (
    <details id={id} open={open} className="group scroll-mt-4 rounded-2xl border border-border">
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-5 py-3 marker:content-none">
        <span>
          <span className="block text-base font-semibold text-ink">{title}</span>
          <span className="block text-sm text-muted-foreground">{why}</span>
        </span>
        <span className="text-sm font-medium text-muted-foreground group-open:hidden">Show</span>
        <span className="hidden text-sm font-medium text-muted-foreground group-open:inline">Hide</span>
      </summary>
      <div className="space-y-8 border-t border-border p-5">{children}</div>
    </details>
  )
}

function Field({ id, title, note, children }: { id?: string; title: string; note?: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-4 space-y-2" aria-label={title}>
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
      {children}
    </section>
  )
}

/**
 * My Personal Information, grouped by purpose (docs/candidate-redesign.md: three sections at most): About you, Your background and
 * Pay. A group is open while something in it is unconfirmed and folded once it is done. Every form keeps its own save and its
 * disclosure of who sees it; one "Save all" covers the page. Shared by the page and the dev-preview so what is reviewed is what ships.
 */
export function PersonalInformationView({ profile, email }: { profile: Profile; email: string }) {
  const aboutOpen = !profile.profileConfirmedAt || !profile.linkedInConfirmedAt
  const backgroundOpen = !profile.industryConfirmedAt || !profile.functionConfirmedAt
  const payOpen = !profile.salaryConfirmedAt
  return (
    <>
      <div id="profile-cards-1" className="space-y-4">
        <Group id="about" title="About you" why="Your name and city go to your coach and your recruiter dossier. Phone and street address are never shared." open={aboutOpen}>
          <Field title="Email">
            <Label htmlFor="email" className="sr-only">Email</Label>
            <Input id="email" value={email} readOnly disabled className="bg-muted" />
          </Field>
          <Field id="basics" title="Basics" note="Phone and street address are always private. Your name and city/state are shared with your coach and included in your recruiter dossier.">
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
          </Field>
          <Field id="linkedin" title="LinkedIn">
            {profile.linkedInConfirmedAt ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="text-success" aria-hidden>✓</span>
                {profile.linkedInUrl ? (
                  <a href={profile.linkedInUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">{profile.linkedInUrl}</a>
                ) : (
                  'Confirmed — no LinkedIn profile yet'
                )}
              </p>
            ) : (
              <LinkedInConfirmForm />
            )}
          </Field>
          <Field id="profile-picture" title="Profile picture (optional)" note="Shown to your coach and recruiter or employer contacts in messaging, and in weekly recognition. Never shown on your résumé, dossier, or to hiring managers reviewing your report.">
            <AvatarUploadForm
              displayName={[profile.firstName, profile.lastName].filter(Boolean).join(' ') || 'You'}
              currentUrl={profile.profilePictureUrl}
              uploadAction={uploadMyProfilePicture}
              removeAction={removeMyProfilePicture}
              points={estimateActionEffort({ actionType: 'PROFILE_PICTURE_UPLOADED' }).points}
            />
          </Field>
        </Group>

        <Group id="background" title="Your background" why="What we read from your résumé. Confirm it so your matches and report use the right facts." open={backgroundOpen}>
          <Field id="education" title="Education">
            <EducationConfirmForm
              highestEducationLevel={profile.highestEducationLevel}
              hasJD={profile.hasJD}
              hasMD={profile.hasMD}
              hasMBA={profile.hasMBA}
              prefilled={profile.resumePrefilledFields}
            />
          </Field>
          <Field id="industry" title="Industry">
            <IndustryConfirmForm industryContext={profile.industryContext} confirmedAt={profile.industryConfirmedAt} prefilled={profile.resumePrefilledFields} />
          </Field>
          <Field id="function-experience" title="Function & experience">
            <FunctionConfirmForm
              primaryFunction={profile.primaryFunction}
              resumeLatestJobTitle={profile.resumeLatestJobTitle}
              yearsExperience={profile.yearsExperience}
              confirmedAt={profile.functionConfirmedAt}
              prefilled={profile.resumePrefilledFields}
            />
          </Field>
          <Field title="Résumé keywords">
            <ResumeKeywordsForm resumeKeywords={profile.resumeKeywords} prefilled={profile.resumePrefilledFields} />
          </Field>
          <Field title="What you can teach others">
            <CanTeachForm canTeach={profile.canTeach} />
          </Field>
        </Group>

        <Group id="pay" title="Pay" why="Shared with your coach for pay coaching. Never in your recruiter dossier or Market Reality Report." open={payOpen}>
          <Field id="salary" title="Salary">
            <SalaryConfirmForm lastSalary={profile.lastSalary} confirmedAt={profile.salaryConfirmedAt} />
          </Field>
        </Group>
      </div>

      <ProfileSaveAllButton containerId="profile-cards-1" />
    </>
  )
}
