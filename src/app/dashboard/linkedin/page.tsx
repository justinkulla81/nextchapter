import type { Metadata } from 'next'
import Link from 'next/link'
import { getDashboardProfile } from '@/lib/dashboard/get-dashboard-data'
import { LinkedInConfirmForm } from '@/components/dashboard/LinkedInConfirmForm'
import { LinkedInUrlForm } from '@/components/dashboard/LinkedInUrlForm'
import { ThoughtLeadershipStudio } from '@/components/dashboard/ThoughtLeadershipStudio'
import { HeadshotCreator } from '@/components/dashboard/HeadshotCreator'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { isRedesignOn } from '@/lib/redesign/flag'
import { PageHeader } from '@/components/candidate/PageHeader'
import { ShowMore } from '@/components/candidate/ShowMore'
import { ActionLink } from '@/components/candidate/ActionLink'
import { PageHeaderBoxes } from '@/components/dashboard/PageHeaderBoxes'

export const metadata: Metadata = { title: 'LinkedIn' }


export default async function LinkedInPage() {
  const profile = await getDashboardProfile()
  const postGeneratorUnlocked = profile.linkedinUsageFrequency !== null

  const block0 = (
    <>
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight">LinkedIn</h1>
        <PageHeaderBoxes pageKey="linkedin" candidateId={profile.id} />
      </div>
    </>
  )

  const block1 = (
    <>
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
    </>
  )

  const block2 = (
    <>
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
    </>
  )

  const block3 = (
    <>
      <HeadshotCreator />
    </>
  )

  const block4 = (
    <>
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
          <div className="rounded-lg border border-border p-4 text-sm">
            <p className="font-medium text-foreground">Answer Marketing Plan Willingness on Search Strategy first</p>
            <p className="mt-1 text-muted-foreground">
              How open you are about your search on LinkedIn now lives on Search Strategy so you
              only answer it once.
            </p>
            <Link
              href="/dashboard/search-strategy"
              className="mt-2 inline-block text-sm text-primary underline underline-offset-4"
            >
              Go to Search Strategy →
            </Link>
          </div>
        )}
      </div>
    </>
  )

  if (isRedesignOn(profile.email)) {
    return (
      <div className="space-y-8">
        <PageHeader
          title="LinkedIn"
          intro="A current profile and regular posts put you in front of the people who hire. We check your profile and help you write posts."
          action={
            <ActionLink href="#post" kind="primary" event="linkedin_post_start_clicked" props={{ confirmed: profile.linkedInConfirmedAt !== null, postGeneratorReady: postGeneratorUnlocked }}>
              Write a post
            </ActionLink>
          }
        />
        {block1}
        <div id="post" className="scroll-mt-4">
          {block4}
        </div>
        <ShowMore page="linkedin">
          {block2}
          {block3}
        </ShowMore>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {block0}
      {block1}
      {block2}
      {block3}
      {block4}
    </div>
  )
}
