import type { Metadata } from 'next'
import { SiteNav } from '@/components/marketing/PublicSiteChrome'
import { TrackedLink } from '@/components/marketing/TrackedLink'
import { JobSearchForm } from '@/components/home/JobSearchForm'
import { JobsViewedTracker } from '@/components/home/JobsViewedTracker'
import { buttonVariants } from '@/components/ui/button'
import { allowByIp, HOUR_MS } from '@/lib/security/rate-limit'
import { cleanPublicQuery, searchPublicBoard, type PublicBoardResult } from '@/lib/jobs/public-board'
import { formatRelativeTime } from '@/lib/format-relative-time'
import { cn } from '@/lib/utils'

// Search results for the homepage job box. Anonymous and unpersonalized by design: newest
// first, matched on the words typed. The panel beside the list says so, and says exactly how
// to get the personalized version. Not indexed: result pages are infinite and thin.

export const metadata: Metadata = {
  title: 'Search jobs',
  robots: { index: false, follow: true },
  alternates: { canonical: '/jobs' },
}

const PERSONALIZE_HREF = '/onboarding/desire?from=jobs_page'

const NOT_INCLUDED = [
  'Job picks chosen for you',
  'A fit score on every job',
  'Career pivot paths from your experience',
  'Introductions and references into companies',
]

const STEPS = [
  { title: 'Upload your résumé', body: 'We read it so you don’t retype your history.' },
  { title: 'Answer a few questions', body: 'What you want, where, and what you won’t do.' },
  { title: 'Create your free account', body: 'Then this same search comes back ranked for you, with a reason on each job.' },
]

function salary(min: number | null, max: number | null): string | null {
  const k = (n: number) => `$${Math.round(n / 1000)}k`
  if (min && max) return `${k(min)}–${k(max)}`
  if (min) return `From ${k(min)}`
  if (max) return `Up to ${k(max)}`
  return null
}

export default async function JobsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)
  const query = cleanPublicQuery({ q: one(sp.q), loc: one(sp.loc), remote: one(sp.remote) })

  let result: PublicBoardResult | null = null
  let problem: string | null = null
  if (!(await allowByIp('public-jobs', 60, HOUR_MS))) {
    problem = 'You have searched a lot this hour. Create a free account to keep searching.'
  } else {
    try {
      result = await searchPublicBoard(query)
    } catch (error) {
      console.error('public job search failed:', error instanceof Error ? error.message : error)
      problem = 'Search is unavailable right now. Try again in a minute.'
    }
  }

  const jobs = result?.jobs ?? []
  const searched = query.q !== '' || query.loc !== '' || query.remote
  const what = [query.q, query.loc, query.remote ? 'remote' : ''].filter(Boolean).join(' · ')

  return (
    <div className="theme-redesign flex flex-1 flex-col bg-white text-ink">
      <header>
        <SiteNav />
      </header>
      {result && (
        <JobsViewedTracker q={query.q} loc={query.loc} remote={query.remote} total={result.total} shown={jobs.length} />
      )}

      <main className="mx-auto w-full max-w-5xl px-6 pb-16">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          {searched ? `Jobs for “${what}”` : 'Newest openings'}
        </h1>
        <div className="mt-6">
          <JobSearchForm source="results" initialQ={query.q} initialLoc={query.loc} initialRemote={query.remote} />
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_21rem]">
          <aside
            className="order-first h-fit rounded-2xl border border-border bg-white p-5 lg:order-last lg:sticky lg:top-6"
            aria-labelledby="jobs-gap-heading"
          >
            <h2 id="jobs-gap-heading" className="font-display text-xl font-semibold">
              This list is not personalized
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">Anyone sees these same jobs. Without a profile you don&apos;t get:</p>
            <ul className="mt-3 space-y-2 text-sm">
              {NOT_INCLUDED.map((item) => (
                <li key={item} className="flex gap-2">
                  <span aria-hidden className="text-muted-foreground">✕</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>

            <h3 className="mt-5 text-sm font-semibold tracking-widest text-muted-foreground uppercase">How to personalize</h3>
            <ol className="mt-3 space-y-3 text-sm">
              {STEPS.map((s, i) => (
                <li key={s.title} className="flex gap-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-semibold text-white" aria-hidden>
                    {i + 1}
                  </span>
                  <span>
                    <span className="font-semibold">{s.title}.</span> <span className="text-muted-foreground">{s.body}</span>
                  </span>
                </li>
              ))}
            </ol>
            <p className="mt-4 text-sm text-muted-foreground">Free, and it takes about five minutes.</p>
            <TrackedLink
              href={PERSONALIZE_HREF}
              event="jobs_page_personalize_clicked"
              properties={{ placement: 'panel', q: query.q, loc: query.loc, remote: query.remote }}
              className={cn(buttonVariants({ size: 'lg' }), 'mt-4 h-12 w-full rounded-full bg-action text-action-foreground hover:brightness-95')}
            >
              Personalize my results
            </TrackedLink>
          </aside>

          <div>
            {problem ? (
              <div className="rounded-2xl border border-border bg-white p-6 text-sm">
                <p>{problem}</p>
                {problem.startsWith('You have searched') && (
                  <TrackedLink
                    href={PERSONALIZE_HREF}
                    event="jobs_page_personalize_clicked"
                    properties={{ placement: 'rate_limit' }}
                    className="mt-3 inline-block font-semibold text-brand underline underline-offset-4"
                  >
                    Create a free account
                  </TrackedLink>
                )}
              </div>
            ) : jobs.length === 0 ? (
              <div className="rounded-2xl border border-border bg-white p-6 text-sm">
                <p className="font-semibold">No openings matched that search.</p>
                <p className="mt-1 text-muted-foreground">
                  Try fewer words, a state instead of a city, or turn off Remote only. With a profile, we search by your experience instead of keywords.
                </p>
              </div>
            ) : (
              <>
                <p className="mb-3 text-sm text-muted-foreground">
                  About {result!.total.toLocaleString()} US openings{searched ? ' match' : ' right now'}. Showing the {jobs.length} newest, not ranked for you.
                </p>
                <ul className="space-y-3">
                  {jobs.map((job) => {
                    const pay = salary(job.salaryMin, job.salaryMax)
                    return (
                      <li key={job.id} className="rounded-2xl border border-border bg-white p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <TrackedLink
                              href={job.url}
                              event="jobs_page_job_opened"
                              properties={{ jobId: job.id, q: query.q, loc: query.loc, remote: query.remote }}
                              className="font-semibold underline-offset-2 hover:underline"
                            >
                              {job.title}
                            </TrackedLink>
                            <p className="mt-0.5 text-sm text-muted-foreground">
                              {job.company}
                              {job.location ? ` · ${job.location}` : ''}
                              {pay ? ` · ${pay}` : ''}
                            </p>
                          </div>
                          {job.postedAt && <span className="shrink-0 text-xs text-muted-foreground">{formatRelativeTime(new Date(job.postedAt))}</span>}
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">Fit for you: not scored. Personalize to see it.</p>
                      </li>
                    )
                  })}
                </ul>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
