import type { Metadata } from 'next'
import { Suspense } from 'react'
import { after } from 'next/server'
import Link from 'next/link'
import { Globe, FileText, Users, Sparkles } from 'lucide-react'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { prisma } from '@/lib/prisma'
import { surfaceNewJobs } from '@/lib/network/job-discovery'
import { getWatchlistView } from '@/lib/company-tracker/watchlist'
import { FIT_BUCKET_LABEL, isWeakFit } from '@/lib/jobs/fit-bucket-types'
import { fitScoreToLabel, type FitScoreLabel } from '@/lib/jobs/fit-score-label'
import { cn } from '@/lib/utils'
import { CompanyWatchlistForm } from '@/components/dashboard/CompanyWatchlistForm'
import { CompanyWatchlist } from '@/components/dashboard/CompanyWatchlistList'
import { MarkWatchlistViewedOnMount } from '@/components/dashboard/MarkWatchlistViewedOnMount'
import { EmailSyncWatcher } from '@/components/dashboard/EmailSyncWatcher'
import { EmailActivitySyncButton } from '@/components/dashboard/EmailActivityControls'
import { JobDetailsEditor } from '@/components/dashboard/JobDetailsEditor'
import { ResumeBookOptInForm } from '@/components/dashboard/ResumeBookOptInForm'
import { RecruiterVisibilityOptInForm } from '@/components/dashboard/RecruiterVisibilityOptInForm'
import { JobUrlForm } from '@/components/dashboard/JobUrlForm'
import { InterviewJobPicker } from '@/components/dashboard/InterviewJobPicker'
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
import { GENERAL_JOB_BOARDS, getIndustryJobBoards } from '@/lib/constants/industry-job-boards'
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
import { syncGmailConnection } from '@/lib/email-tracking/sync-gmail'
import { Button } from '@/components/ui/button'
import { SubmitButton } from '@/components/ui/submit-button'
import { type Grade } from '@/lib/scoring/grade'
import { Spinner } from '@/components/ui/spinner'
import { computeHireabilityGrade, type CandidateWithGradeRelations } from '@/lib/scoring/hireability-grade'
import { MAX_ACTIVE_FIT_CHECK_SLOTS } from '@/lib/constants/job-milestones'
import { computeBoardListingFitBucket, computeSurfacedJobFitBucket } from '@/lib/jobs/job-fit-bucket'
import { PageHeaderBoxes } from '@/components/dashboard/PageHeaderBoxes'
import { GuideCallout } from '@/components/dashboard/GuideCallout'
import { resolveCompanySizeBand } from '@/lib/market/company-size'
import { normalizeOrgName, orgNamesMatch } from '@/lib/text/org-name-match'
import { getMondayOfWeek } from '@/lib/weekly/sprint'

export const metadata: Metadata = { title: 'Find a Full-time Job' }

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

const FIT_SCORE_BADGE_CLASS: Record<FitScoreLabel, string> = {
  'Perfect Fit': 'bg-success/10 text-success',
  'Strong Fit': 'bg-success/10 text-success',
  'Good Fit': 'bg-muted text-muted-foreground',
  'Poor Fit': 'bg-destructive/10 text-destructive',
}

const FIT_SCORE_TEXT_CLASS: Record<FitScoreLabel, string> = {
  'Perfect Fit': 'text-success',
  'Strong Fit': 'text-success',
  'Good Fit': 'text-foreground',
  'Poor Fit': 'text-destructive',
}

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

function JobRecommendationsSkeleton() {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border p-6 text-sm text-muted-foreground">
      <Spinner size={16} />
      Finding jobs that fit you…
    </div>
  )
}

// Carries the two heaviest calls on this page — surfaceNewJobs (a
// sequential external job-board API waterfall) and resolveCompanySizeBand
// (a live LLM call for any company name seen here for the first time) — in
// its own Suspense boundary so the rest of the page (stats, Interview
// Tracking, Application Tracker, Company Tracker) never blocks on them.
async function JobRecommendationsSection({
  profile,
  isAList,
  gradeLetter,
  boardPostings,
  contacts,
}: {
  profile: Awaited<ReturnType<typeof getDashboardData>>
  isAList: boolean
  gradeLetter: Grade
  boardPostings: Awaited<ReturnType<typeof prisma.exclusiveJobPosting.findMany>>
  contacts: {
    id: string
    name: string
    company: string | null
    inferredCompany: string | null
    email: string | null
    linkedinUrl: string | null
  }[]
}) {
  const worksHereFor = (companyName: string | null) => {
    if (!companyName) return []
    return contacts
      .filter(
        (c) =>
          (c.company && orgNamesMatch(c.company, companyName)) ||
          (c.inferredCompany && orgNamesMatch(c.inferredCompany, companyName))
      )
      .map((c) => ({ id: c.id, name: c.name, email: c.email, linkedinUrl: c.linkedinUrl }))
  }
  // Auto-backfill the surfaced-job queue server-side so the list always
  // stays topped up at SURFACED_JOB_LIST_SIZE — reacting to one immediately
  // makes room for a fresh one rather than shrinking the list.
  const unreactedCount = await prisma.surfacedJob.count({
    where: { candidateId: profile.id, reaction: null },
  })
  if (unreactedCount < SURFACED_JOB_POOL_TARGET) {
    await surfaceNewJobs(profile.id, SURFACED_JOB_POOL_TARGET - unreactedCount)
  }

  const [surfacedJobs, totalUnreactedCount, interestedJobs] = await Promise.all([
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
  ])

  // Free candidates only ever see the first SURFACED_JOB_FREE_PREVIEW
  // matches — the rest stay locked until an A grade, folded into the same
  // unlock count as the locked job-board postings below so there's one
  // combined "unlock at an A grade" number for the whole Discover list.
  const visibleSurfacedJobs = isAList ? surfacedJobs : surfacedJobs.slice(0, SURFACED_JOB_FREE_PREVIEW)
  const lockedSurfacedCount = isAList ? 0 : Math.max(0, totalUnreactedCount - visibleSurfacedJobs.length)
  const openBoardPostings = boardPostings.filter((p) => p.audienceTier === 'ALL_CANDIDATES' || isAList)
  const lockedBoardPostings = boardPostings.filter((p) => p.audienceTier === 'A_LIST_ONLY' && !isAList)

  // computeBoardListingFitBucket/computeSurfacedJobFitBucket are synchronous
  // (called inline in the JSX below), but resolveCompanySizeBand isn't —
  // resolve every distinct company name shown in this section once, up
  // front, into a normalizeOrgName-keyed map so each card looks its band up
  // synchronously instead of awaiting per-card.
  const companyNames = [...openBoardPostings.map((p) => p.companyName), ...surfacedJobs.map((j) => j.companyName)].filter(
    (name): name is string => !!name
  )
  const distinctCompanyNames = [...new Set(companyNames)]
  const resolvedBands = await Promise.all(distinctCompanyNames.map((name) => resolveCompanySizeBand(name)))
  const companySizeBandByName = new Map(
    distinctCompanyNames.map((name, i) => [normalizeOrgName(name), resolvedBands[i].band])
  )
  const companySizeBandFor = (companyName: string | null) =>
    companyName ? (companySizeBandByName.get(normalizeOrgName(companyName)) ?? null) : null

  // A Targeted listing is only shown to candidates who actually fit it —
  // an Open one is shown to everyone regardless of fit (the bucket badge
  // still tells them how good a match it is).
  const visibleBoardPostings = openBoardPostings.filter((p) => {
    if (p.distribution !== 'TARGETED') return true
    return !isWeakFit(computeBoardListingFitBucket(profile, p, companySizeBandFor(p.companyName)))
  })

  return (
    <div className="space-y-4">
      {visibleBoardPostings.length === 0 && lockedBoardPostings.length === 0 && surfacedJobs.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No jobs surfaced yet — set a target role in your Goals to get started.
        </p>
      ) : (
        <div className="space-y-3">
          {surfacedJobs.length > 0 && (
            <p className="text-xs font-medium text-muted-foreground">
              Showing {visibleSurfacedJobs.length} of {totalUnreactedCount} match
              {totalUnreactedCount === 1 ? '' : 'es'} from your automated search partners
            </p>
          )}

          <div className="space-y-3">
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
                worksHereContacts={worksHereFor(job.companyName)}
              />
            ))}
          </div>

          {(lockedBoardPostings.length > 0 || lockedSurfacedCount > 0) && (
            <>
              <UnlockAListCallout
                grade={gradeLetter}
                lockedCount={lockedBoardPostings.length + lockedSurfacedCount + boardPostings.length}
              />

              <div className="space-y-3">
                {lockedBoardPostings.slice(0, LOCKED_PREVIEW_COUNT).map((posting) => (
                  <LockedDiscoverJobCard key={posting.id} posting={posting} />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      <InterestedJobsList jobs={interestedJobs} />
    </div>
  )
}

export default async function JobFitPage() {
  const profile = await getDashboardData()

  return (
    <div className="space-y-10">
      <MarkWatchlistViewedOnMount />
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight">Find a Full-time Job</h1>
        <PageHeaderBoxes pageKey="find-my-job" candidateId={profile.id} />
      </div>

      <Suspense fallback={<FindMyJobBodySkeleton />}>
        <FindMyJobBody profile={profile} />
      </Suspense>
    </div>
  )
}

function FindMyJobBodySkeleton() {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border p-6 text-sm text-muted-foreground">
      <Spinner size={16} />
      Loading your job search…
    </div>
  )
}

// Carries the Gmail sync (a live external API call, throttled to once per 5
// minutes but still a real network round trip on the un-throttled path) plus
// every section whose data depends on its freshly-synced jobPostings —
// stats, Interview Tracking, and the Application Tracker — in its own
// Suspense boundary so the page header above renders immediately instead of
// blocking on this every single visit.
async function FindMyJobBody({
  profile,
}: {
  profile: Awaited<ReturnType<typeof getDashboardData>>
}) {
  // Job-application-related email activity (confirmations, recruiter
  // outreach, interview invites, rejections, offers) — auto-detected via
  // the same Gmail connection managed on the Network with My Contacts page.
  // Networking-shaped sent mail stays there; this page only shows the
  // job-outcome side of that same synced inbox.
  //
  // Backgrounded via after() rather than awaited — a heavy inbox (thousands
  // of messages) can make a real Gmail sync take long enough that awaiting
  // it here left the ENTIRE rest of this page (Interview Tracking, the
  // Application Tracker, thank-you notes, everything) stuck behind this
  // component's Suspense fallback for the whole wait, which read as "the
  // page is broken/empty" rather than "still loading." The tradeoff: a job
  // application landing via Gmail in just the last moment might not show up
  // until the *next* page load instead of this one — the same
  // stale-while-revalidate tradeoff already accepted everywhere else in
  // this app's slow-load fixes, and a far smaller cost than the whole page
  // appearing to vanish.
  const emailConnection = await prisma.emailConnection.findFirst({
    where: { candidateId: profile.id, disconnectedAt: null },
  })
  if (emailConnection) {
    after(() =>
      syncGmailConnection(emailConnection.id).catch((error) => console.error('Email auto-sync failed:', error))
    )
  }
  const jobPostings = profile.jobPostings
  const preSyncLastSyncAt = emailConnection?.lastSyncAt?.toISOString() ?? null

  // EMAIL_DETECTED rows don't consume a fit-check slot — they were never
  // analyzed, so they shouldn't block adding a URL-based one.
  const activeCount = jobPostings.filter(
    (j) => j.source !== 'EMAIL_DETECTED' && j.interviewLandedAt === null && j.offerReceivedAt === null
  ).length
  const atCap = activeCount >= MAX_ACTIVE_FIT_CHECK_SLOTS

  // The two heaviest calls on this page — surfaceNewJobs (a sequential
  // external job-board API waterfall) and resolveCompanySizeBand (a live
  // LLM call for any company name seen for the first time) — both live
  // entirely inside JobRecommendationsSection below now, wrapped in
  // Suspense, so the rest of the page never blocks on them.
  const [grade, boardPostings] = await Promise.all([
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
  // Needs isAList to decide which A_LIST_ONLY postings this candidate can
  // actually open — can't join the barrier above since grade isn't known
  // until it resolves.
  const watchlistView = await getWatchlistView(profile.id, isAList)

  // Scoped to just the companies already-applied-to postings mention — the
  // separate, larger set of companies from board/surfaced listings is
  // resolved independently inside JobRecommendationsSection so that slower
  // lookup never blocks this page's main render.
  const appliedCompanyNames = [...new Set(jobPostings.map((j) => j.companyName).filter((n): n is string => !!n))]
  const appliedCompanyBands = await Promise.all(appliedCompanyNames.map((name) => resolveCompanySizeBand(name)))
  const companySizeBandByName = new Map(
    appliedCompanyNames.map((name, i) => [normalizeOrgName(name), appliedCompanyBands[i].band])
  )
  const companySizeBandFor = (companyName: string | null) =>
    companyName ? (companySizeBandByName.get(normalizeOrgName(companyName)) ?? null) : null

  // "Who can help with this one?" — contacts already manually linked to a
  // specific application, plus company-matched suggestions from the
  // candidate's own network list they haven't linked yet.
  const [contacts, jobsWithHelpfulContacts] = await Promise.all([
    prisma.supportNetworkContact.findMany({
      where: { candidateId: profile.id, OR: [{ company: { not: null } }, { inferredCompany: { not: null } }] },
      select: { id: true, name: true, company: true, inferredCompany: true, email: true, linkedinUrl: true },
    }),
    prisma.jobPosting.findMany({
      where: { candidateId: profile.id },
      select: { id: true, helpfulContacts: { select: { id: true, name: true, email: true, linkedinUrl: true } } },
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
      .map((c) => ({ id: c.id, name: c.name, email: c.email, linkedinUrl: c.linkedinUrl }))
    return { linkedContacts, suggestedContacts }
  }

  // Every posting with appliedAt set is "My Applications", regardless of
  // whether it was pasted in manually or auto-detected from email.
  const allApplications = jobPostings
    .filter((j) => j.appliedAt !== null)
    .sort((a, b) => (b.appliedAt?.getTime() ?? 0) - (a.appliedAt?.getTime() ?? 0))
  const weekStart = getMondayOfWeek(new Date())
  const applicationsThisWeek = allApplications.filter((j) => j.appliedAt! >= weekStart).length

  // Interview Tracking section — a top-level rollup of everything already
  // marked interviewLandedAt, so a candidate doesn't have to dig into a
  // collapsed application card to see where they stand or jump to prep.
  const interviewingPostings = jobPostings
    .filter((j) => j.interviewLandedAt !== null)
    .sort((a, b) => b.interviewLandedAt!.getTime() - a.interviewLandedAt!.getTime())
  // Postings a candidate could plausibly say "I have an interview for this"
  // about — already applied (or an email-detected row, which is assumed
  // applied) and not already interviewing/declined/offered.
  const eligibleForInterview = jobPostings.filter(
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

  // Apply to New Jobs section — general + industry-tailored job boards.
  // Applying/reacting/tracking now show for real in the Action Plan box
  // itself (see PAGE_ACTION_TYPES + AUTO_DETECTED_ACTION_TYPES in
  // action-effort.ts) rather than being duplicated as a static list here.
  const industryBoards = getIndustryJobBoards(profile.targetIndustries)

  return (
    <>
      {emailConnection && <EmailSyncWatcher initialLastSyncAt={preSyncLastSyncAt} />}
      <ReconnectBanner candidateId={profile.id} />
      <GoogleConnectPrompt candidateId={profile.id} email={profile.email} />

      {emailConnection && !emailConnection.needsReconnectAt && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
          <p>
            Job stats from email
            {emailConnection.lastSyncAt && <> · last checked {emailConnection.lastSyncAt.toLocaleString()}</>}
          </p>
          <EmailActivitySyncButton />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-border p-3">
          <p className="text-2xl font-bold text-foreground tabular-nums">
            {allApplications.length}
            <span className="ml-1.5 text-sm font-normal text-muted-foreground">
              ({applicationsThisWeek} job{applicationsThisWeek === 1 ? '' : 's'} this week)
            </span>
          </p>
          <p className="text-xs text-muted-foreground">Applications sent</p>
        </div>
        {Object.entries(JOB_EMAIL_LABEL).map(([type, label]) => (
          <NetworkStatTile key={type} label={label} items={jobStatTileItems[type] ?? []} />
        ))}
        <NetworkStatTile label="Resumes shared" items={resumesSharedItems.map(jobEmailItem)} />
      </div>

      <div id="apply-new-jobs" className="scroll-mt-4 space-y-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Apply to New Jobs</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Search broadly, then check the boards tailored to you below — then come back and log
            what you applied to.
          </p>
        </div>

        <div className="divide-y divide-border rounded-lg border border-border bg-card">
          <div className="p-4">
            <div className="flex items-center gap-2.5">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
                <Globe className="size-3.5" aria-hidden />
              </span>
              <p className="text-sm font-semibold text-foreground">Job Boards</p>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              A strong application to a live posting is real signal too — do this alongside networking, not instead of it.
            </p>
            <div className="mt-3">
              <JobBoardLinkList boards={[...GENERAL_JOB_BOARDS, ...industryBoards]} category="general" />
            </div>
          </div>

          <div className="p-4">
            <div className="flex items-center gap-2.5">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-success/10 text-success">
                <FileText className="size-3.5" aria-hidden />
              </span>
              <p className="text-sm font-semibold text-foreground">Resume Book</p>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Recruiters and hiring managers browsing by role can find your resume here.
            </p>
            <div className="mt-3">
              <ResumeBookOptInForm optedIn={profile.resumeBookOptIn} />
            </div>
          </div>

          <div className="p-4">
            <div className="flex items-center gap-2.5">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-light-blue/10 text-light-blue">
                <Users className="size-3.5" aria-hidden />
              </span>
              <p className="text-sm font-semibold text-foreground">Executive Recruiters</p>
            </div>
            {isAList && profile.recruiterDatabaseOptIn ? (
              <p className="mt-1 text-xs text-muted-foreground">You&apos;re an A — recruiters can already find you.</p>
            ) : (
              <>
                <p className="mt-1 text-xs text-muted-foreground">
                  Recruiters can find and reach out to you directly once you hit an A grade — opt in any time so you&apos;re ready.
                </p>
                <div className="mt-3">
                  <RecruiterVisibilityOptInForm optedIn={profile.recruiterDatabaseOptIn} />
                </div>
              </>
            )}
          </div>

          <div id="job-recommendations" className="scroll-mt-4 p-4">
            <div className="flex items-center gap-2.5">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-orange/15 text-orange">
                <Sparkles className="size-3.5" aria-hidden />
              </span>
              <p className="text-sm font-semibold text-foreground">Job Recommendations For You</p>
            </div>
            <div className="mt-3">
              <Suspense fallback={<JobRecommendationsSkeleton />}>
                <JobRecommendationsSection
                  profile={profile}
                  isAList={isAList}
                  gradeLetter={grade.grade}
                  boardPostings={boardPostings}
                  contacts={contacts}
                />
              </Suspense>
            </div>
          </div>
        </div>
      </div>

      <div id="jobs-applied" className="scroll-mt-4 space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">Application Tracker</h2>

        <ConversionDiagnosticCard jobPostings={jobPostings} />

        <div className="space-y-6 rounded-lg border border-border bg-card p-4">
        {jobPostings.length > 0 && (
          <div className="space-y-3">
            <p className="px-1 text-sm font-medium text-muted-foreground">
              {jobPostings.length} application{jobPostings.length === 1 ? '' : 's'}
            </p>
            <div className="divide-y divide-border rounded-md border border-border">
            <ShowMoreList initialCount={10} totalCount={jobPostings.length}>
            {jobPostings.map((posting) => {
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
                const helpInfo = whoCanHelpFor(posting.id, posting.companyName)
                const helperNames = [...helpInfo.linkedContacts, ...helpInfo.suggestedContacts].map((c) => c.name)
                return (
                  <details key={posting.id}>
                    <summary className="flex cursor-pointer list-none items-start justify-between gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {posting.title || posting.companyName || 'Unknown role'}
                        </p>
                        <p className="truncate text-sm text-muted-foreground">
                          {posting.title && posting.companyName ? `${posting.companyName} — ` : ''}
                          {status} · {posting.appliedAt?.toLocaleDateString()}
                        </p>
                        {helperNames.length > 0 && (
                          <p className="truncate text-sm font-medium text-brand">
                            Who can help: {helperNames.join(', ')}
                          </p>
                        )}
                      </div>
                    </summary>
                    <div className="space-y-3 px-4 pb-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-0.5">
                          {fitBucket && (
                            <span className="inline-block rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                              {FIT_BUCKET_LABEL[fitBucket]}
                            </span>
                          )}
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
                      <WhoCanHelpSection {...helpInfo} jobId={posting.id} />
                      <JobDetailsEditor
                        initialTitle={posting.title}
                        initialUrl={posting.url}
                        companyName={posting.companyName}
                        action={updateApplicationDetails.bind(null, posting.id)}
                      />
                    </div>
                  </details>
                )
              }

              const helpInfo = whoCanHelpFor(posting.id, posting.companyName)
              const helperNames = [...helpInfo.linkedContacts, ...helpInfo.suggestedContacts].map((c) => c.name)
              return (
              <details key={posting.id}>
                <summary className="flex cursor-pointer list-none items-start justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {posting.title || posting.companyName || posting.url}
                    </p>
                    <p className="truncate text-sm text-muted-foreground">
                      {posting.title && posting.companyName ? `${posting.companyName} — ` : ''}
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
                    </p>
                    {helperNames.length > 0 && (
                      <p className="truncate text-sm font-medium text-brand">
                        Who can help: {helperNames.join(', ')}
                      </p>
                    )}
                  </div>
                </summary>
                <div className="space-y-3 px-4 pb-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      {posting.fitScore !== null && (
                        <span
                          className={cn(
                            'inline-block rounded-full px-2 py-0.5 text-xs font-medium',
                            FIT_SCORE_BADGE_CLASS[fitScoreToLabel(posting.fitScore)]
                          )}
                        >
                          {fitScoreToLabel(posting.fitScore)}
                        </span>
                      )}
                      <a
                        href={posting.url ?? '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block text-sm text-primary underline underline-offset-4"
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

                  <WhoCanHelpSection {...helpInfo} jobId={posting.id} />

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
                      <p className={cn('text-sm font-medium', FIT_SCORE_TEXT_CLASS[fitScoreToLabel(posting.fitScore)])}>
                        {fitScoreToLabel(posting.fitScore)}
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
            </div>

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
        {jobPostings.length === 0 && (
          <details className="rounded-lg border border-border p-3 text-sm">
            <summary className="cursor-pointer font-medium text-foreground">
              Add a job manually (paste a URL for fit-check + cover letter tools)
            </summary>
            <div className="mt-3 space-y-3">
              <JobUrlForm />
            </div>
          </details>
        )}

        <div id="interview-tracking" className="scroll-mt-4 space-y-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Interview Tracker</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Every interview you&apos;ve landed, in one place — plus a fast way to log a new one
              and jump straight to prep.
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

          <div className="space-y-3">
            <p className="text-sm font-medium text-foreground">Got an interview?</p>

            <InterviewJobPicker
              eligibleForInterview={eligibleForInterview}
              atCap={atCap}
              markInterviewLandedFromForm={markInterviewLandedFromForm}
              addInterviewJob={addInterviewJob}
            />

            <Link
              href="/dashboard/interview-prep"
              className="block text-sm font-medium text-primary underline underline-offset-4"
            >
              Just want interview prep, no specific job? →
            </Link>
          </div>
        </div>
        </div>
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

      <div id="find-through-network" className="scroll-mt-4 space-y-4 border-t border-border pt-8">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Find Jobs Through Network</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Most roles are filled through a referral before they&apos;re ever posted — the people
            who already know you are your fastest path to hearing about one. Adding contacts and
            reaching out counts here, whether or not it turns into a specific job lead.
          </p>
        </div>
        <Link
          href="/dashboard/network"
          className="inline-block text-sm font-medium text-primary underline underline-offset-4"
        >
          Start Networking →
        </Link>
      </div>

      <div id="add-contacts-for-matching" className="scroll-mt-4 space-y-4 border-t border-border pt-8">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Add Contacts to Spot Warm Intros</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Knowing someone inside is the single biggest way to stand out among hundreds of other
            applicants. Add people to your contact list with where they work, and we&apos;ll flag
            it automatically whenever a job you&apos;ve applied to or a recommendation matches
            their company.
          </p>
        </div>
        <Link
          href="/dashboard/network/contacts"
          className="inline-block text-sm font-medium text-primary underline underline-offset-4"
        >
          Add contacts →
        </Link>
      </div>

      <div id="mock-interview" className="scroll-mt-4 space-y-4 border-t border-border pt-8">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Complete a Mock Interview</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Practicing out loud before the real thing is what actually builds confidence — reading
            a good answer isn&apos;t the same as saying one. This is detected automatically the
            moment you answer a practice or tough interview question, not a box you check yourself.
          </p>
        </div>
        <Link
          href="/dashboard/interview-prep"
          className="inline-block text-sm font-medium text-primary underline underline-offset-4"
        >
          Go to Interview Prep →
        </Link>
      </div>

      <GuideCallout pageSlot="find-my-job" currentJobStatus={profile.currentJobStatus} />
    </>
  )
}
