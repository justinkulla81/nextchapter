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
import { LinkedInConnectCard } from '@/components/dashboard/marketing-plan/LinkedInConnectCard'
import { LinkedInComposer } from '@/components/dashboard/marketing-plan/LinkedInComposer'
import { LinkedInProfileGraderForm } from '@/components/dashboard/marketing-plan/LinkedInProfileGraderForm'
import { CoreNarrativeBootstrap } from '@/components/dashboard/marketing-plan/CoreNarrativeBootstrap'
import { NarrativeManager, type NarrativeItem } from '@/components/dashboard/portfolio/NarrativeManager'
import { CuratedVideoCard } from '@/components/dashboard/CuratedVideoCard'
import { getLinkedInTipsVideos } from '@/lib/content/curated-content'
import { getCandidateContentLikeKeys, contentLikeKey } from '@/lib/content/content-likes'
import { HardQuestionsSection } from '@/components/dashboard/marketing-plan/HardQuestionsSection'
import { LowComfortActions } from '@/components/dashboard/marketing-plan/LowComfortActions'
import { isLinkedInPostingConfigured } from '@/lib/linkedin/oauth'
import { shouldRouteHardQuestionsToCoach } from '@/lib/narrative/hard-questions'
import { getUnifiedFollowUps } from '@/lib/dashboard/unified-follow-ups'
import { formatRelativeTime } from '@/lib/format-relative-time'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { NarrativeAdaptations } from '@/lib/narrative/generate-adaptations'
import type { HardQuestionAnswers } from '@/lib/narrative/hard-questions'

export const metadata: Metadata = { title: 'My Marketing Plan' }

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h2 className="text-lg font-semibold">{children}</h2>
}

// Same checked/unchecked-circle row language as TierSummaryCard's MixRow
// ("A well-rounded mix") — so the Action Plan reads consistently with the
// rest of the dashboard's checklists instead of a plain link list.
function ActionPlanRow({ href, label, done }: { href: string; label: string; done: boolean }) {
  return (
    <a href={href} className={cn('flex items-center gap-2 text-sm hover:underline', done ? 'text-success' : 'text-foreground')}>
      <span
        className={cn(
          'flex size-4 shrink-0 items-center justify-center rounded-full border',
          done ? 'border-success bg-success/10' : 'border-border'
        )}
      >
        {done && <Check className="size-3" />}
      </span>
      {label}
    </a>
  )
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
  // ThoughtLeadershipStudio below only needs to cover non-LinkedIn venues
  // (Substack, etc.) — LinkedIn has its own compose box in the LinkedIn
  // section above it.
  const otherVenues = profile.contentVenues.filter((v) => v !== 'LINKEDIN')

  const linkedinConfigured = isLinkedInPostingConfigured()
  const [narrativeRows, linkedinConnection, routeHardQuestionsToCoach, linkedInTips, likedKeys, followUps, linkedInProfileGrade] =
    await Promise.all([
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
      getUnifiedFollowUps(profile.id, 5),
      prisma.linkedInProfileGrade.findUnique({ where: { candidateId: profile.id } }),
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

      {/* Action Plan — quick links to every section on this page, in the
          order a candidate would actually work through them, each checked
          off once there's real signal it's done. */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">Action Plan</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-2 sm:grid-cols-2">
            {[
              ...(linkedin.configured
                ? [{ href: '#linkedin', label: 'Connect LinkedIn', done: linkedin.connected }]
                : []),
              { href: '#linkedin', label: 'LinkedIn Posts', done: linkedInActivityCount > 0 },
              { href: '#narrative', label: 'Narrative', done: narratives.length > 0 },
              { href: '#outreach-prep', label: 'Outreach Prep', done: followUps.length === 0 },
              { href: '#interview-prep', label: 'Interview Prep', done: profile.interviewComfort !== null },
              ...(defaultNarrativeItem?.coreStatement
                ? [{ href: '#hard-questions', label: 'Answer Hard Questions', done: hardQuestions !== null }]
                : []),
            ].map((item) => (
              <li key={item.label}>
                <ActionPlanRow href={item.href} label={item.label} done={item.done} />
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* LinkedIn — connect status plus a compose box for writing your own
          post (with idea generation underneath as a fallback) and the
          activity status line right above it. Posting tips and tutorials
          now live in the Learning section near the bottom of the page. */}
      <div id="linkedin" className="scroll-mt-4 space-y-4 border-t border-border pt-8">
        <SectionHeading>LinkedIn</SectionHeading>
        {linkedin.configured && <LinkedInConnectCard connected={linkedin.connected} />}
        <LinkedInComposer
          linkedin={linkedin}
          name={[profile.firstName, profile.lastName].filter(Boolean).join(' ') || 'You'}
          photoUrl={profile.profilePictureUrl}
          activityCount={linkedInActivityCount}
          directPostCount={directPostCount}
        />
        <LinkedInProfileGraderForm existing={linkedInProfileGrade} />
      </div>

      {/* Narrative — Core Narrative and every Tailored Narrative as one
          minimized list (NarrativeManager): collapsed to a name and a
          one-line summary by default, with "Ways to say it" grouped into
          its own minimized accordions once a row is expanded. Adding a new
          narrative collapses back into the list once drafted. */}
      <div id="narrative" className="scroll-mt-4 space-y-3 border-t border-border pt-8">
        <SectionHeading>Narrative</SectionHeading>
        <p className="text-sm text-muted-foreground">
          Your Core Narrative is your default professional story — draft it once and everything
          adapts from it. Add a Tailored Narrative for a different scenario — a specific job, a
          layoff, a pivot, a return after time off.
        </p>
        {narratives.length === 0 ? (
          <CoreNarrativeBootstrap />
        ) : (
          <NarrativeManager
            narratives={narratives}
            initialLabel={initialLabel}
            initialScenario={initialScenario}
            linkedin={linkedin}
          />
        )}
      </div>

      {defaultNarrativeItem?.coreStatement && (
        <div id="hard-questions" className="scroll-mt-4 space-y-3 border-t border-border pt-8">
          <SectionHeading>Answers to the Hard Questions</SectionHeading>
          <HardQuestionsSection hardQuestions={hardQuestions} routeToCoach={routeHardQuestionsToCoach} />
        </div>
      )}

      {/* Outreach Prep — the same unified follow-ups signal the dedicated
          Follow-ups page reads (starred/stale contacts, unanswered
          recruiter replies, unanswered applications). Every item links
          straight to where it's actioned — mostly My Network with
          Contacts, since that's where a candidate actually follows up. */}
      <div id="outreach-prep" className="scroll-mt-4 space-y-3 border-t border-border pt-8">
        <SectionHeading>Outreach Prep</SectionHeading>
        <p className="text-sm text-muted-foreground">
          People and applications waiting on a reply from you — follow up before your story goes
          cold.
        </p>
        {followUps.length === 0 ? (
          <p className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
            You&apos;re all caught up — nothing needs a follow-up right now.
          </p>
        ) : (
          <div className="divide-y divide-border rounded-lg border border-border bg-card">
            {followUps.map((item) => {
              const isExternal = item.href.startsWith('http')
              const content = (
                <>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                    {item.title}
                  </span>
                  <span
                    className="max-w-[45%] shrink-0 truncate rounded-full bg-orange/15 px-2 py-0.5 text-xs font-medium text-foreground"
                    title={item.subtitle}
                  >
                    {item.subtitle}
                  </span>
                  {item.date && (
                    <span className="w-20 shrink-0 text-right text-xs text-muted-foreground">
                      {formatRelativeTime(item.date)}
                    </span>
                  )}
                </>
              )
              const className =
                'flex items-center justify-between gap-3 px-4 py-3 text-sm transition-colors hover:text-brand'
              return isExternal ? (
                <a
                  key={`${item.kind}-${item.id}`}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={className}
                >
                  {content}
                </a>
              ) : (
                <Link key={`${item.kind}-${item.id}`} href={item.href} className={className}>
                  {content}
                </Link>
              )
            })}
          </div>
        )}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <Link href="/dashboard/network/follow-ups" className="text-primary underline underline-offset-4">
            View all follow-ups →
          </Link>
          <Link href="/dashboard/network/contacts" className="text-primary underline underline-offset-4">
            Go to My Network with Contacts →
          </Link>
        </div>
      </div>

      {isLowComfort && (
        <div className="space-y-6 border-t border-border pt-8">
          <div className="space-y-3">
            <SectionHeading>Practice quietly</SectionHeading>
            <p className="text-sm text-muted-foreground">
              You said you&apos;d rather keep this private or close-contacts-only for now — these
              count as real progress too.
            </p>
            <LowComfortActions />
          </div>
          {otherVenues.length > 0 && (
            <div className="space-y-3 border-t border-border pt-8">
              <SectionHeading>When you&apos;re ready to post</SectionHeading>
              <p className="text-sm text-muted-foreground">
                No pressure — these are here whenever being more public starts to feel okay.
              </p>
              <ThoughtLeadershipStudio venues={otherVenues} linkedin={linkedin} />
            </div>
          )}
        </div>
      )}

      {!isLowComfort && otherVenues.length > 0 && (
        <div className="space-y-3 border-t border-border pt-8">
          <SectionHeading>Post your story</SectionHeading>
          <ThoughtLeadershipStudio venues={otherVenues} linkedin={linkedin} />
        </div>
      )}

      <div id="interview-prep" className="scroll-mt-4 space-y-3 border-t border-border pt-8">
        <SectionHeading>Interview Prep</SectionHeading>
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
      </div>

      {/* Learning — posting tips and how-to tutorials together in one
          place, near the bottom of the page above Resources, instead of
          split across the LinkedIn section and a separate venues block. */}
      {(linkedInTips.length > 0 || relevantTutorials.length > 0) && (
        <div className="space-y-6 border-t border-border pt-8">
          <SectionHeading>Learning</SectionHeading>

          {/* Writing/growth/engagement mechanics, not personalized (same
              catalog for everyone, no industry match) — see
              getLinkedInTipsVideos. Liking one adds it to My Favorites on
              the Videos and Webinars page (getCandidateFavorites resolves
              any liked CuratedVideo row regardless of category); clicks/
              likes/dislikes all roll up into the admin Stats tab the same
              as every other carousel. */}
          {linkedInTips.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">Posting Tips</h3>
              <div className="flex gap-4 overflow-x-auto pb-2">
                {linkedInTips.map((video) => (
                  <CuratedVideoCard
                    key={video.id}
                    video={video}
                    isLiked={likedKeys.has(contentLikeKey('CURATED_VIDEO', video.id))}
                  />
                ))}
              </div>
            </div>
          )}

          {relevantTutorials.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">Tutorials</h3>
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
        </div>
      )}

      <GuideCallout pageSlot="marketing-plan" currentJobStatus={profile.currentJobStatus} />
    </div>
  )
}
