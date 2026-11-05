import type { Metadata } from 'next'
import { getDashboardProfile } from '@/lib/dashboard/get-dashboard-data'
import { LinkedInConfirmForm } from '@/components/dashboard/LinkedInConfirmForm'
import { LinkedInUrlForm } from '@/components/dashboard/LinkedInUrlForm'
import { ThoughtLeadershipStudio } from '@/components/dashboard/ThoughtLeadershipStudio'
import { HeadshotCreator } from '@/components/dashboard/HeadshotCreator'
import { PageHeader } from '@/components/candidate/PageHeader'
import { ShowMore } from '@/components/candidate/ShowMore'
import { ActionLink } from '@/components/candidate/ActionLink'
import { ProfileChecklist } from '@/components/linkedin/ProfileChecklist'
import { PlainNote, SectionBlock } from '@/components/candidate/Blocks'

export const metadata: Metadata = { title: 'LinkedIn' }


export default async function LinkedInPage() {
  const profile = await getDashboardProfile()
  const postGeneratorUnlocked = profile.linkedinUsageFrequency !== null

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
      <SectionBlock id="profile-h" title="Your LinkedIn profile" why={profile.linkedInConfirmedAt === null ? 'Add your link so we can check your profile, or tell us you will add it later.' : 'We use this link to check your profile. Change it any time.'}>
        {profile.linkedInConfirmedAt === null ? <LinkedInConfirmForm /> : <LinkedInUrlForm currentUrl={profile.linkedInUrl} />}
      </SectionBlock>
      <div id="post" className="scroll-mt-4">
        <SectionBlock id="post-h" title="Write a post" why="Posting helps, and the algorithm rewards engagement too: commenting on others’ posts and tagging people in relevant conversations both raise how often you show up in feeds.">
          {postGeneratorUnlocked ? (
            <ThoughtLeadershipStudio venues={['LINKEDIN']} redesign />
          ) : (
            <div className="space-y-2">
              <PlainNote>
                <span className="font-semibold">Answer Marketing Plan Willingness on Search Strategy first.</span> How open you are about your search on LinkedIn lives there, so you only answer it once.
              </PlainNote>
              <ActionLink href="/dashboard/search-strategy" event="linkedin_search_strategy_clicked" props={{ source: 'linkedin_post_locked' }}>
                Go to Search Strategy
              </ActionLink>
            </div>
          )}
        </SectionBlock>
      </div>
      <ShowMore page="linkedin">
        <SectionBlock id="shape-h" title="Get your profile in shape" why="Recruiters search by keyword and decide in seconds, so each check below says why it is worth doing. Your ticks stay in this browser.">
          <ProfileChecklist surface="dashboard" />
          <ActionLink href="/resources/linkedin-profile" event="linkedin_guide_opened" props={{ source: 'dashboard' }}>
            Read the full guide, with examples
          </ActionLink>
        </SectionBlock>
        <HeadshotCreator />
      </ShowMore>
    </div>
  )
}
