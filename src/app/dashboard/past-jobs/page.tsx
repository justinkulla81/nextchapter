import type { Metadata } from 'next'
import Link from 'next/link'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { getAlumniNetworks, getParallelPaths, getPastJobs } from '@/lib/job-reviews/data'
import { JobReviewCard } from '@/components/job-reviews/JobReviewCard'
import { ParallelPathsForm } from '@/components/job-reviews/ParallelPathsForm'

export const metadata: Metadata = { title: 'Past jobs and alumni' }

const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })

export default async function PastJobsPage() {
  const profile = await getDashboardData()
  const [jobs, parallel, alumni] = await Promise.all([getPastJobs(profile.id), getParallelPaths(profile.id), getAlumniNetworks(profile.id)])

  return (
    <div className="space-y-10">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Past jobs and alumni</h1>
        <p className="text-sm text-muted-foreground">
          Tell us how each job came about and how it was. It sharpens the jobs and companies we show you, and rating and recommending
          places helps other members — which earns credit on your Dossier.
        </p>
      </div>

      <section className="space-y-3" aria-labelledby="reviews-heading">
        <h2 id="reviews-heading" className="text-lg font-semibold tracking-tight">
          Your jobs
        </h2>
        {jobs.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            You have no jobs on your work history yet. Add them from{' '}
            <Link href="/dashboard/work-samples" className="text-primary underline underline-offset-4">
              your work history
            </Link>{' '}
            and they will show up here to review.
          </p>
        ) : (
          <div className="space-y-2">
            {jobs.map((j) => (
              <JobReviewCard
                key={j.id}
                job={{
                  id: j.id,
                  companyName: j.companyName,
                  roleTitle: j.roleTitle,
                  dates: `${fmt(j.startDate)} – ${j.isCurrent || !j.endDate ? 'present' : fmt(j.endDate)}`,
                  isCurrent: j.isCurrent,
                  review: j.review,
                }}
              />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3" aria-labelledby="parallel-heading">
        <div>
          <h2 id="parallel-heading" className="text-lg font-semibold tracking-tight">
            Alongside your search
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Are you doing anything else while you look? Contract work, a business, a part-time job. It&apos;s private to you and your coach,
            and we use it to show you contract and fractional roles that fit.
          </p>
        </div>
        <ParallelPathsForm initial={parallel} />
      </section>

      <section className="space-y-3" aria-labelledby="alumni-heading">
        <div>
          <h2 id="alumni-heading" className="text-lg font-semibold tracking-tight">
            Your alumni networks
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Built from the former employers and schools on your history. Other members are counted, never named.
          </p>
        </div>
        {alumni.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Once you have a former employer or school on your history, its alumni network appears here.
          </p>
        ) : (
          <ul className="space-y-2">
            {alumni.map((a) => (
              <li key={`${a.kind}-${a.name}`} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{a.name} alumni</p>
                  <p className="text-xs text-muted-foreground">
                    {a.kind === 'EMPLOYER' ? 'Former employer' : 'School'} ·{' '}
                    {a.memberCount === null ? 'Fewer than 5 other members so far' : `${a.memberCount} other members`}
                  </p>
                </div>
                <div className="flex gap-3 text-sm">
                  {a.companySlug && (
                    <Link href={`/dashboard/companies/${a.companySlug}`} className="text-primary underline underline-offset-4">
                      Company page and insiders
                    </Link>
                  )}
                  {a.externalUrl && (
                    <a href={a.externalUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-4">
                      Outside alumni group
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
