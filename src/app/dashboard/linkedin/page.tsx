import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { LinkedInConfirmForm } from '@/components/dashboard/LinkedInConfirmForm'
import { LinkedInUrlForm } from '@/components/dashboard/LinkedInUrlForm'
import { LinkedInUnlockForm } from '@/components/dashboard/LinkedInUnlockForm'
import { ThoughtLeadershipStudio } from '@/components/dashboard/ThoughtLeadershipStudio'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CONTENT_TUTORIALS } from '@/lib/constants/content-venues'

export default async function LinkedInPage() {
  const profile = await getDashboardData()
  const postGeneratorUnlocked = profile.linkedinUsageFrequency !== null
  const linkedInTutorials = CONTENT_TUTORIALS.find((t) => t.venue === 'LINKEDIN')?.tutorials ?? []

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">LinkedIn</h1>
        <p className="mt-1 text-muted-foreground">
          Visibility compounds — recruiters and your network see consistent activity, not just a static
          profile.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">LinkedIn Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          {profile.linkedInConfirmedAt === null ? (
            <LinkedInConfirmForm />
          ) : (
            <LinkedInUrlForm currentUrl={profile.linkedInUrl} />
          )}
        </CardContent>
      </Card>

      {linkedInTutorials.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">LinkedIn tutorial</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {linkedInTutorials.map((tutorial) => (
              <Card key={tutorial.url}>
                <CardHeader>
                  <CardTitle className="text-base">
                    <a
                      href={tutorial.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline underline-offset-4"
                    >
                      {tutorial.name}
                    </a>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{tutorial.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Post generator</h2>
        {postGeneratorUnlocked ? (
          <ThoughtLeadershipStudio venues={['LINKEDIN']} />
        ) : (
          <LinkedInUnlockForm />
        )}
      </div>
    </div>
  )
}
