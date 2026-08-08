import type { Metadata } from 'next'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { createClient } from '@/lib/supabase/server'
import { ProfileConfirmForm } from '@/components/dashboard/ProfileConfirmForm'
import { IndustryConfirmForm } from '@/components/dashboard/IndustryConfirmForm'
import { EducationConfirmForm } from '@/components/dashboard/EducationConfirmForm'
import { FunctionConfirmForm } from '@/components/dashboard/FunctionConfirmForm'
import { SalaryConfirmForm } from '@/components/dashboard/SalaryConfirmForm'
import { WorkAuthorizationConfirmForm } from '@/components/dashboard/WorkAuthorizationConfirmForm'
import { ResumeKeywordsForm } from '@/components/dashboard/ResumeKeywordsForm'
import { LinkedInConfirmForm } from '@/components/dashboard/LinkedInConfirmForm'
import { OptionalQuestionsForm } from '@/components/dashboard/OptionalQuestionsForm'
import { ProfileSaveAllButton } from '@/components/dashboard/ProfileSaveAllButton'
import { EeocSelfIdForm } from '@/components/dashboard/EeocSelfIdForm'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { AvatarUploadForm } from '@/components/ui/avatar-upload-form'
import { estimateActionEffort } from '@/lib/weekly/action-effort'
import {
  uploadMyProfilePicture,
  removeMyProfilePicture,
  toggleMyProfilePictureVisible,
} from '@/app/dashboard/actions'
import { PageHeaderBoxes } from '@/components/dashboard/PageHeaderBoxes'

export const metadata: Metadata = { title: 'My Profile' }

// Section order: Email, Basics, Profile picture, Industry, Education,
// Function & experience, Salary, Work Authorization, Optional demographics,
// Keywords. The "Save profile" button spans two non-contiguous card groups
// (id="profile-cards-1" and "profile-cards-2") since Optional demographics
// sits between Work Authorization and Keywords but saves independently via
// its own button — see ProfileSaveAllButton's array support.
export default async function ProfilePage() {
  const profile = await getDashboardData()
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Mirrors fetchCompletion's optionalQuestionsAnswered check in
  // profile-checklist.ts — kept in sync manually since this page reads the
  // fields directly off the already-fetched profile instead of a second query.
  const optionalQuestionsAnswered = [
    profile.jobsAppliedBucket,
    profile.interviewsReceivedCount,
    profile.networkingLevel,
    profile.learnedNewSkillsLevel,
    profile.triedPartTimeOrConsulting,
    profile.triedExecutiveCoaching,
    profile.connectedWithRecruiters,
  ].every((f) => f !== null)

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
        <PageHeaderBoxes pageKey="profile" candidateId={profile.id} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <Label htmlFor="email">Email</Label>
          <Input id="email" value={user?.email ?? ''} readOnly disabled className="bg-muted" />
        </CardContent>
      </Card>

      <div id="profile-cards-1" className="space-y-8">
        <Card id="basics" className="scroll-mt-4">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Basics</CardTitle>
          </CardHeader>
          <CardContent>
            <ProfileConfirmForm
              firstName={profile.firstName}
              lastName={profile.lastName}
              phone={profile.phone}
              streetAddress={profile.streetAddress}
              currentCity={profile.currentCity}
              currentState={profile.currentState}
              confirmedAt={profile.profileConfirmedAt}
            />
          </CardContent>
        </Card>

        <Card id="profile-picture" className="scroll-mt-4">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Profile picture (optional)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-sm text-muted-foreground">
              Shown to your coach and recruiter/employer contacts in messaging, and in weekly
              recognition (Weekly Sprint Target, badges). Never shown on your resume, dossier, or to
              hiring managers reviewing your report.
            </p>
            <AvatarUploadForm
              displayName={[profile.firstName, profile.lastName].filter(Boolean).join(' ') || 'You'}
              currentUrl={profile.profilePictureUrl}
              visible={profile.profilePictureVisible}
              uploadAction={uploadMyProfilePicture}
              removeAction={removeMyProfilePicture}
              toggleVisibilityAction={toggleMyProfilePictureVisible}
              points={estimateActionEffort({ actionType: 'PROFILE_PICTURE_UPLOADED' }).points}
            />
          </CardContent>
        </Card>

        <Card id="industry" className="scroll-mt-4">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Industry</CardTitle>
          </CardHeader>
          <CardContent>
            <IndustryConfirmForm
              industryContext={profile.industryContext}
              confirmedAt={profile.industryConfirmedAt}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Education</CardTitle>
          </CardHeader>
          <CardContent>
            <EducationConfirmForm
              highestEducationLevel={profile.highestEducationLevel}
              hasJD={profile.hasJD}
              hasMD={profile.hasMD}
            />
          </CardContent>
        </Card>

        <Card id="function-experience" className="scroll-mt-4">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Function &amp; experience
            </CardTitle>
          </CardHeader>
          <CardContent>
            <FunctionConfirmForm
              primaryFunction={profile.primaryFunction}
              resumeLatestJobTitle={profile.resumeLatestJobTitle}
              yearsExperience={profile.yearsExperience}
              highestLevelReached={profile.highestLevelReached}
              confirmedAt={profile.functionConfirmedAt}
            />
          </CardContent>
        </Card>

        <Card id="salary" className="scroll-mt-4">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Salary</CardTitle>
          </CardHeader>
          <CardContent>
            <SalaryConfirmForm lastSalary={profile.lastSalary} confirmedAt={profile.salaryConfirmedAt} />
          </CardContent>
        </Card>

        <Card id="work-authorization" className="scroll-mt-4">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Work authorization
            </CardTitle>
          </CardHeader>
          <CardContent>
            <WorkAuthorizationConfirmForm
              workAuthorization={profile.workAuthorization}
              visaStatus={profile.visaStatus}
              confirmedAt={profile.workAuthConfirmedAt}
            />
          </CardContent>
        </Card>

        <Card id="linkedin" className="scroll-mt-4">
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">LinkedIn</CardTitle>
              {!profile.linkedInConfirmedAt && (
                <span className="shrink-0 rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand">
                  +25 pts
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {profile.linkedInConfirmedAt ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="text-success" aria-hidden>
                  ✓
                </span>
                {profile.linkedInUrl ? (
                  <a
                    href={profile.linkedInUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-4"
                  >
                    {profile.linkedInUrl}
                  </a>
                ) : (
                  'Confirmed — no LinkedIn profile yet'
                )}
              </p>
            ) : (
              <LinkedInConfirmForm />
            )}
          </CardContent>
        </Card>

        <Card id="optional-questions" className="scroll-mt-4">
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Optional search questions
              </CardTitle>
              {!optionalQuestionsAnswered && (
                <span className="shrink-0 rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand">
                  +5 pts
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {optionalQuestionsAnswered ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="text-success" aria-hidden>
                  ✓
                </span>
                Answered
              </p>
            ) : (
              <OptionalQuestionsForm />
            )}
          </CardContent>
        </Card>
      </div>

      <ProfileSaveAllButton containerId={['profile-cards-1', 'profile-cards-2']} />

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Optional demographic self-ID
          </CardTitle>
        </CardHeader>
        <CardContent>
          <EeocSelfIdForm
            eeocGenderIdentity={profile.eeocGenderIdentity}
            eeocRaceEthnicity={profile.eeocRaceEthnicity}
            eeocDisabilityStatus={profile.eeocDisabilityStatus}
            eeocVeteranStatus={profile.eeocVeteranStatus}
          />
        </CardContent>
      </Card>

      <div id="profile-cards-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Resume keywords
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResumeKeywordsForm resumeKeywords={profile.resumeKeywords} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
