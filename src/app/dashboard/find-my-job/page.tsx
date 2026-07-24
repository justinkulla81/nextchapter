import Link from 'next/link'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { prisma } from '@/lib/prisma'
import { surfaceNewJobs } from '@/lib/network/job-discovery'
import { JobUrlForm } from '@/components/dashboard/JobUrlForm'
import { JobPostingTextFallback } from '@/components/dashboard/JobPostingTextFallback'
import { NextSurfacedJobCard } from '@/components/dashboard/NextSurfacedJobCard'
import { InterestedJobsList } from '@/components/dashboard/InterestedJobsList'
import { JobReactionSummary } from '@/components/dashboard/JobReactionSummary'
import { DiscoverJobCard, LockedDiscoverJobCard } from '@/components/dashboard/DiscoverJobCard'
import {
  deleteJobPosting,
  retryJobFetch,
  markApplied,
  markInterviewLanded,
  markOfferReceived,
  generateCoverLetterAction,
  prepForPhoneScreen,
  markInterviewComplete,
} from './actions'
import { ThankYouNoteCard } from '@/components/dashboard/ThankYouNoteCard'
import { MarkAppliedForm } from '@/components/dashboard/MarkAppliedForm'
import { ConversionDiagnosticCard } from '@/components/dashboard/ConversionDiagnosticCard'
import { JobBoardRecommendations } from '@/components/dashboard/JobBoardRecommendations'
import { JobBoardUsageCheckIn } from '@/components/dashboard/JobBoardUsageCheckIn'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { SubmitButton } from '@/components/ui/submit-button'
import { scoreToGrade, GRADE_LABEL } from '@/lib/scoring/grade'
import { computeHireabilityGrade, type CandidateWithGradeRelations } from '@/lib/scoring/hireability-grade'
import { MAX_ACTIVE_FIT_CHECK_SLOTS } from '@/lib/constants/job-milestones'
import { computeBoardListingFitBucket, computeSurfacedJobFitBucket } from '@/lib/jobs/job-fit-bucket'

const SURFACED_JOB_LIST_SIZE = 5

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
  const activeCount = profile.jobPostings.filter(
    (j) => j.interviewLandedAt === null && j.offerReceivedAt === null
  ).length
  const atCap = activeCount >= MAX_ACTIVE_FIT_CHECK_SLOTS

  // Auto-backfill the surfaced-job queue server-side so the list always
  // stays topped up at SURFACED_JOB_LIST_SIZE — reacting to one immediately
  // makes room for a fresh one rather than shrinking the list.
  const unreactedCount = await prisma.surfacedJob.count({
    where: { candidateId: profile.id, reaction: null },
  })
  if (unreactedCount < SURFACED_JOB_LIST_SIZE) {
    await surfaceNewJobs(profile.id)
  }

  const [surfacedJobs, interestedJobs, reactedCount, grade, boardPostings] = await Promise.all([
    prisma.surfacedJob.findMany({
      where: { candidateId: profile.id, reaction: null },
      orderBy: { surfacedAt: 'desc' },
      take: SURFACED_JOB_LIST_SIZE,
    }),
    prisma.surfacedJob.findMany({
      where: { candidateId: profile.id, reaction: 'INTERESTED' },
      orderBy: { reactedAt: 'desc' },
    }),
    prisma.surfacedJob.count({
      where: { candidateId: profile.id, reaction: { not: null } },
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
  const openBoardPostings = boardPostings.filter(
    (p) => p.audienceTier === 'ALL_CANDIDATES' || isAList
  )
  const lockedBoardPostings = boardPostings.filter(
    (p) => p.audienceTier === 'A_LIST_ONLY' && !isAList
  )
  // A Targeted listing is only shown to candidates who actually fit it —
  // an Open one is shown to everyone regardless of fit (the bucket badge
  // still tells them how good a match it is).
  const visibleBoardPostings = openBoardPostings.filter((p) => {
    if (p.distribution !== 'TARGETED') return true
    return computeBoardListingFitBucket(profile, p) !== 'stretch'
  })

  const ratedCount = profile.jobPostings.length + reactedCount
  const appliedJobPostings = profile.jobPostings
    .filter((j) => j.appliedAt !== null)
    .sort((a, b) => (b.appliedAt?.getTime() ?? 0) - (a.appliedAt?.getTime() ?? 0))

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Jobs</h1>
        <p className="mt-1 text-muted-foreground">
          Discover real openings — from our job board and our automated search partners —
          and track every application through offer.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Rating jobs and applying counts toward your grade&apos;s weekly effort.
        </p>
        <p className="mt-1 text-sm font-medium text-muted-foreground tabular-nums">
          {ratedCount} job{ratedCount === 1 ? '' : 's'} rated so far
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Discover</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Real openings from our job board, plus roles our automated search partners
            found for you — no grade required to see these.
          </p>
        </div>

        {visibleBoardPostings.length === 0 && lockedBoardPostings.length === 0 && surfacedJobs.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No jobs surfaced yet — set a target role in your Goals to get started.
          </p>
        ) : (
          <div className="space-y-3">
            {visibleBoardPostings.map((posting) => (
              <DiscoverJobCard key={posting.id} posting={posting} fitBucket={computeBoardListingFitBucket(profile, posting)} />
            ))}
            {lockedBoardPostings.map((posting) => (
              <LockedDiscoverJobCard key={posting.id} posting={posting} />
            ))}
            {surfacedJobs.map((job) => (
              <NextSurfacedJobCard key={job.id} job={job} fitBucket={computeSurfacedJobFitBucket(profile, job)} />
            ))}
          </div>
        )}

        <JobReactionSummary ratedCount={ratedCount} />
        <InterestedJobsList jobs={interestedJobs} />

        <details className="rounded-lg border border-border p-3 text-sm text-muted-foreground">
          <summary className="cursor-pointer font-medium text-foreground">More places to look</summary>
          <div className="mt-3 space-y-4">
            <JobBoardRecommendations targetIndustries={profile.targetIndustries} />
            <JobBoardUsageCheckIn currentUsage={(profile.jobBoardUsage as Record<string, string> | null) ?? null} />
          </div>
        </details>
      </div>

      <div className="space-y-4 border-t border-border pt-8">
        <h2 className="text-lg font-semibold tracking-tight">My Applications</h2>
        {atCap ? (
          <p className="text-sm text-muted-foreground">
            You have 5 job postings tracked — remove one below to add another.
          </p>
        ) : (
          <JobUrlForm />
        )}

        <ConversionDiagnosticCard jobPostings={profile.jobPostings} />

        {profile.jobPostings.length > 0 && (
          <div className="space-y-4">
            {profile.jobPostings.map((posting) => (
              <Card key={posting.id}>
                <CardContent className="space-y-3 pt-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <a
                        href={posting.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary underline underline-offset-4"
                      >
                        {posting.url}
                      </a>
                      <p className="text-sm text-muted-foreground">
                        {STATUS_LABELS[posting.fetchStatus] ?? posting.fetchStatus}
                      </p>
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

                  {posting.fitScore !== null && (
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
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {appliedJobPostings.length > 0 && (
        <div className="space-y-2 border-t border-border pt-8">
          <h2 className="text-sm font-medium text-muted-foreground">
            Applied jobs ({appliedJobPostings.length})
          </h2>
          <div className="divide-y divide-border rounded-md border border-border">
            {appliedJobPostings.map((posting) => {
              let hostname = posting.url
              try {
                hostname = new URL(posting.url).hostname
              } catch {
                // Keep the raw value if the URL somehow doesn't parse.
              }
              const stage = posting.offerReceivedAt
                ? 'Offer received'
                : posting.interviewLandedAt
                  ? 'Interview'
                  : 'Applied'
              return (
                <div key={posting.id} className="px-3 py-1.5 text-xs">
                  <div className="flex items-center justify-between gap-3">
                    <a
                      href={posting.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="truncate text-primary hover:underline"
                    >
                      {hostname}
                    </a>
                    <div className="flex shrink-0 items-center gap-3 text-muted-foreground">
                      <span>{stage}</span>
                      <span className="tabular-nums">{posting.appliedAt?.toLocaleDateString()}</span>
                    </div>
                  </div>
                  {posting.coverLetter && (
                    <details className="mt-0.5">
                      <summary className="cursor-pointer text-muted-foreground">Cover letter</summary>
                      <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{posting.coverLetter}</p>
                    </details>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
