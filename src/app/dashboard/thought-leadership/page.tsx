import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { ThoughtLeadershipStudio } from '@/components/dashboard/ThoughtLeadershipStudio'
import { ThoughtLeadershipUnlockForm } from '@/components/dashboard/ThoughtLeadershipUnlockForm'
import { SubstackSection } from '@/components/dashboard/SubstackSection'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CONTENT_TUTORIALS, CONTENT_VENUE_LABEL } from '@/lib/constants/content-venues'

export default async function ThoughtLeadershipPage() {
  const profile = await getDashboardData()
  const unlocked = profile.contentComfortLevel !== null && profile.contentVenues.length > 0

  if (!unlocked) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Thought Leadership Studio</h1>
          <p className="mt-1 text-muted-foreground">
            Post ideas grounded in your actual background — pick one, get a draft, edit it so it
            sounds like you, and post.
          </p>
        </div>
        <ThoughtLeadershipUnlockForm />
      </div>
    )
  }

  const relevantTutorials = CONTENT_TUTORIALS.filter((t) => profile.contentVenues.includes(t.venue))

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Thought Leadership Studio</h1>
        <p className="mt-1 text-muted-foreground">
          Post ideas grounded in your actual background — pick one, get a draft, edit it so it sounds like you,
          and post.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Posting is one of the highest-leverage things you can do right now — it&apos;s how
          recruiters and your network see you&apos;re active before you ever apply anywhere, and
          consistent activity shows up on your Recruiter Report as a real, visible signal, not a
          resume claim.
        </p>
      </div>

      {relevantTutorials.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Tutorials for your venues</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {relevantTutorials.flatMap((group) =>
              group.tutorials.map((tutorial) => (
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
                  <CardContent className="space-y-1">
                    <p className="text-xs font-medium uppercase text-muted-foreground">
                      {CONTENT_VENUE_LABEL[group.venue]}
                    </p>
                    <p className="text-sm text-muted-foreground">{tutorial.description}</p>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      )}

      {profile.contentVenues.includes('SUBSTACK') && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Substack</h2>
          <SubstackSection
            hasAccount={profile.substackHasAccount}
            url={profile.substackUrl}
            critique={profile.substackCritique as unknown as SubstackCritique | null}
          />
        </div>
      )}

      <ThoughtLeadershipStudio
        venues={profile.contentVenues}
        substackUnlocked={profile.substackHasAccount !== null}
      />
    </div>
  )
}

interface SubstackCritique {
  relevanceToBackground: string
  noveltyOfIdeas: string
  cadence: string
  overallAssessment: string
}
