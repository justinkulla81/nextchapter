import Link from 'next/link'
import type { BoardSearchParams } from '@/lib/jobs/board-search'
import { searchPastJobs, PAST_JOBS_LIMIT, type PastJobView } from '@/lib/jobs/past-jobs-data'
import { seniorityGroupLabel } from '@/lib/jobs/job-seniority'
import { formatUsdK } from '@/lib/pay/market-pay'

// Past jobs for the board search ("Include past jobs" on): closed listings from the
// company job history (CompanyJobOpening), in their own section below the live board —
// never mixed into it, and never with an apply button. Capped at PAST_JOBS_LIMIT.

const monthYear = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })

function Row({ j }: { j: PastJobView }) {
  const pay = j.payMin && j.payMax ? (j.payMin === j.payMax ? formatUsdK(j.payMin) : `${formatUsdK(j.payMin)}–${formatUsdK(j.payMax)}`) : null
  return (
    <li className="flex flex-wrap items-start justify-between gap-2 px-4 py-3">
      <div className="min-w-0 space-y-0.5">
        <p className="text-sm font-medium text-foreground">
          {j.title}{' '}
          <span className="font-normal text-muted-foreground">
            at{' '}
            {j.companySlug ? (
              <Link href={`/dashboard/companies/${encodeURIComponent(j.companySlug)}`} className="underline underline-offset-4">
                {j.companyName}
              </Link>
            ) : (
              j.companyName
            )}
          </span>
        </p>
        <p className="text-xs text-muted-foreground">
          {[j.location, seniorityGroupLabel(j.seniorityGroup), pay && `${pay} posted`, `open ${monthYear(j.openedAt)} – ${monthYear(j.closedAt)} (${j.daysOpen} days)`]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </div>
      <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
        {j.status === 'expired' ? 'No longer listed' : 'Closed'}
      </span>
    </li>
  )
}

export async function PastJobsSection({ search }: { search: BoardSearchParams }) {
  let jobs: PastJobView[] | null = null
  let failed = false
  if (search.q.trim()) {
    try {
      jobs = await searchPastJobs(search)
    } catch (error) {
      console.error('past jobs search failed', error)
      failed = true
    }
  }
  return (
    <section id="past-jobs" aria-labelledby="past-jobs-heading" className="scroll-mt-4 space-y-3">
      <div>
        <h2 id="past-jobs-heading" className="text-lg font-semibold tracking-tight">
          Past jobs
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Jobs that have closed — for research into what companies hire for, typical titles and pay. You can&apos;t apply to these.
        </p>
      </div>
      {!search.q.trim() ? (
        <p className="text-sm text-muted-foreground">Search for a job title or a company (company:Name) to see past jobs that match.</p>
      ) : failed ? (
        <p className="text-sm text-muted-foreground">We couldn&apos;t load past jobs just now. Refresh the page to try again.</p>
      ) : jobs && jobs.length > 0 ? (
        <>
          <ul className="divide-y divide-border rounded-md border border-border">
            {jobs.map((j) => (
              <Row key={j.id} j={j} />
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            {jobs.length >= PAST_JOBS_LIMIT ? `The ${PAST_JOBS_LIMIT} most recently closed matches. ` : ''}A company&apos;s page has its full
            hiring history.
          </p>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">No past jobs match this search.</p>
      )}
    </section>
  )
}
