'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Button, buttonVariants } from '@/components/ui/button'
import { TrackedLink } from '@/components/marketing/TrackedLink'
import { posthog } from '@/lib/posthog/client'
import { formatRelativeTime } from '@/lib/format-relative-time'
import { cn } from '@/lib/utils'

// Homepage job board: anyone can search real, current jobs without an account. What
// they can't get without one is spelled out beside the results, and the way to get it
// (onboarding, which creates the account) is the page's primary action. Search is a
// plain database query, newest first; nothing here is ranked or scored for the visitor.

interface BoardJob {
  id: string
  title: string
  company: string
  location: string | null
  postedAt: string | null
  salaryMin: number | null
  salaryMax: number | null
  url: string
}
interface BoardResult { total: number; jobs: BoardJob[] }

const PERSONALIZE_HREF = '/onboarding/desire?from=homepage_board'

const MISSING_WITHOUT_PROFILE = [
  'Job picks chosen for you',
  'A fit score on every job',
  'Career pivot paths from your experience',
  'Introductions and references into companies',
]

function salary(min: number | null, max: number | null): string | null {
  const k = (n: number) => `$${Math.round(n / 1000)}k`
  if (min && max) return `${k(min)}–${k(max)}`
  if (min) return `From ${k(min)}`
  if (max) return `Up to ${k(max)}`
  return null
}

export function HomepageJobBoard() {
  const [q, setQ] = useState('')
  const [loc, setLoc] = useState('')
  const [remote, setRemote] = useState(false)
  const [result, setResult] = useState<BoardResult | null>(null)
  const [searched, setSearched] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const requestId = useRef(0)

  const run = useCallback(async (query: { q: string; loc: string; remote: boolean }, isSearch: boolean) => {
    const id = ++requestId.current
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (query.q) params.set('q', query.q)
      if (query.loc) params.set('loc', query.loc)
      if (query.remote) params.set('remote', '1')
      const res = await fetch(`/api/public/jobs?${params.toString()}`)
      const body = (await res.json()) as BoardResult & { error?: string }
      if (id !== requestId.current) return
      if (!res.ok) {
        setError(body.error ?? 'Search is unavailable right now. Try again in a minute.')
        return
      }
      setResult(body)
      setSearched(isSearch)
      posthog.capture(isSearch ? 'home_board_searched' : 'home_board_viewed', {
        q: query.q, loc: query.loc, remote: query.remote, total: body.total, shown: body.jobs.length,
      })
    } catch {
      if (id === requestId.current) setError('Search is unavailable right now. Check your connection and try again.')
    } finally {
      if (id === requestId.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    // Deferred a tick so the first fetch does not set state inside the effect body.
    const t = setTimeout(() => void run({ q: '', loc: '', remote: false }, false), 0)
    return () => clearTimeout(t)
  }, [run])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    void run({ q: q.trim(), loc: loc.trim(), remote }, true)
  }

  const jobs = result?.jobs ?? []
  const total = result?.total ?? 0

  return (
    <section className="bg-off-white py-16" aria-labelledby="home-board-heading">
      <div className="mx-auto max-w-5xl px-6">
        <div className="text-center">
          <h2 id="home-board-heading" className="font-display text-3xl font-semibold tracking-tight text-ink text-balance">
            Look around first. No account needed.
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
            These are current openings, newest first. They are not matched to you. Build your profile to see which ones fit.
          </p>
        </div>

        <form
          onSubmit={submit}
          className={cn('mx-auto mt-8 flex max-w-3xl flex-col gap-3 sm:flex-row', loading && 'cursor-wait')}
          role="search"
        >
          <label className="sr-only" htmlFor="home-board-q">Job title or company</label>
          <input
            id="home-board-q"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            maxLength={100}
            placeholder="Job title or company"
            className="h-12 flex-1 rounded-lg border border-border bg-white px-4 text-base"
          />
          <label className="sr-only" htmlFor="home-board-loc">City or state</label>
          <input
            id="home-board-loc"
            value={loc}
            onChange={(e) => setLoc(e.target.value)}
            maxLength={100}
            placeholder="City or state"
            className="h-12 rounded-lg border border-border bg-white px-4 text-base sm:w-56"
          />
          <Button type="submit" size="lg" className="h-12 rounded-full bg-action px-6 text-action-foreground hover:brightness-95" disabled={loading}>
            {loading ? 'Searching…' : 'Search jobs'}
          </Button>
        </form>

        <div className="mx-auto mt-3 flex max-w-3xl items-center justify-center gap-2" role="group" aria-label="Work location">
          <Button type="button" size="sm" variant={remote ? 'outline' : 'default'} aria-pressed={!remote} onClick={() => setRemote(false)}>
            Any location type
          </Button>
          <Button type="button" size="sm" variant={remote ? 'default' : 'outline'} aria-pressed={remote} onClick={() => setRemote(true)}>
            Remote only
          </Button>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_20rem]">
          <div aria-live="polite" className={cn(loading && 'cursor-wait')}>
            {error ? (
              <div className="rounded-2xl border border-border bg-white p-6 text-sm text-ink">
                <p>{error}</p>
                <Button type="button" className="mt-3" variant="outline" size="sm" onClick={() => void run({ q: q.trim(), loc: loc.trim(), remote }, searched)}>
                  Try the search again
                </Button>
              </div>
            ) : loading && !result ? (
              <ul className="space-y-3" aria-label="Loading jobs">
                {[0, 1, 2, 3].map((i) => (
                  <li key={i} className="h-20 animate-pulse rounded-2xl border border-border bg-white" />
                ))}
              </ul>
            ) : jobs.length === 0 ? (
              <div className="rounded-2xl border border-border bg-white p-6 text-sm text-ink">
                <p className="font-semibold">No openings matched that search.</p>
                <p className="mt-1 text-muted-foreground">Try fewer words, a state instead of a city, or turn off Remote only. With a profile, we search by your experience instead of keywords.</p>
                <TrackedLink
                  href={PERSONALIZE_HREF}
                  event="home_board_personalize_clicked"
                  properties={{ placement: 'empty' }}
                  className="mt-3 inline-block font-semibold text-brand underline underline-offset-4"
                >
                  Build your profile
                </TrackedLink>
              </div>
            ) : (
              <>
                <p className="mb-3 text-sm text-muted-foreground">
                  {searched ? `About ${total.toLocaleString()} US openings match. ` : `About ${total.toLocaleString()} open US roles right now. `}
                  Showing the {jobs.length} newest, not ranked for you.
                </p>
                <ul className={cn('space-y-3', loading && 'opacity-60')}>
                  {jobs.map((job) => {
                    const pay = salary(job.salaryMin, job.salaryMax)
                    return (
                      <li key={job.id} className="rounded-2xl border border-border bg-white p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <TrackedLink
                              href={job.url}
                              event="home_board_job_opened"
                              properties={{ jobId: job.id, q, loc, remote }}
                              className="font-semibold text-ink underline-offset-2 hover:underline"
                            >
                              {job.title}
                            </TrackedLink>
                            <p className="mt-0.5 text-sm text-muted-foreground">
                              {job.company}
                              {job.location ? ` · ${job.location}` : ''}
                              {pay ? ` · ${pay}` : ''}
                            </p>
                          </div>
                          {job.postedAt && (
                            <span className="shrink-0 text-xs text-muted-foreground">{formatRelativeTime(new Date(job.postedAt))}</span>
                          )}
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">Fit for you: not scored. Build your profile to see it.</p>
                      </li>
                    )
                  })}
                </ul>
              </>
            )}
          </div>

          <aside className="h-fit rounded-2xl border border-border bg-white p-5 lg:sticky lg:top-6" aria-labelledby="home-board-gap-heading">
            <h3 id="home-board-gap-heading" className="font-display text-xl font-semibold text-ink">
              This list is not personalized
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Anyone sees these same jobs. Without a profile you don&apos;t get:
            </p>
            <ul className="mt-3 space-y-2 text-sm text-ink">
              {MISSING_WITHOUT_PROFILE.map((item) => (
                <li key={item} className="flex gap-2">
                  <span aria-hidden className="text-muted-foreground">✕</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-sm text-muted-foreground">
              Upload your résumé and answer a few questions. It creates your free account and takes about five minutes.
            </p>
            <TrackedLink
              href={PERSONALIZE_HREF}
              event="home_board_personalize_clicked"
              properties={{ placement: 'panel', q, loc, remote, searched }}
              className={cn(buttonVariants({ size: 'lg' }), 'mt-4 h-12 w-full rounded-full bg-action text-action-foreground hover:brightness-95')}
            >
              Personalize my results
            </TrackedLink>
          </aside>
        </div>
      </div>
    </section>
  )
}
