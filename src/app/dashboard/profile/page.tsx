import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { createClient } from '@/lib/supabase/server'
import { ProfileConfirmForm } from '@/components/dashboard/ProfileConfirmForm'
import { IndustryConfirmForm } from '@/components/dashboard/IndustryConfirmForm'
import { FunctionConfirmForm } from '@/components/dashboard/FunctionConfirmForm'
import { SalaryAuthorizationConfirmForm } from '@/components/dashboard/SalaryAuthorizationConfirmForm'
import { ResumeKeywordsForm } from '@/components/dashboard/ResumeKeywordsForm'
import { ProfileSaveAllButton } from '@/components/dashboard/ProfileSaveAllButton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { AvatarUploadForm } from '@/components/ui/avatar-upload-form'
import {
  uploadMyProfilePicture,
  removeMyProfilePicture,
  toggleMyProfilePictureVisible,
} from '@/app/dashboard/actions'

export default async function ProfilePage() {
  const profile = await getDashboardData()
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
        <p className="mt-1 text-muted-foreground">
          Auto-filled from your resume where possible — correct anything that&apos;s off.
        </p>
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

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Profile picture (optional)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-muted-foreground">
            Shown to your coach and recruiter/employer contacts in messaging, and in weekly
            recognition (A-List, badges). Never shown on your resume, dossier, or to hiring managers
            reviewing your report.
          </p>
          <AvatarUploadForm
            displayName={profile.displayName || 'You'}
            currentUrl={profile.profilePictureUrl}
            visible={profile.profilePictureVisible}
            uploadAction={uploadMyProfilePicture}
            removeAction={removeMyProfilePicture}
            toggleVisibilityAction={toggleMyProfilePictureVisible}
          />
        </CardContent>
      </Card>

      <div id="profile-cards" className="space-y-8">
        <Card>
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
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Industry</CardTitle>
          </CardHeader>
          <CardContent>
            <IndustryConfirmForm industryContext={profile.industryContext} />
          </CardContent>
        </Card>

        <Card>
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
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Salary &amp; work authorization
            </CardTitle>
          </CardHeader>
          <CardContent>
            <SalaryAuthorizationConfirmForm
              lastSalary={profile.lastSalary}
              workAuthorization={profile.workAuthorization}
              visaStatus={profile.visaStatus}
            />
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

      <ProfileSaveAllButton containerId="profile-cards" />
    </div>
  )
}
