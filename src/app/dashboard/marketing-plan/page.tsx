import type { Metadata } from 'next'
import Link from 'next/link'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { prisma } from '@/lib/prisma'
import { ThoughtLeadershipStudio } from '@/components/dashboard/ThoughtLeadershipStudio'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CONTENT_TUTORIALS, CONTENT_VENUE_LABEL } from '@/lib/constants/content-venues'
import { PageHeaderBoxes } from '@/components/dashboard/PageHeaderBoxes'
import { ConfidentialModeIndicator } from '@/components/dashboard/ConfidentialModeIndicator'
import { GuideCallout } from '@/components/dashboard/GuideCallout'
import { MyStoryTab } from '@/components/dashboard/interview-prep/MyStoryTab'
import { LinkedInConnectCard } from '@/components/dashboard/marketing-plan/LinkedInConnectCard'
import { AlternativeNarrativeTabs } from '@/components/dashboard/marketing-plan/AlternativeNarrativeTabs'
import { ComfortSummary } from '@/components/dashboard/marketing-plan/ComfortSummary'
import { CuratedVideoCard } from '@/components/dashboard/CuratedVideoCard'
import { getLinkedInTipsVideos } from '@/lib/content/curated-content'
import { getCandidateContentLikeKeys, contentLikeKey } from '@/lib/content/content-likes'
import { HardQuestionsSection } from '@/components/dashboard/marketing-plan/HardQuestionsSection'
import { LowComfortActions } from '@/components/dashboard/marketing-plan/LowComfortActions'
import { TierSummaryCard } from '@/components/dashboard/TierSummaryCard'
import { linkedInActivityCountToTier } from '@/lib/marketing/linkedin-activity-count-tier'
import { isLinkedInPostingConfigured } from '@/lib/linkedin/oauth'
import { shouldRouteHardQuestionsToCoach } from '@/lib/narrative/hard-questions'
import type { NarrativeItem } from '@/components/dashboard/portfolio/NarrativeManager'
import type { NarrativeAdaptations } from '@/lib/narrative/generate-adaptations'
import type { HardQuestionAnswers } from '@/lib/narrative/hard-questions'

export const metadata: Metadata = { title: 'My Marketing Plan' }

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h2 className="text-lg font-semibold">{children}</h2>
}

export default async function MarketingPlanPage({
  searchParams,
}: {
  searchParams: Promise<{ label?: string; scenario?: string }>
}) {
  const profile = await getDashboardData()
  const { label: initialLabel, scenario: initialScenario } = await searchParams
  const unlocked = profile.contentComfortLevel !== null && profile.contentVenues.length > 0

  if (!unlocked) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">My Marketing Plan</h1>
          <p className="mt-1 text-muted-foreground">
            You&apos;re the product right now — this is where you plan how you get in front of
            people. Post ideas grounded in your actual background — pick one, get a draft, edit it
            so it sounds like you, and post.
          </p>
        </div>
        <div className="rounded-lg border border-border p-4 text-sm">
          <p className="font-medium text-foreground">Answer Marketing Plan Willingness on Search Strategy first</p>
          <p className="mt-1 text-muted-foreground">
            What you&apos;re willing to do publicly — thought leadership and LinkedIn openness — now
            lives on Search Strategy so you only answer it once.
          </p>
          <Link
            href="/dashboard/search-strategy"
            className="mt-2 inline-block text-sm text-primary underline underline-offset-4"
          >
            Go to Search Strategy →
          </Link>
        </div>
      </div>
    )
  }

  // A candidate who has explicitly said they want this kept private or
  // close-contacts-only isn't ready for "post publicly" to be the headline
  // ask — PRIVATE_ONLY/CLOSE_CONTACTS_ONLY are the two answers that mean
  // "not comfortable being visible yet," the other two
  // (BECOMING_COMFORTABLE/FULLY_COMFORTABLE) mean they're at least
  // open to it. A candidate who hasn't answered yet (null) is treated as
  // NOT low-comfort — defaulting to the standard framing rather than
  // assuming discomfort they haven't expressed.
  const isLowComfort =
    profile.publicDisclosureComfort === 'PRIVATE_ONLY' || profile.publicDisclosureComfort === 'CLOSE_CONTACTS_ONLY'

  const relevantTutorials = CONTENT_TUTORIALS.filter((t) => profile.contentVenues.includes(t.venue))

  const linkedinConfigured = isLinkedInPostingConfigured()
  const [narrativeRows, linkedinConnection, routeHardQuestionsToCoach, linkedInTips, likedKeys] = await Promise.all([
    prisma.candidateNarrative.findMany({
      where: { candidateId: profile.id },
      orderBy: { generatedAt: 'asc' },
    }),
    linkedinConfigured
      ? prisma.linkedInConnection.findUnique({ where: { candidateId: profile.id } })
      : Promise.resolve(null),
    shouldRouteHardQuestionsToCoach(profile.id),
    getLinkedInTipsVideos(profile.id),
    getCandidateContentLikeKeys(profile.id),
  ])
  const narratives: NarrativeItem[] = narrativeRows.map((n, i) => ({
    id: n.id,
    label: n.label,
    coreStatement: n.coreStatement,
    adaptations: (n.adaptations as unknown as NarrativeAdaptations | null) ?? null,
    isDefault: i === 0,
  }))
  const defaultNarrative = narrativeRows[0]
  const defaultNarrativeItem = narratives[0] as NarrativeItem | undefined
  const alternativeNarratives = narratives.slice(1)
  const hardQuestions = (defaultNarrative?.hardQuestions as unknown as HardQuestionAnswers | null) ?? null
  const linkedin = {
    configured: linkedinConfigured,
    connected: !!linkedinConnection && !linkedinConnection.disconnectedAt,
    // §4.3: LinkedIn posting is off by default while Confidential Search
    // Mode is on, until the candidate deliberately turns it on.
    blockedByConfidentialMode: profile.confidentialSearchMode && !profile.confidentialLinkedInPostingOptIn,
  }

  // All-time count, matching the existing convention this same field is
  // already counted with in unlock-tier.ts — no new query needed since
  // getDashboardData() already includes linkedInActivityLogs.
  const linkedInActivityCount = profile.linkedInActivityLogs.length
  const directPostCount = profile.linkedInActivityLogs.filter((l) => l.source === 'DIRECT_POST').length

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight">My Marketing Plan</h1>
        <PageHeaderBoxes pageKey="marketing-plan" candidateId={profile.id} />
      </div>

      {profile.confidentialSearchMode && <ConfidentialModeIndicator />}

      <div className="space-y-1.5 rounded-lg border border-border bg-off-white p-4 text-sm text-muted-foreground">
        <p>
          <span className="font-medium text-foreground">Core Narrative</span>{' '}
          is your default professional story — draft it once and everything below adapts from it,
          grouped by who you&apos;re talking to.
        </p>
        <p>
          <span className="font-medium text-foreground">Tailored narratives</span>{' '}
          let you tell a different version of your story for a specific scenario — a specific job,
          a layoff, a pivot, a return after time off.
        </p>
        {isLowComfort ? (
          <p>
            Not everyone is ready to be public yet, and that&apos;s fine — this page also gives
            you private ways to sharpen your story: practicing with your coach, sharing it with a
            trusted contact, and the casual answers to the questions people actually ask you.
          </p>
        ) : (
          <p>
            <span className="font-medium text-foreground">Tutorials</span>{' '}
            below are matched to the venues you said you&apos;d post on. Everything you post shows
            up on your Certified Executive Dossier as real, visible activity — not just a resume
            claim.
          </p>
        )}
      </div>

      {linkedin.configured && <LinkedInConnectCard connected={linkedin.connected} />}

      <ComfortSummary
        publicDisclosureComfort={profile.publicDisclosureComfort}
        publicVisibilityComfortBonusAt={profile.publicVisibilityComfortBonusAt}
        storyComfort={profile.storyComfort}
        interviewComfort={profile.interviewComfort}
        elevatorPitchReady={profile.elevatorPitchReady}
        networkComfortLevel={profile.networkComfortLevel}
      />

      {/* LinkedIn Posting Tips — writing/growth/engagement mechanics, not
          personalized (same catalog for everyone, no industry match) — see
          getLinkedInTipsVideos. Liking one adds it to My Favorites on the
          Videos and Webinars page (getCandidateFavorites resolves any liked
          CuratedVideo row regardless of category); clicks/likes/dislikes all
          roll up into the admin Stats tab the same as every other carousel. */}
      <div className="space-y-3 border-t border-border pt-8">
        <SectionHeading>LinkedIn Posting Tips</SectionHeading>
        {linkedInTips.length === 0 ? (
          <p className="rounded-lg border border-border p-6 text-center text-sm text-muted-foreground">
            Nothing here yet — check back soon.
          </p>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-2">
            {linkedInTips.map((video) => (
              <CuratedVideoCard
                key={video.id}
                video={video}
                isLiked={likedKeys.has(contentLikeKey('CURATED_VIDEO', video.id))}
              />
            ))}
          </div>
        )}
      </div>

      <div className="space-y-3 border-t border-border pt-8">
        <SectionHeading>Core Narrative</SectionHeading>
        <MyStoryTab
          coreStatement={defaultNarrativeItem?.coreStatement ?? null}
          adaptations={defaultNarrativeItem?.adaptations ?? null}
          linkedin={linkedin}
        />
      </div>

      <div id="tailored-narratives" className="scroll-mt-4 space-y-3 border-t border-border pt-8">
        <SectionHeading>Tailored Narratives</SectionHeading>
        <p className="text-sm text-muted-foreground">
          Need a different story for a specific scenario — a specific job, a layoff, a pivot?
          Draft as many tailored narratives as you need, each in its own tab below.
        </p>
        <AlternativeNarrativeTabs
          alternatives={alternativeNarratives}
          initialLabel={initialLabel}
          initialScenario={initialScenario}
          linkedin={linkedin}
        />
      </div>

      {defaultNarrativeItem?.coreStatement && (
        <div className="space-y-3 border-t border-border pt-8">
          <SectionHeading>Answers to the Hard Questions</SectionHeading>
          <HardQuestionsSection hardQuestions={hardQuestions} routeToCoach={routeHardQuestionsToCoach} />
        </div>
      )}

      {relevantTutorials.length > 0 && (
        <div className="space-y-3 border-t border-border pt-8">
          <SectionHeading>Tutorials for your venues</SectionHeading>
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

      {linkedInActivityCount > 0 && (
        <div className="border-t border-border pt-8">
          <TierSummaryCard
            title="LinkedIn Activity"
            count={linkedInActivityCount}
            unitLabel="day"
            tier={linkedInActivityCountToTier(linkedInActivityCount)}
            buildingAt={3}
            highAt={5}
            unlockedContent={
              <p className="text-sm text-muted-foreground">
                {linkedInActivityCount} day{linkedInActivityCount === 1 ? '' : 's'} of LinkedIn activity logged
                {directPostCount > 0 &&
                  ` — ${directPostCount} posted directly through NextChapter, the rest self-reported`}
                .
              </p>
            }
          />
        </div>
      )}

      <div className="space-y-6 border-t border-border pt-8">
        {isLowComfort ? (
          <>
            <div className="space-y-3">
              <SectionHeading>Practice quietly</SectionHeading>
              <p className="text-sm text-muted-foreground">
                You said you&apos;d rather keep this private or close-contacts-only for now — these
                count as real progress too.
              </p>
              <LowComfortActions />
            </div>
            <div className="space-y-3 border-t border-border pt-8">
              <SectionHeading>When you&apos;re ready to post</SectionHeading>
              <p className="text-sm text-muted-foreground">
                No pressure — these are here whenever being more public starts to feel okay.
              </p>
              <ThoughtLeadershipStudio venues={profile.contentVenues} linkedin={linkedin} />
            </div>
          </>
        ) : (
          <div className="space-y-3">
            <SectionHeading>Post your story</SectionHeading>
            <ThoughtLeadershipStudio venues={profile.contentVenues} linkedin={linkedin} />
          </div>
        )}
      </div>

      <div className="rounded-lg border border-border p-4">
        <p className="text-sm text-foreground">
          Have an interview coming up? Your narrative above is the raw material — Interview Prep
          adapts it into likely questions, talking points, and practice for a specific role.
        </p>
        <Link
          href="/dashboard/interview-prep"
          className="mt-2 inline-block text-sm font-medium text-primary underline underline-offset-4"
        >
          Go to Interview Prep →
        </Link>
      </div>

      <GuideCallout pageSlot="marketing-plan" currentJobStatus={profile.currentJobStatus} />
    </div>
  )
}
