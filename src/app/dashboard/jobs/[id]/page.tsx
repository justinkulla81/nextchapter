import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { isDossierUnlocked } from '@/lib/scoring/dossier-unlock'
import { isBoardPostingLockedForViewer } from '@/lib/jobs/job-board-visibility'
import { loadPostingLifecycle } from '@/lib/jobs/past-jobs-data'
import { lifecycleBadge, lifecycleSentence, postedLine } from '@/lib/jobs/job-status'
import { seniorityLabel } from '@/lib/jobs/job-seniority'
import { formatUsdK } from '@/lib/pay/market-pay'
import { ClosedJobAlternatives } from '@/components/jobs/ClosedJobAlternatives'
import { ApplyOnEmployerSite, ClosedJobViewed } from '@/components/jobs/JobPageActions'
import { cn } from '@/lib/utils'

// A board job's own page — what a saved link, a My jobs row or an email opens. It
// opens for past jobs too (read-only): a banner says when and why it closed, there
// is no apply button, and the next steps point at open jobs at the same company and
// with the same title (job-status.ts).

export const metadata: Metadata = { title: 'Job' }

const SOURCES = new Set(['my_jobs', 'email', 'job_search_daily', 'fresh_job_alert', 'saved_link', 'board', 'company'])

export default async function JobPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ src?: string }> }) {
  const [{ id }, { src }] = await Promise.all([params, searchParams])
  const profile = await getDashboardData()
  const [posting, tracked, dossier] = await Promise.all([
    prisma.exclusiveJobPosting.findUnique({
      where: { id },
      select: {
        id: true, title: true, companyName: true, location: true, url: true, status: true, distribution: true, disclosure: true,
        institutionScopeId: true, audienceTier: true, source: true, level: true, salaryMin: true, salaryMax: true, payPeriod: true,
        description: true, company: { select: { canonicalNameNormalized: true } },
      },
    }),
    prisma.trackedJob.findFirst({ where: { candidateId: profile.id, source: 'job_board', sourceId: id }, select: { id: true } }),
    isDossierUnlocked(profile.id),
  ])
  // Only what the board would ever show this member — or a job they saved themselves.
  const visible =
    posting &&
    (tracked ||
      (posting.status === 'approved' &&
        !posting.institutionScopeId &&
        posting.distribution !== 'EXCLUDED' &&
        !isBoardPostingLockedForViewer(posting, dossier.unlocked)))
  if (!posting || !visible) notFound()

  const life = await loadPostingLifecycle(posting.id)
  if (!life) notFound()
  const source = src && SOURCES.has(src) ? src : 'direct'
  const confidential = posting.disclosure === 'CONFIDENTIAL'
  const company = confidential ? 'Confidential company' : posting.companyName
  const yearly = !posting.payPeriod || posting.payPeriod === 'year'
  const pay = yearly && posting.salaryMin && posting.salaryMax ? `${formatUsdK(posting.salaryMin)}–${formatUsdK(posting.salaryMax)} posted` : null
  const sentence = lifecycleSentence(life)

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
      </div>

      {life.isPast ? (
        <div role="status" className="space-y-2 rounded-lg border border-border bg-muted p-4">
          <p className="text-sm font-medium text-foreground">{sentence}</p>
          <p className="text-sm text-muted-foreground">You can&apos;t apply to this one any more. These are open now:</p>
          <ClosedJobAlternatives jobId={posting.id} companyName={confidential ? null : posting.companyName} title={posting.title} surface="job_page" />
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <ApplyOnEmployerSite job={{ id: posting.id, title: posting.title, companyName: posting.companyName, location: posting.location, url: posting.url }} />
          {life.repostCount > 0 && (
            <p className="text-xs text-muted-foreground">Reposted before — worth asking someone there whether it is actively being filled.</p>
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
