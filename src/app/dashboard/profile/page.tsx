import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { ProfileConfirmForm } from '@/components/dashboard/ProfileConfirmForm'
import { IndustryConfirmForm } from '@/components/dashboard/IndustryConfirmForm'
import { FunctionConfirmForm } from '@/components/dashboard/FunctionConfirmForm'
import { SalaryAuthorizationConfirmForm } from '@/components/dashboard/SalaryAuthorizationConfirmForm'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default async function ProfilePage() {
  const profile = await getDashboardData()

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
          />
        </CardContent>
      </Card>
    </div>
  )
}
