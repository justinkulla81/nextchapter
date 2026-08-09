import type { Metadata } from 'next'
import Link from 'next/link'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { prisma } from '@/lib/prisma'
import { surfaceNewJobs } from '@/lib/network/job-discovery'
import { getWatchlistView } from '@/lib/company-tracker/watchlist'
import { FIT_BUCKET_LABEL, isWeakFit } from '@/lib/jobs/fit-bucket-types'
import { CompanyWatchlistForm } from '@/components/dashboard/CompanyWatchlistForm'
import { CompanyWatchlist } from '@/components/dashboard/CompanyWatchlistList'
import { MarkWatchlistViewedOnMount } from '@/components/dashboard/MarkWatchlistViewedOnMount'
import { JobUrlForm } from '@/components/dashboard/JobUrlForm'
import { JobPostingTextFallback } from '@/components/dashboard/JobPostingTextFallback'
import { NextSurfacedJobCard } from '@/components/dashboard/NextSurfacedJobCard'
import { InterestedJobsList } from '@/components/dashboard/InterestedJobsList'
import { ShowMoreList } from '@/components/dashboard/ShowMoreList'
import { DiscoverJobCard, LockedDiscoverJobCard } from '@/components/dashboard/DiscoverJobCard'
import { UnlockAListCallout } from '@/components/dashboard/UnlockAListCallout'
import { GoogleConnectPrompt } from '@/components/dashboard/GoogleConnectPrompt'
import { ReconnectBanner } from '@/components/dashboard/ReconnectBanner'
import { NetworkStatTile, type StatTileItem } from '@/components/dashboard/NetworkStatTile'
import { WhoCanHelpSection } from '@/components/dashboard/WhoCanHelpSection'
import { JobBoardLinkList } from '@/components/dashboard/JobBoardLinkList'
import {
  GENERAL_JOB_BOARDS,
  WOMEN_FOCUSED_JOB_BOARDS,
  DIVERSITY_FOCUSED_JOB_BOARDS,
  getIndustryJobBoards,
} from '@/lib/constants/industry-job-boards'
import {
  deleteJobPosting,
  retryJobFetch,
  markApplied,
  markInterviewLanded,
  markInterviewLandedFromForm,
  addInterviewJob,
  markOfferReceived,
  markDeclined,
  updateApplicationDetails,
  generateCoverLetterAction,
  prepForPhoneScreen,
  markInterviewComplete,
} from './actions'
import { ThankYouNoteCard } from '@/components/dashboard/ThankYouNoteCard'
import { MarkAppliedForm } from '@/components/dashboard/MarkAppliedForm'
import { ConversionDiagnosticCard } from '@/components/dashboard/ConversionDiagnosticCard'
import { NegotiationPracticeTab } from '@/components/dashboard/NegotiationPracticeTab'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { syncGmailConnection } from '@/lib/email-tracking/sync-gmail'
import { Button } from '@/components/ui/button'
import { SubmitButton } from '@/components/ui/submit-button'
import { scoreToGrade, GRADE_LABEL } from '@/lib/scoring/grade'
import { computeHireabilityGrade, type CandidateWithGradeRelations } from '@/lib/scoring/hireability-grade'
import { MAX_ACTIVE_FIT_CHECK_SLOTS } from '@/lib/constants/job-milestones'
import { computeBoardListingFitBucket, computeSurfacedJobFitBucket } from '@/lib/jobs/job-fit-bucket'
import { PageHeaderBoxes } from '@/components/dashboard/PageHeaderBoxes'
import { GuideCallout } from '@/components/dashboard/GuideCallout'
import { resolveCompanySizeBand } from '@/lib/market/company-size'
import { normalizeOrgName, orgNamesMatch } from '@/lib/text/org-name-match'
import { getMondayOfWeek } from '@/lib/weekly/sprint'
import { estimateActionEffort } from '@/lib/weekly/action-effort'

export const metadata: Metadata = { title: 'Find Full-Time Jobs' }

const SURFACED_JOB_LIST_SIZE = 5
// Free candidates only ever see the first 3 automated-search-partner
// matches — the rest count toward the same "opportunities waiting" total
// the hamburger nav badge shows, but stay locked until an A grade.
const SURFACED_JOB_FREE_PREVIEW = 3
// Keeps the unreacted queue from silently ballooning: surfaceNewJobs used to
// fetch a fresh batch of up to 10 every time the queue dropped below
// SURFACED_JOB_LIST_SIZE, regardless of how close to that ceiling it already
// was — so a candidate who reacted to just one match could see the total
// jump from 4 to 14. Topping up only the shortfall to this fixed pool size
// keeps the number bounded and keeps the nav badge and this page's own
// count from ever drifting apart.
const SURFACED_JOB_POOL_TARGET = 10
// The locked A-List teaser board can have dozens of approved postings once
// a candidate isn't A-List — showing all of them as individual dashed cards
// is noise, not information. A few examples plus a summary line makes the
// same point without the wall.
const LOCKED_PREVIEW_COUNT = 3

interface InterviewPrep {
  likelyQuestions: string[]
  talkingPoints: string[]
  questionsToAsk: string[]
}

interface NegotiationAdvice {
  talkingPoints: string[]
  scriptOpening: string
  considerations: string[]
}

interface TailoredBullet {
  original: string
  tailored: string
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Fetching…',
  success: 'Analyzed',
  fetch_failed: 'Could not fetch this URL',
  parse_failed: 'Could not read this page',
  blocked: "This site can't be fetched automatically",
}

export default async function JobFitPage() {
  const profile = await getDashboardData()
  // EMAIL_DETECTED rows don't consume a fit-check slot — they were never
  // analyzed, so they shouldn't block adding a URL-based one.
  const activeCount = profile.jobPostings.filter(
    (j) => j.source !== 'EMAIL_DETECTED' && j.interviewLandedAt === null && j.offerReceivedAt === null
  ).length
  const atCap = activeCount >= MAX_ACTIVE_FIT_CHECK_SLOTS

  // Auto-backfill the surfaced-job queue server-side so the list always
  // stays topped up at SURFACED_JOB_LIST_SIZE — reacting to one immediately
  // makes room for a fresh one rather than shrinking the list.
  const unreactedCount = await prisma.surfacedJob.count({
    where: { candidateId: profile.id, reaction: null },
  })
  if (unreactedCount < SURFACED_JOB_POOL_TARGET) {
    await surfaceNewJobs(profile.id, SURFACED_JOB_POOL_TARGET - unreactedCount)
  }

  const [surfacedJobs, totalUnreactedCount, interestedJobs, grade, boardPostings] = await Promise.all([
    prisma.surfacedJob.findMany({
      where: { candidateId: profile.id, reaction: null },
      orderBy: { surfacedAt: 'desc' },
      take: SURFACED_JOB_LIST_SIZE,
    }),
    // The real total waiting for a reaction — same query the nav badge
    // uses — so the count shown here always matches what "Jobs" says in
    // the hamburger nav, even though the list below only renders the
    // latest SURFACED_JOB_LIST_SIZE.
    prisma.surfacedJob.count({ where: { candidateId: profile.id, reaction: null } }),
    prisma.surfacedJob.findMany({
      where: { candidateId: profile.id, reaction: 'INTERESTED' },
      orderBy: { reactedAt: 'desc' },
    }),
    computeHireabilityGrade(profile as unknown as CandidateWithGradeRelations),
    prisma.exclusiveJobPosting.findMany({
      where: {
        status: 'approved',
        archivedAt: null,
        distribution: { not: 'EXCLUDED' },
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  const isAList = grade.grade === 'A'
  // Free candidates only ever see the first SURFACED_JOB_FREE_PREVIEW
  // matches — the rest stay locked until an A grade, folded into the same
  // unlock count as the locked job-board postings below so there's one
  // combined "unlock at an A grade" number for the whole Discover list.
  const visibleSurfacedJobs = isAList ? surfacedJobs : surfacedJobs.slice(0, SURFACED_JOB_FREE_PREVIEW)
  const lockedSurfacedCount = isAList ? 0 : Math.max(0, totalUnreactedCount - visibleSurfacedJobs.length)
  // Needs isAList to decide which A_LIST_ONLY postings this candidate can
  // actually open — can't join the barrier above since grade isn't known
  // until it resolves.
  const watchlistView = await getWatchlistView(profile.id, isAList)
  const openBoardPostings = boardPostings.filter(
    (p) => p.audienceTier === 'ALL_CANDIDATES' || isAList
  )
  const lockedBoardPostings = boardPostings.filter(
    (p) => p.audienceTier === 'A_LIST_ONLY' && !isAList
  )

  // computeBoardListingFitBucket/computeSurfacedJobFitBucket are synchronous
  // (called inline in JSX below), but resolveCompanySizeBand isn't — resolve
  // every distinct company name shown on this page once, up front, into a
  // normalizeOrgName-keyed map so each render call can look its band up
  // synchronously instead of awaiting per-card.
  const companyNames = [
    ...openBoardPostings.map((p) => p.companyName),
    ...surfacedJobs.map((j) => j.companyName),
    ...profile.jobPostings.map((j) => j.companyName),
  ].filter((name): name is string => !!name)
  const distinctCompanyNames = [...new Set(companyNames)]
  const resolvedBands = await Promise.all(distinctCompanyNames.map((name) => resolveCompanySizeBand(name)))
  const companySizeBandByName = new Map(
    distinctCompanyNames.map((name, i) => [normalizeOrgName(name), resolvedBands[i].band])
  )
  const companySizeBandFor = (companyName: string | null) =>
    companyName ? (companySizeBandByName.get(normalizeOrgName(companyName)) ?? null) : null

  // "Who can help with this one?" — contacts already manually linked to a
  // specific application, plus company-matched suggestions from the
  // candidate's own network list they haven't linked yet.
  const [contacts, jobsWithHelpfulContacts] = await Promise.all([
    prisma.supportNetworkContact.findMany({
      where: { candidateId: profile.id, OR: [{ company: { not: null } }, { inferredCompany: { not: null } }] },
      select: { id: true, name: true, company: true, inferredCompany: true },
    }),
    prisma.jobPosting.findMany({
      where: { candidateId: profile.id },
      select: { id: true, helpfulContacts: { select: { id: true, name: true } } },
    }),
  ])
  const helpfulContactsByJobId = new Map(jobsWithHelpfulContacts.map((j) => [j.id, j.helpfulContacts]))
  const MAX_SUGGESTED_HELP_CONTACTS = 5
  const whoCanHelpFor = (jobId: string, companyName: string | null) => {
    const linkedContacts = helpfulContactsByJobId.get(jobId) ?? []
    if (!companyName) return { linkedContacts, suggestedContacts: [] }
    const linkedIds = new Set(linkedContacts.map((c) => c.id))
    const suggestedContacts = contacts
      .filter(
        (c) =>
          !linkedIds.has(c.id) &&
          ((c.company && orgNamesMatch(c.company, companyName)) ||
            (c.inferredCompany && orgNamesMatch(c.inferredCompany, companyName)))
      )
      .slice(0, MAX_SUGGESTED_HELP_CONTACTS)
      .map((c) => ({ id: c.id, name: c.name }))
    return { linkedContacts, suggestedContacts }
  }

  // A Targeted listing is only shown to candidates who actually fit it —
  // an Open one is shown to everyone regardless of fit (the bucket badge
  // still tells them how good a match it is).
  const visibleBoardPostings = openBoardPostings.filter((p) => {
    if (p.distribution !== 'TARGETED') return true
    return !isWeakFit(computeBoardListingFitBucket(profile, p, companySizeBandFor(p.companyName)))
  })

  // Every posting with appliedAt set is "My Applications", regardless of
  // whether it was pasted in manually or auto-detected from email.
  const allApplications = profile.jobPostings
    .filter((j) => j.appliedAt !== null)
    .sort((a, b) => (b.appliedAt?.getTime() ?? 0) - (a.appliedAt?.getTime() ?? 0))
  const weekStart = getMondayOfWeek(new Date())
  const applicationsThisWeek = allApplications.filter((j) => j.appliedAt! >= weekStart).length

  // Interview Tracking section — a top-level rollup of everything already
  // marked interviewLandedAt, so a candidate doesn't have to dig into a
  // collapsed application card to see where they stand or jump to prep.
  const interviewingPostings = profile.jobPostings
    .filter((j) => j.interviewLandedAt !== null)
    .sort((a, b) => b.interviewLandedAt!.getTime() - a.interviewLandedAt!.getTime())
  // Postings a candidate could plausibly say "I have an interview for this"
  // about — already applied (or an email-detected row, which is assumed
  // applied) and not already interviewing/declined/offered.
  const eligibleForInterview = profile.jobPostings.filter(
    (j) =>
      j.interviewLandedAt === null &&
      j.declinedAt === null &&
      j.offerReceivedAt === null &&
      (j.source === 'EMAIL_DETECTED' || j.appliedAt !== null)
  )

  // Open board postings per company, keyed by normalized name — surfaced
  // next to each application so a candidate sees "3 open roles at Foo in
  // our job board" right where they're tracking that application.
  const boardPostingCountByCompany = new Map<string, number>()
  for (const p of boardPostings) {
    if (!p.companyName) continue
    const key = normalizeOrgName(p.companyName)
    boardPostingCountByCompany.set(key, (boardPostingCountByCompany.get(key) ?? 0) + 1)
  }
  const boardPostingCountFor = (companyName: string | null) =>
    companyName ? (boardPostingCountByCompany.get(normalizeOrgName(companyName)) ?? 0) : 0

  // Job-application-related email activity (confirmations, recruiter
  // outreach, interview invites, rejections, offers) — auto-detected via
  // the same Gmail connection managed on the Live Conversations page.
  // Networking-shaped sent mail stays there; this page only shows the
  // job-outcome side of that same synced inbox.
  const emailConnection = await prisma.emailConnection.findFirst({
    where: { candidateId: profile.id, disconnectedAt: null },
  })
  // This page previously only ever saw activity synced from a visit to
  // Live Conversations (the only page that called syncGmailConnection) — a
  // candidate who applied to a job and only checked this page would never
  // see the confirmation email until they happened to visit that other
  // page. Awaited inline (see sync-gmail.ts's batched-existence-check
  // comment) so a real application confirmation shows up on the very next
  // refresh here too.
  if (emailConnection) {
    await syncGmailConnection(emailConnection.id).catch((error) => console.error('Email auto-sync failed:', error))
  }
  const [jobEmailActivities, resumesSharedItems, emailRecruiterContactItems, calendarRecruiterContactItems] =
    emailConnection
      ? await Promise.all([
          prisma.trackedEmailActivity.findMany({
            where: { candidateId: profile.id, direction: 'INBOUND', dismissedAt: null, confidence: 'high' },
          }),
          prisma.trackedEmailActivity.findMany({
            where: { candidateId: profile.id, direction: 'OUTBOUND', hasResumeAttachment: true, dismissedAt: null },
          }),
          prisma.trackedEmailActivity.findMany({
            where: { candidateId: profile.id, isRecruiterContact: true, dismissedAt: null },
          }),
          prisma.trackedCalendarEvent.findMany({
            where: { candidateId: profile.id, isRecruiterContact: true, dismissedAt: null },
          }),
        ])
      : [[], [], [], []]
  const jobEmailCounts = jobEmailActivities.reduce<Record<string, number>>((acc, a) => {
    acc[a.activityType] = (acc[a.activityType] ?? 0) + 1
    return acc
  }, {})
  const jobEmailItem = (a: (typeof jobEmailActivities)[number]): StatTileItem => ({
    id: a.id,
    kind: 'email',
    label: a.subject || (a.companyName ? `Email — ${a.companyName}` : 'Email'),
    date: a.detectedAt,
  })
  // Recruiter contact now covers both directions of email (a recruiter's
  // inbound outreach or the candidate's own outbound reply/cold outreach to
  // one) plus calendar events whose title/description mentions a recruiter
  // role — not just the INBOUND-only RECRUITER_OUTREACH email category.
  jobEmailCounts.RECRUITER_OUTREACH = emailRecruiterContactItems.length + calendarRecruiterContactItems.length
  const jobStatTileItems: Record<string, StatTileItem[]> = {
    RECRUITER_OUTREACH: [
      ...emailRecruiterContactItems.map(jobEmailItem),
      ...calendarRecruiterContactItems.map((e) => ({
        id: e.id,
        kind: 'calendar' as const,
        label: e.title || 'Calendar event',
        date: e.startTime,
      })),
    ],
    INTERVIEW_INVITE: jobEmailActivities.filter((a) => a.activityType === 'INTERVIEW_INVITE').map(jobEmailItem),
    REJECTION: jobEmailActivities.filter((a) => a.activityType === 'REJECTION').map(jobEmailItem),
    OFFER: jobEmailActivities.filter((a) => a.activityType === 'OFFER').map(jobEmailItem),
  }
  const JOB_EMAIL_LABEL: Record<string, string> = {
    RECRUITER_OUTREACH: 'Recruiter contact',
    INTERVIEW_INVITE: 'Interview invites',
    REJECTION: 'Rejections',
    OFFER: 'Offers',
  }

  // Apply to New Jobs section — job-board recommendations plus the point
  // values for the three real actions doable across this page, pulled from
  // the same effort table the Action Plan box uses so the numbers can never
  // drift out of sync with what a candidate actually earns.
  const industryBoards = getIndustryJobBoards(profile.targetIndustries)
  const applyEffort = estimateActionEffort({ actionType: 'JOB_APPLICATION_SUBMITTED' })
  const interestEffort = estimateActionEffort({ actionType: 'JOB_INTERESTED_REACTION' })
  const watchlistEffort = estimateActionEffort({ actionType: 'WATCHLIST_ADD' })

  return (
    <div className="space-y-10">
      <MarkWatchlistViewedOnMount />
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight">Jobs</h1>
        <PageHeaderBoxes pageKey="find-my-job" candidateId={profile.id} />
      </div>

      <ReconnectBanner candidateId={profile.id} />
      <GoogleConnectPrompt candidateId={profile.id} email={profile.email} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-border p-3">
          <p className="text-2xl font-bold text-foreground tabular-nums">
            {allApplications.length}
            <span className="ml-1.5 text-sm font-normal text-muted-foreground">
              · {applicationsThisWeek} this week
            </span>
          </p>
          <p className="text-xs text-muted-foreground">Applications sent</p>
        </div>
        {Object.entries(JOB_EMAIL_LABEL).map(([type, label]) => (
          <NetworkStatTile key={type} label={label} items={jobStatTileItems[type] ?? []} />
        ))}
        <NetworkStatTile label="Resumes shared" items={resumesSharedItems.map(jobEmailItem)} />
      </div>

      <div id="apply-new-jobs" className="scroll-mt-4 space-y-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Apply to New Jobs</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Search broadly, then check the boards tailored to you below — then come back and log
            what you applied to.
          </p>
        </div>

        <JobBoardLinkList boards={GENERAL_JOB_BOARDS} category="general" />

        {industryBoards.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Tailored to your industry
            </p>
            <JobBoardLinkList boards={industryBoards} category="industry" />
          </div>
        )}

        <details className="text-sm">
          <summary className="cursor-pointer font-medium text-primary underline underline-offset-4">
            More job boards
          </summary>
          <div className="mt-3 space-y-3">
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Boards focused on women in the workforce
              </p>
              <JobBoardLinkList boards={WOMEN_FOCUSED_JOB_BOARDS} category="women_focused" />
            </div>
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Boards focused on underrepresented groups
              </p>
              <JobBoardLinkList boards={DIVERSITY_FOCUSED_JOB_BOARDS} category="diversity_focused" />
            </div>
          </div>
        </details>

        <div className="rounded-lg border border-border p-4">
          <p className="text-sm font-medium text-foreground">Executive Recruiters</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {isAList
              ? "You're an A — recruiters can already find you."
              : "Recruiters can find and reach out to you directly once you hit an A grade — you can opt in any time so you're ready."}
          </p>
          <Link
            href="/dashboard/privacy"
            className="mt-2 inline-block text-sm font-medium text-primary underline underline-offset-4"
          >
            Manage recruiter visibility →
          </Link>
        </div>

        <div className="space-y-2 rounded-lg border border-border p-4">
          <p className="text-sm font-medium text-foreground">Ways to earn points here</p>
          <ul className="space-y-1.5 text-sm">
            <li>
              <Link href="#jobs-applied" className="text-primary underline underline-offset-4">
                Apply to a new job
              </Link>{' '}
              <span className="text-muted-foreground">
                (on LinkedIn, Indeed, etc.) — track it below once you apply · +{applyEffort.points} pts
              </span>
            </li>
            <li>
              <Link href="#job-recommendations" className="text-primary underline underline-offset-4">
                Express interest
              </Link>{' '}
              <span className="text-muted-foreground">
                in a job we&apos;ve listed for you · +{interestEffort.points} pts
              </span>
            </li>
            <li>
              <Link href="#company-tracker" className="text-primary underline underline-offset-4">
                Add a new company
              </Link>{' '}
              <span className="text-muted-foreground">to your tracker · +{watchlistEffort.points} pts</span>
            </li>
          </ul>
        </div>
      </div>

      <div id="job-recommendations" className="scroll-mt-4 space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">Job Recommendations For You</h2>

        {visibleBoardPostings.length === 0 &&
        lockedBoardPostings.length === 0 &&
        surfacedJobs.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No jobs surfaced yet — set a target role in your Goals to get started.
          </p>
        ) : (
          <Card>
            <CardContent className="space-y-3 pt-6">
              {surfacedJobs.length > 0 && (
                <p className="text-xs font-medium text-muted-foreground">
                  {totalUnreactedCount} match{totalUnreactedCount === 1 ? '' : 'es'} from your
                  automated search partners
                  {totalUnreactedCount > visibleSurfacedJobs.length &&
                    ` — showing ${visibleSurfacedJobs.length} below`}
                </p>
              )}

              <div className="divide-y divide-border rounded-lg border border-border">
                {visibleBoardPostings.map((posting) => (
                  <DiscoverJobCard
                    key={posting.id}
                    posting={posting}
                    fitBucket={computeBoardListingFitBucket(profile, posting, companySizeBandFor(posting.companyName))}
                  />
                ))}

                {visibleSurfacedJobs.map((job) => (
                  <NextSurfacedJobCard
                    key={job.id}
                    job={job}
                    fitBucket={computeSurfacedJobFitBucket(profile, job, companySizeBandFor(job.companyName))}
                  />
                ))}
              </div>

              {(lockedBoardPostings.length > 0 || lockedSurfacedCount > 0) && (
                <>
                  <UnlockAListCallout
                    grade={grade.grade}
                    lockedCount={lockedBoardPostings.length + lockedSurfacedCount}
                  />

                  <div className="divide-y divide-border rounded-lg border border-border">
                    {lockedBoardPostings.slice(0, LOCKED_PREVIEW_COUNT).map((posting) => (
                      <LockedDiscoverJobCard key={posting.id} posting={posting} />
                    ))}
                  </div>

                  <p className="text-sm text-muted-foreground">
                    {lockedSurfacedCount > 0 &&
                      `${lockedSurfacedCount} more recommendation${lockedSurfacedCount === 1 ? '' : 's'} for you unlock at an A grade. `}
                    {boardPostings.length} total jobs in our ATS.
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        )}

        <InterestedJobsList jobs={interestedJobs} />
      </div>

      <div id="interview-tracking" className="scroll-mt-4 space-y-4 rounded-lg border border-border p-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Interview Tracking</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Every interview you&apos;ve landed, in one place — plus a fast way to log a new one and
            jump straight to prep.
          </p>
        </div>

        {interviewingPostings.length > 0 && (
          <div className="divide-y divide-border rounded-lg border border-border">
            {interviewingPostings.map((posting) => (
              <div key={posting.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {posting.companyName ?? 'Unknown company'}
                    {posting.title ? ` — ${posting.title}` : ''}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Interview landed {posting.interviewLandedAt!.toLocaleDateString()}
                    {posting.interviewCompleteAt ? ' · Completed' : ''}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <form action={prepForPhoneScreen.bind(null, posting.id)}>
                    <SubmitButton variant="outline" size="sm">
                      Interview prep →
                    </SubmitButton>
                  </form>
                  {!posting.interviewCompleteAt && (
                    <form action={markInterviewComplete.bind(null, posting.id)}>
                      <SubmitButton variant="outline" size="sm">
                        Mark complete
                      </SubmitButton>
                    </form>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-3 border-t border-border pt-4">
          <p className="text-sm font-medium text-foreground">Got an interview?</p>

          {eligibleForInterview.length > 0 && (
            <form action={markInterviewLandedFromForm} className="flex flex-wrap items-center gap-2">
              <select
                name="jobPostingId"
                required
                defaultValue=""
                className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
              >
                <option value="" disabled>
                  Which job?
                </option>
                {eligibleForInterview.map((posting) => (
                  <option key={posting.id} value={posting.id}>
                    {posting.companyName ?? 'Unknown company'}
                    {posting.title ? ` — ${posting.title}` : ''}
                  </option>
                ))}
              </select>
              <SubmitButton variant="outline" size="sm">
                I have an interview for this job
              </SubmitButton>
            </form>
          )}

          <details>
            <summary className="cursor-pointer text-sm text-primary underline underline-offset-4">
              Add a job link for this interview
            </summary>
            <div className="mt-3">
              {atCap ? (
                <p className="text-sm text-muted-foreground">
                  You have 5 job postings tracked — remove one below to add another.
                </p>
              ) : (
                <JobUrlForm action={addInterviewJob} submitLabel="I'm interviewing — add job" />
              )}
            </div>
          </details>

          <Link
            href="/dashboard/interview-prep"
            className="block text-sm font-medium text-primary underline underline-offset-4"
          >
            Just want interview prep, no specific job? →
          </Link>
        </div>
      </div>

      <div id="jobs-applied" className="scroll-mt-4 space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">Jobs I&apos;ve Applied To</h2>

        <ConversionDiagnosticCard jobPostings={profile.jobPostings} />

        {profile.jobPostings.length > 0 && (
          <div className="divide-y divide-border rounded-lg border border-border">
            <ShowMoreList initialCount={10} totalCount={profile.jobPostings.length}>
            {profile.jobPostings.map((posting) => {
              const openRoles = boardPostingCountFor(posting.companyName)

              if (posting.source === 'EMAIL_DETECTED') {
                const status = posting.offerReceivedAt
                  ? 'Offer received'
                  : posting.declinedAt
                    ? posting.declinedBy === 'CANDIDATE'
                      ? 'I passed'
                      : 'They passed'
                    : posting.interviewLandedAt
                      ? 'Interview'
                      : 'Applied'
                // Only computable once a title exists — a confirmation
                // subject rarely names the role, so this reads null
                // ("can't tell yet") far more often than a real posting
                // would. Same free, no-LLM heuristic as every Discover
                // card uses, not a new scoring method.
                const fitBucket = posting.title
                  ? computeSurfacedJobFitBucket(
                      profile,
                      { title: posting.title, location: null, description: null },
                      companySizeBandFor(posting.companyName)
                    )
                  : null
                return (
                  <details key={posting.id}>
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
                      <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span className="text-sm font-medium text-foreground">
                          {posting.companyName ?? 'Unknown company'}
                        </span>
                        {posting.title && (
                          <span className="text-sm text-muted-foreground">— {posting.title}</span>
                        )}
                        {fitBucket && (
                          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                            {FIT_BUCKET_LABEL[fitBucket]}
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {status} · {posting.appliedAt?.toLocaleDateString()}
                      </span>
                    </summary>
                    <div className="space-y-3 px-4 pb-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-0.5">
                          {openRoles > 0 && (
                            <p className="text-xs text-muted-foreground">
                              {openRoles} open role{openRoles === 1 ? '' : 's'} in our job board
                            </p>
                          )}
                          {posting.url && (
                            <a
                              href={posting.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block text-xs text-primary underline underline-offset-4"
                            >
                              {posting.url}
                            </a>
                          )}
                          <p className="text-xs text-muted-foreground">Detected from email</p>
                        </div>
                        <form action={deleteJobPosting.bind(null, posting.id)}>
                          <SubmitButton variant="ghost" size="sm">
                            Remove
                          </SubmitButton>
                        </form>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {!posting.declinedAt && !posting.offerReceivedAt && !posting.interviewLandedAt && (
                          <form action={markInterviewLanded.bind(null, posting.id)}>
                            <SubmitButton variant="outline" size="sm">
                              I got an interview
                            </SubmitButton>
                          </form>
                        )}
                        {!posting.declinedAt && !posting.offerReceivedAt && (
                          <>
                            <form action={markDeclined.bind(null, posting.id, 'COMPANY')}>
                              <SubmitButton variant="outline" size="sm">
                                They passed on me
                              </SubmitButton>
                            </form>
                            <form action={markDeclined.bind(null, posting.id, 'CANDIDATE')}>
                              <SubmitButton variant="outline" size="sm">
                                I passed on them
                              </SubmitButton>
                            </form>
                          </>
                        )}
                        {!posting.offerReceivedAt && !posting.declinedAt && (
                          <form action={markOfferReceived.bind(null, posting.id)}>
                            <SubmitButton variant="outline" size="sm">
                              Offer Received
                            </SubmitButton>
                          </form>
                        )}
                      </div>
                      <details className="rounded-md border border-border p-3 text-xs">
                        <summary className="cursor-pointer font-medium text-foreground">
                          {posting.title || posting.url ? 'Edit title or link' : 'Add title or link'}
                        </summary>
                        <form
                          action={updateApplicationDetails.bind(null, posting.id)}
                          className="mt-3 space-y-3"
                        >
                          <div className="space-y-1">
                            <label htmlFor={`title-${posting.id}`} className="text-xs font-medium text-foreground">
                              Job title
                            </label>
                            <Input
                              id={`title-${posting.id}`}
                              name="title"
                              defaultValue={posting.title ?? ''}
                              placeholder="e.g. Senior Product Manager"
                            />
                          </div>
                          <div className="space-y-1">
                            <label htmlFor={`url-${posting.id}`} className="text-xs font-medium text-foreground">
                              Posting link (optional — private, only you see it)
                            </label>
                            <Input
                              id={`url-${posting.id}`}
                              name="url"
                              type="url"
                              defaultValue={posting.url ?? ''}
                              placeholder="https://"
                            />
                          </div>
                          <SubmitButton variant="outline" size="sm">
                            Save
                          </SubmitButton>
                        </form>
                      </details>
                      <WhoCanHelpSection {...whoCanHelpFor(posting.id, posting.companyName)} jobId={posting.id} />
                    </div>
                  </details>
                )
              }

              return (
              <details key={posting.id}>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
                  <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="truncate text-sm font-medium text-foreground">
                      {posting.title || posting.companyName || posting.url}
                    </span>
                    {posting.fitScore !== null && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                        Fit: {scoreToGrade(posting.fitScore)}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {posting.declinedAt
                      ? posting.declinedBy === 'CANDIDATE'
                        ? 'I passed'
                        : 'They passed'
                      : posting.offerReceivedAt
                        ? 'Offer received'
                        : posting.interviewLandedAt
                          ? 'Interview'
                          : posting.appliedAt
                            ? 'Applied'
                            : (STATUS_LABELS[posting.fetchStatus] ?? posting.fetchStatus)}
                  </span>
                </summary>
                <div className="space-y-3 px-4 pb-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <a
                        href={posting.url ?? '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary underline underline-offset-4"
                      >
                        {posting.url}
                      </a>
                      <p className="text-sm text-muted-foreground">
                        {STATUS_LABELS[posting.fetchStatus] ?? posting.fetchStatus}
                      </p>
                      {posting.companyName && openRoles > 0 && (
                        <p className="text-xs text-muted-foreground">
                          {openRoles} open role{openRoles === 1 ? '' : 's'} at {posting.companyName} in our job
                          board
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-2">
                      {(posting.fetchStatus === 'fetch_failed' || posting.fetchStatus === 'parse_failed') && (
                        <form action={retryJobFetch.bind(null, posting.id)}>
                          <SubmitButton variant="outline" size="sm">
                            Retry
                          </SubmitButton>
                        </form>
                      )}
                      <form action={deleteJobPosting.bind(null, posting.id)}>
                        <SubmitButton variant="ghost" size="sm">
                          Remove
                        </SubmitButton>
                      </form>
                    </div>
                  </div>

                  <WhoCanHelpSection {...whoCanHelpFor(posting.id, posting.companyName)} jobId={posting.id} />

                  {posting.fetchError && (
                    <p className="text-sm text-destructive">{posting.fetchError}</p>
                  )}

                  {(posting.fetchStatus === 'fetch_failed' ||
                    posting.fetchStatus === 'parse_failed' ||
                    posting.fetchStatus === 'blocked') && (
                    <JobPostingTextFallback
                      jobPostingId={posting.id}
                      autoExpand={posting.fetchStatus === 'blocked'}
                    />
                  )}

                  {posting.fitScore !== null && (
                    <div className="space-y-1">
                      <p className="text-sm font-medium">
                        Fit: {scoreToGrade(posting.fitScore)}{' '}
                        <span className="text-muted-foreground">
                          ({GRADE_LABEL[scoreToGrade(posting.fitScore)]})
                        </span>
                      </p>
                      {posting.fitFeedback.length > 0 && (
                        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                          {posting.fitFeedback.map((point, i) => (
                            <li key={i}>{point}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}

                  {posting.keywords.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Keywords to work into your resume
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {posting.keywords.map((keyword) => (
                          <span
                            key={keyword}
                            className="rounded-full border border-border bg-off-white px-2.5 py-0.5 text-xs font-medium text-foreground"
                          >
                            {keyword}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {Array.isArray(posting.tailoredBullets) && posting.tailoredBullets.length > 0 && (
                    <div className="space-y-2 rounded-md border border-border p-3">
                      <p className="text-sm font-medium">Bullets tailored to this posting</p>
                      <div className="space-y-3">
                        {(posting.tailoredBullets as unknown as TailoredBullet[]).map((bullet, i) => (
                          <div key={i} className="space-y-1 text-sm">
                            <p className="text-muted-foreground line-through decoration-destructive/50">
                              {bullet.original}
                            </p>
                            <p className="text-foreground">{bullet.tailored}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {posting.declinedAt && (
                    <p className="text-sm font-medium text-muted-foreground">
                      {posting.declinedBy === 'CANDIDATE' ? 'I passed' : 'They passed'}
                    </p>
                  )}

                  {posting.fitScore !== null && !posting.declinedAt && (
                    <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
                      {!posting.appliedAt && (
                        <MarkAppliedForm jobPostingId={posting.id} markApplied={markApplied} />
                      )}
                      {!posting.coverLetter && (
                        <form action={generateCoverLetterAction.bind(null, posting.id)}>
                          <SubmitButton variant="outline" size="sm" pendingLabel="Drafting…">
                            Draft a cover letter
                          </SubmitButton>
                        </form>
                      )}
                      {posting.appliedAt && !posting.interviewLandedAt && (
                        <>
                          <form action={markInterviewLanded.bind(null, posting.id)}>
                            <SubmitButton variant="outline" size="sm">
                              I got an interview
                            </SubmitButton>
                          </form>
                          <form action={prepForPhoneScreen.bind(null, posting.id)}>
                            <SubmitButton variant="outline" size="sm">
                              Prep for the phone screen →
                            </SubmitButton>
                          </form>
                        </>
                      )}
                      {posting.appliedAt && !posting.offerReceivedAt && (
                        <form action={markOfferReceived.bind(null, posting.id)}>
                          <SubmitButton variant="outline" size="sm">
                            Offer Received
                          </SubmitButton>
                        </form>
                      )}
                      {posting.appliedAt && !posting.offerReceivedAt && (
                        <>
                          <form action={markDeclined.bind(null, posting.id, 'COMPANY')}>
                            <SubmitButton variant="outline" size="sm">
                              They passed on me
                            </SubmitButton>
                          </form>
                          <form action={markDeclined.bind(null, posting.id, 'CANDIDATE')}>
                            <SubmitButton variant="outline" size="sm">
                              I passed on them
                            </SubmitButton>
                          </form>
                        </>
                      )}
                      {posting.offerReceivedAt && (
                        <Button nativeButton={false} render={<Link href="/dashboard/got-hired" />} size="sm">
                          Offer Accepted
                        </Button>
                      )}
                    </div>
                  )}

                  {posting.fitScore !== null && !posting.appliedAt && (
                    <p className="text-xs text-muted-foreground">
                      Mark it Applied once you&apos;ve submitted your application to unlock
                      interview prep.
                    </p>
                  )}

                  {posting.coverLetterError && (
                    <p className="text-sm text-destructive">{posting.coverLetterError}</p>
                  )}

                  {posting.coverLetter && (
                    <details className="rounded-md border border-border p-3">
                      <summary className="cursor-pointer text-sm font-medium">Cover letter</summary>
                      <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                        {posting.coverLetter}
                      </p>
                    </details>
                  )}

                  {posting.interviewLandedAt && (
                    <div className="space-y-2 rounded-md border border-border p-3">
                      <p className="text-sm font-medium">Interview prep</p>
                      {posting.interviewPrepError && (
                        <p className="text-sm text-destructive">{posting.interviewPrepError}</p>
                      )}
                      {posting.interviewPrep && (
                        <div className="space-y-2 text-sm text-muted-foreground">
                          <div>
                            <p className="font-medium text-foreground">Likely questions</p>
                            <ul className="list-disc space-y-1 pl-5">
                              {(posting.interviewPrep as unknown as InterviewPrep).likelyQuestions.map((q, i) => (
                                <li key={i}>{q}</li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <p className="font-medium text-foreground">Talking points</p>
                            <ul className="list-disc space-y-1 pl-5">
                              {(posting.interviewPrep as unknown as InterviewPrep).talkingPoints.map((p, i) => (
                                <li key={i}>{p}</li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <p className="font-medium text-foreground">Questions to ask them</p>
                            <ul className="list-disc space-y-1 pl-5">
                              {(posting.interviewPrep as unknown as InterviewPrep).questionsToAsk.map((q, i) => (
                                <li key={i}>{q}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      )}
                      {!posting.interviewCompleteAt && (
                        <form action={markInterviewComplete.bind(null, posting.id)} className="pt-1">
                          <SubmitButton variant="outline" size="sm">
                            Interview complete
                          </SubmitButton>
                        </form>
                      )}
                    </div>
                  )}

                  {posting.interviewCompleteAt && (
                    <ThankYouNoteCard
                      jobPostingId={posting.id}
                      note={posting.thankYouNote}
                      error={posting.thankYouError}
                      sentAt={posting.thankYouSentAt}
                    />
                  )}

                  {posting.offerReceivedAt && (
                    <div className="space-y-2 rounded-md border border-border p-3">
                      <p className="text-sm font-medium">Negotiation advice</p>
                      {posting.negotiationAdviceError && (
                        <p className="text-sm text-destructive">{posting.negotiationAdviceError}</p>
                      )}
                      {posting.negotiationAdvice && (
                        <div className="space-y-2 text-sm text-muted-foreground">
                          <div>
                            <p className="font-medium text-foreground">Opening script</p>
                            <p>{(posting.negotiationAdvice as unknown as NegotiationAdvice).scriptOpening}</p>
                          </div>
                          <div>
                            <p className="font-medium text-foreground">Talking points</p>
                            <ul className="list-disc space-y-1 pl-5">
                              {(posting.negotiationAdvice as unknown as NegotiationAdvice).talkingPoints.map((p, i) => (
                                <li key={i}>{p}</li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <p className="font-medium text-foreground">Also consider</p>
                            <ul className="list-disc space-y-1 pl-5">
                              {(posting.negotiationAdvice as unknown as NegotiationAdvice).considerations.map((c, i) => (
                                <li key={i}>{c}</li>
                              ))}
                            </ul>
                          </div>
                          <NegotiationPracticeTab jobPostingId={posting.id} />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </details>
              )
            })}
            </ShowMoreList>

            <details>
              <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-foreground">
                Add a job manually (paste a URL for fit-check + cover letter tools)
              </summary>
              <div className="space-y-3 px-4 pb-4">
                {atCap ? (
                  <p className="text-sm text-muted-foreground">
                    You have 5 job postings tracked — remove one below to add another.
                  </p>
                ) : (
                  <JobUrlForm />
                )}
              </div>
            </details>
          </div>
        )}
        {profile.jobPostings.length === 0 && (
          <details className="rounded-lg border border-border p-3 text-sm">
            <summary className="cursor-pointer font-medium text-foreground">
              Add a job manually (paste a URL for fit-check + cover letter tools)
            </summary>
            <div className="mt-3 space-y-3">
              <JobUrlForm />
            </div>
          </details>
        )}
      </div>

      <div id="company-tracker" className="scroll-mt-4 space-y-4 border-t border-border pt-8">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Company Tracker</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Name companies you&apos;d actually want to work for and watch for openings there,
            instead of only reacting to what&apos;s already posted. Adding companies also helps us
            tailor recommendations and train our matching system to understand what you&apos;re
            looking for.
          </p>
        </div>

        <Card>
          <CardContent className="space-y-4 pt-6">
            <CompanyWatchlistForm />
            <CompanyWatchlist entries={watchlistView} />
          </CardContent>
        </Card>
      </div>

      <GuideCallout pageSlot="find-my-job" currentJobStatus={profile.currentJobStatus} />
    </div>
  )
}
