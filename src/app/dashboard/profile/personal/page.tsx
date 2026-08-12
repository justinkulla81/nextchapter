import type { Metadata } from 'next'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { createClient } from '@/lib/supabase/server'
import { ProfileConfirmForm } from '@/components/dashboard/ProfileConfirmForm'
import { IndustryConfirmForm } from '@/components/dashboard/IndustryConfirmForm'
import { EducationConfirmForm } from '@/components/dashboard/EducationConfirmForm'
import { FunctionConfirmForm } from '@/components/dashboard/FunctionConfirmForm'
import { SalaryConfirmForm } from '@/components/dashboard/SalaryConfirmForm'
import { ResumeKeywordsForm } from '@/components/dashboard/ResumeKeywordsForm'
import { LinkedInConfirmForm } from '@/components/dashboard/LinkedInConfirmForm'
import { PersonalContextForm } from '@/components/dashboard/PersonalContextForm'
import { ProfileSaveAllButton } from '@/components/dashboard/ProfileSaveAllButton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { AvatarUploadForm } from '@/components/ui/avatar-upload-form'
import { estimateActionEffort } from '@/lib/weekly/action-effort'
import { uploadMyProfilePicture, removeMyProfilePicture } from '@/app/dashboard/actions'
import { PageHeaderBoxes } from '@/components/dashboard/PageHeaderBoxes'
import Link from 'next/link'

export const metadata: Metadata = { title: 'My Personal Information' }

// One of three sub-pages under the My Profile hub (see
// /dashboard/profile/page.tsx) — Work authorization, screening questions,
// and demographics live on the Screening Questions sub-page instead; comp
// and benefits live on Search Goals. Section order: Email, Basics,
// LinkedIn, Profile picture, Education, Industry, Function & experience,
// Salary, Resume keywords. Basics and Salary each carry an explicit
// disclosure of exactly who sees them (phone/address are the only fields
// on this page that are genuinely never shared — see coaching-notes.ts and
// recruiter-report.ts for what name/city/state/salary actually surface to).
export default async function PersonalInformationPage() {
  const profile = await getDashboardData()
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <Link href="/dashboard/profile" className="text-sm text-muted-foreground hover:text-foreground">
          ← My Profile
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">My Personal Information</h1>
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
            <p className="mb-3 text-xs text-muted-foreground">
              Phone and street address are always private — never shared with anyone. Your name and
              city/state are shared with your coach and included in your recruiter dossier.
            </p>
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
              uploadAction={uploadMyProfilePicture}
              removeAction={removeMyProfilePicture}
              points={estimateActionEffort({ actionType: 'PROFILE_PICTURE_UPLOADED' }).points}
            />
          </CardContent>
        </Card>

        <Card id="education" className="scroll-mt-4">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Education</CardTitle>
          </CardHeader>
          <CardContent>
            <EducationConfirmForm
              highestEducationLevel={profile.highestEducationLevel}
              hasJD={profile.hasJD}
              hasMD={profile.hasMD}
              hasMBA={profile.hasMBA}
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
              confirmedAt={profile.functionConfirmedAt}
            />
          </CardContent>
        </Card>

        <Card id="personal-context" className="scroll-mt-4">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Personal context
            </CardTitle>
          </CardHeader>
          <CardContent>
            <PersonalContextForm profile={profile} />
          </CardContent>
        </Card>

        <Card id="salary" className="scroll-mt-4">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Salary</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-xs text-muted-foreground">
              Shared with your coach to inform pay-related coaching — never included in your
              recruiter dossier or Hireability Report.
            </p>
            <SalaryConfirmForm lastSalary={profile.lastSalary} confirmedAt={profile.salaryConfirmedAt} />
          </CardContent>
        </Card>

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

      <ProfileSaveAllButton containerId="profile-cards-1" />
    </div>
  )
}
