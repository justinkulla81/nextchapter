import { timed } from '@/lib/perf/timed'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { after } from 'next/server'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { isDossierUnlocked } from '@/lib/scoring/dossier-unlock'
import { CandidatePlusExtraLine } from '@/components/jobs/CandidatePlusExtraLine'
import { loadPostingLifecycle } from '@/lib/jobs/past-jobs-data'
import { alternativesHrefs, lifecycleBadge, lifecycleSentence, postedLine } from '@/lib/jobs/job-status'
import { seniorityLabel } from '@/lib/jobs/job-seniority'
import { formatUsdK } from '@/lib/pay/market-pay'
import { ClosedJobAlternatives, SimilarLiveJobs } from '@/components/jobs/ClosedJobAlternatives'
import { similarLiveJobs } from '@/lib/jobs/similar-live-jobs'
import { ApplyOnEmployerSite, ClosedJobViewed } from '@/components/jobs/JobPageActions'
import { ApplyKit } from '@/components/jobs/ApplyKit'
import { NativeApply } from '@/components/jobs/NativeApply'
import { WhoToContactPanel } from '@/components/dashboard/WhoToContactPanel'
import { SentItPrompt } from '@/components/dashboard/SentItPrompt'
import { nativePosterOf } from '@/lib/jobs/native-apply'
import { cn } from '@/lib/utils'
import { checkRequirements, parseRequirementFlags, requirementMemberOf } from '@/lib/jobs/requirements'
import { JobRequirementDetails, JobRequirementLabels } from '@/components/dashboard/JobRequirementLabels'
import { loadJobPageView } from '@/lib/jobs/job-page-view'
import { FindJobDetail } from '@/components/dashboard/find/FindJobDetail'

// A board job's own page — what a saved link, a My jobs row or an email opens. It
// opens for past jobs too (read-only): a banner says when and why it closed, there
// is no apply button, and the next steps point at open jobs at the same company and
// with the same title (job-status.ts).

export const metadata: Metadata = { title: 'Job' }

const SOURCES = new Set(['my_jobs', 'email', 'job_search_daily', 'fresh_job_alert', 'saved_link', 'board', 'company', 'closed_on_click', 'public_page', 'check_fit', 'alert'])

export default async function JobPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ src?: string }> }) {
  const [{ id }, { src }] = await Promise.all([params, searchParams])
  const profile = await getDashboardData()
  // Slow steps (300 ms or more) report to PostHog as page_query_slow, route 'job_page' (src/lib/perf/timed.ts), so a slow open names its step.
  const step = <T,>(label: string, work: Promise<T>): Promise<T> => timed('job_page', label, profile.id, work)
  const [posting, tracked, dossier] = await Promise.all([
    step('posting', prisma.exclusiveJobPosting.findUnique({
      where: { id },
      select: {
        id: true, title: true, companyName: true, location: true, url: true, status: true, archivedAt: true, expiresAt: true, closeReason: true, distribution: true, disclosure: true,
        institutionScopeId: true, source: true, level: true, salaryMin: true, salaryMax: true, payPeriod: true,
        description: true, submittedByEmployerId: true, submittedByRecruiterId: true, company: { select: { canonicalNameNormalized: true } },
        requirementFlags: true, locationState: true, targetFunction: true, employerSector: true,
      },
    })),
    step('trackedJob', prisma.trackedJob.findFirst({ where: { candidateId: profile.id, source: 'job_board', sourceId: id }, select: { id: true } })),
    step('dossierUnlocked', isDossierUnlocked(profile.id)),
  ])
  // Only what the board would ever show a member (every member sees every board job;
  // privacy settings still hide one) — or a job they saved themselves.
  const visible =
    posting &&
    (tracked || (posting.status === 'approved' && !posting.institutionScopeId && posting.distribution !== 'EXCLUDED'))
  if (!posting || !visible) notFound()

  // A public job page (or "Check my fit") that opens a job the employer already took down goes straight to the open jobs
  // like it, not to a dead page. A job the member saved still opens, with its banner. Checked here, before the lifecycle load,
  // so the redirect costs no more than the posting read.
  const gone = posting.closeReason !== 'duplicate' && (!!posting.archivedAt || (!!posting.expiresAt && posting.expiresAt.getTime() <= Date.now()))
  if (gone && !tracked && (src === 'public_page' || src === 'check_fit')) {
    after(() => captureServerEvent(profile.id, 'closed_job_redirected', { source: src, jobId: posting.id, company: posting.companyName, title: posting.title }))
    redirect(alternativesHrefs(posting.disclosure === 'CONFIDENTIAL' ? null : posting.companyName, posting.title).title)
  }

  const life = await step('postingLifecycle', loadPostingLifecycle(posting.id))
  if (!life) notFound()

  // An open job opens as the same pane Find a job shows beside its
  // list: one headline, apply as the one action, three sections, everything else behind "More about this job".
  // A closed job keeps the page below, with its banner and the open jobs like it. If the member's fit cannot be
  // worked out, the page below is shown instead of an error.
  if (!life.isPast) {
    const full = await step('fullPosting', prisma.exclusiveJobPosting.findUnique({ where: { id: posting.id } }))
    const view = full ? await step('buildView', loadJobPageView(profile, full, dossier.unlocked)).catch((error) => {
      console.error('Job page view unavailable, showing the plain page:', error)
      return null
    }) : null
    if (view) {
      // Opened from a public job page (src/lib/jobs/portal-job-redirect.ts): one line says what saving does for the member.
      const fromPublic = src === 'public_page'
      if (fromPublic) {
        after(() => captureServerEvent(profile.id, 'job_carried_in', { source: 'public_page', jobId: posting.id, company: posting.companyName, title: posting.title, tracked: !!tracked }))
      }
      return (
        <div className="mx-auto max-w-3xl space-y-4">
          <p className="text-sm text-muted-foreground">
            <Link href="/dashboard/find-my-job" className="underline underline-offset-4">
              Back to jobs
            </Link>
            {fromPublic && ' · Save this job and we use it to tune the jobs we rank for you.'}
          </p>
          <FindJobDetail {...view} standalone />
        </div>
      )
    }
  }
  const source = src && SOURCES.has(src) ? src : 'direct'
  // Sent here by the click-time liveness check (jobs/[id]/open): the posting just died.
  const justClosed = life.isPast && source === 'closed_on_click'
  const similar = justClosed ? await similarLiveJobs(posting) : []
  const confidential = posting.disclosure === 'CONFIDENTIAL'
  const company = confidential ? 'Confidential company' : posting.companyName
  const yearly = !posting.payPeriod || posting.payPeriod === 'year'
  const pay = yearly && posting.salaryMin && posting.salaryMax ? `${formatUsdK(posting.salaryMin)}–${formatUsdK(posting.salaryMax)} posted` : null
  const sentence = lifecycleSentence(life)
  // Posted directly on NextChapter by an employer or recruiter: apply here, to their inbox.
  const native = !!nativePosterOf(posting)
  // Hard requirements the posting states, against what the member told us (requirements.ts).
  const requirements = checkRequirements(parseRequirementFlags(posting.requirementFlags), requirementMemberOf(profile), {
    locationState: posting.locationState,
  })

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {life.isPast && <ClosedJobViewed jobId={posting.id} source={source} status={life.status} />}
      <div className="space-y-2">
        <p className="text-sm">
          <Link href="/dashboard/find-my-job" className="text-muted-foreground underline underline-offset-4">
            Back to jobs
          </Link>
        </p>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{posting.title}</h1>
          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-xs font-medium',
              life.isPast ? 'bg-muted text-muted-foreground' : 'bg-success/10 text-success'
            )}
          >
            {lifecycleBadge(life)}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          {!confidential && posting.company ? (
            <Link href={`/dashboard/companies/${encodeURIComponent(posting.company.canonicalNameNormalized)}`} className="underline underline-offset-4">
              {company}
            </Link>
          ) : (
            company
          )}
          {[posting.location, seniorityLabel(posting.level), pay].filter(Boolean).map((x) => ` · ${x}`)}
        </p>
        <p className="text-sm text-muted-foreground">{postedLine(life)}</p>
        <JobRequirementLabels jobId={posting.id} checks={requirements} surface="job_page" />
      </div>
      {requirements.length > 0 && (
        <div className="rounded-lg border border-border p-4">
          <JobRequirementDetails jobId={posting.id} checks={requirements} surface="job_page" />
        </div>
      )}

      {life.isPast ? (
        <div role="status" className="space-y-2 rounded-lg border border-border bg-muted p-4">
          {justClosed ? (
            <>
              <p className="text-sm font-medium text-foreground">This job just closed</p>
              <p className="text-sm text-muted-foreground">
                We checked the listing as you opened it, and the employer is no longer taking applications. We&apos;ve taken it off your board.
              </p>
              <SimilarLiveJobs jobId={posting.id} jobs={similar} />
            </>
          ) : (
            <p className="text-sm font-medium text-foreground">{sentence}</p>
          )}
          <p className="text-sm text-muted-foreground">{justClosed ? 'More like it:' : "You can't apply to this one any more. These are open now:"}</p>
          <ClosedJobAlternatives jobId={posting.id} companyName={confidential ? null : posting.companyName} title={posting.title} surface="job_page" />
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          {native ? (
            <NativeApply postingId={posting.id} />
          ) : (
            <ApplyOnEmployerSite job={{ id: posting.id, title: posting.title, companyName: posting.companyName, location: posting.location, url: posting.url }} viaCheck={posting.source === 'ats_feed'} />
          )}
          {life.repostCount > 0 && (
            <p className="text-xs text-muted-foreground">Reposted before — worth asking someone there whether it is actively being filled.</p>
          )}
        </div>
      )}

      {!life.isPast &&
        // Apply kit and who to contact are open to every member; only the intro request on a confidential search
        // is a Candidate+ extra, shown as one line for members who haven't unlocked it (candidate-plus-extras.ts).
        (
          <div className="space-y-3">
            <ApplyKit postingId={posting.id} surface="job_page" />
            {dossier.unlocked || !confidential ? (
              <div data-who-to-contact={posting.id}>
                <WhoToContactPanel postingId={posting.id} confidential={confidential} />
                <SentItPrompt context={{ source: 'who_to_contact', subjectKey: `job:${posting.id}`, jobId: posting.id }} reaskOnMount />
              </div>
            ) : (
              <CandidatePlusExtraLine extra="request_intro" jobId={posting.id} surface="job_page" />
            )}
          </div>
        )}

      {posting.description && (
        <section aria-labelledby="job-description" className="space-y-2">
          <h2 id="job-description" className="text-sm font-semibold">
            From the listing
          </h2>
          <p className="whitespace-pre-line text-sm text-muted-foreground">{posting.description}</p>
        </section>
      )}
    </div>
  )
}
