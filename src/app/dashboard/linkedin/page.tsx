import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { LinkedInConfirmForm } from '@/components/dashboard/LinkedInConfirmForm'
import { LinkedInUrlForm } from '@/components/dashboard/LinkedInUrlForm'
import { LinkedInUnlockForm } from '@/components/dashboard/LinkedInUnlockForm'
import { ThoughtLeadershipStudio } from '@/components/dashboard/ThoughtLeadershipStudio'
import { HeadshotCreator } from '@/components/dashboard/HeadshotCreator'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SprintActionCompletion } from '@/components/dashboard/SprintActionCompletion'

export default async function LinkedInPage() {
  const profile = await getDashboardData()
  const postGeneratorUnlocked = profile.linkedinUsageFrequency !== null

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">LinkedIn</h1>
        <p className="mt-1 text-muted-foreground">
          Visibility compounds — recruiters and your network see consistent activity, not just a static
          profile.
        </p>
        <SprintActionCompletion candidateId={profile.id} actionTypes={['LINKEDIN_SETUP']} />
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

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Get your profile in shape
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            Two things move the needle before you post anything: an updated headshot (below) and
            a profile that&apos;s actually current — title, summary, and recent experience all
            matching where you say you are today.
          </p>
          <p>
            Once that&apos;s done, virality is mostly a habit, not a talent. Liking, sharing, and
            commenting on other people&apos;s posts puts you in front of their network too — do it
            daily and your own posts start reaching further than the follower count alone would
            suggest.
          </p>
        </CardContent>
      </Card>

      <HeadshotCreator />

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">LinkedIn Post Generator</h2>
        <p className="text-sm text-muted-foreground">
          Posting matters, but the algorithm rewards engagement too — commenting on others&apos;
          posts and tagging people in relevant conversations both raise how often you show up in
          feeds. Make it a daily habit, not just a posting one.
        </p>
        {postGeneratorUnlocked ? (
          <ThoughtLeadershipStudio venues={['LINKEDIN']} />
        ) : (
          <LinkedInUnlockForm />
        )}
      </div>
    </div>
  )
}
