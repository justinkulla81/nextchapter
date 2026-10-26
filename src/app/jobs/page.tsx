import { StructuredData } from '@/components/StructuredData'
import { breadcrumbJsonLd } from '@/lib/seo/jsonld'
import { pageH1, pageSeoMeta } from '@/lib/seo/keywords'
import type { Metadata } from 'next'
import { SiteNav } from '@/components/marketing/PublicSiteChrome'
import { TrackedLink } from '@/components/marketing/TrackedLink'
import { JobSearchForm } from '@/components/home/JobSearchForm'
import { JobsViewedTracker } from '@/components/home/JobsViewedTracker'
import { SaveSearchForm } from '@/components/home/SaveSearchForm'
import { PersonalizePanel, PERSONALIZE_HREF } from '@/components/home/PersonalizePanel'
import { allowByIp, HOUR_MS } from '@/lib/security/rate-limit'
import { cleanPublicQuery, searchPublicBoardCached, type PublicBoardResult } from '@/lib/jobs/public-board'
import { formatRelativeTime } from '@/lib/format-relative-time'

// Search results for the homepage job box. Anonymous and unpersonalized by design: newest
// first, matched on the words typed. The panel beside the list says so, and says exactly how
// to get the personalized version. The bare /jobs page is indexed; result pages (any query)
// are not, because they are infinite and thin.

type SearchParams = Promise<Record<string, string | string[] | undefined>>

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const sp = await searchParams
  const searched = ['q', 'loc', 'remote'].some((k) => sp[k] !== undefined && sp[k] !== '')
  return {
    ...pageSeoMeta('/jobs'),
    robots: { index: !searched, follow: true },
    alternates: { canonical: '/jobs' },
  }
}

function salary(min: number | null, max: number | null): string | null {
  const k = (n: number) => `$${Math.round(n / 1000)}k`
  if (min && max) return `${k(min)}–${k(max)}`
  if (min) return `From ${k(min)}`
  if (max) return `Up to ${k(max)}`
  return null
}

export default async function JobsPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)
  const query = cleanPublicQuery({ q: one(sp.q), loc: one(sp.loc), remote: one(sp.remote) })

  let result: PublicBoardResult | null = null
  let problem: string | null = null
  const searched = query.q !== '' || query.loc !== '' || query.remote
  // Only typed searches count toward the limit, so crawlers can always read the bare page.
  if (searched && !(await allowByIp('public-jobs', 60, HOUR_MS))) {
    problem = 'You have searched a lot this hour. Create a free account to keep searching.'
  } else {
    try {
      result = await searchPublicBoardCached(query)
    } catch (error) {
      console.error('public job search failed:', error instanceof Error ? error.message : error)
      problem = 'Search is unavailable right now. Try again in a minute.'
    }
  }

  const jobs = result?.jobs ?? []
  const what = [query.q, query.loc, query.remote ? 'remote' : ''].filter(Boolean).join(' · ')

  return (
    <div className="theme-redesign flex flex-1 flex-col bg-white text-ink">
      <StructuredData data={breadcrumbJsonLd([{ name: 'Job search', path: '/jobs' }])} />
      <header>
        <SiteNav />
      </header>
      {result && (
        <JobsViewedTracker q={query.q} loc={query.loc} remote={query.remote} total={result.total} shown={jobs.length} />
      )}

      <main className="mx-auto w-full max-w-5xl px-6 pb-16">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          {searched ? `Jobs for “${what}”` : pageH1('/jobs', 'Newest openings')}
        </h1>
        <div className="mt-6">
          <JobSearchForm source="results" initialQ={query.q} initialLoc={query.loc} initialRemote={query.remote} />
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_21rem]">
          <PersonalizePanel properties={{ placement: 'panel', q: query.q, loc: query.loc, remote: query.remote }} />

          <div className="space-y-4">
            {!problem && <SaveSearchForm q={query.q} loc={query.loc} remote={query.remote} />}
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
                              href={job.pagePath ?? job.url}
                              event="jobs_page_job_opened"
                              properties={{ jobId: job.id, q: query.q, loc: query.loc, remote: query.remote, target: job.pagePath ? 'job_page' : 'employer_site' }}
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
