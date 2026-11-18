import Link from 'next/link'

export interface SavedJobRow {
  title: string
  company: string
  place: string | null
  href: string
}

/**
 * A light member's page (owner decision 2026-11-18): the jobs they saved, and one primary action, the questions that unlock
 * their fit and the full member area. Nothing else: the rest of the site opens once the questions are done.
 */
export function SavedJobsView({ firstName, jobs, startHref, browseHref = '/jobs' }: { firstName: string | null; jobs: SavedJobRow[]; startHref: string; browseHref?: string }) {
  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <h1 className="font-display text-4xl leading-tight font-semibold tracking-tight text-balance text-ink">{firstName ? `Welcome, ${firstName}.` : 'Welcome.'}</h1>
        <p className="text-base text-muted-foreground">
          <span className="font-semibold text-ink">Next: </span>
          answer a few questions and we show how well you fit each job, and rank every job on the site for you. About three minutes, no résumé needed.
        </p>
        <Link
          href={startHref}
          className="inline-flex h-11 items-center rounded-full bg-action px-7 text-base font-semibold text-action-foreground hover:brightness-95 focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          See my fit
        </Link>
      </div>
      <section aria-labelledby="saved-jobs-title" className="space-y-3">
        <h2 id="saved-jobs-title" className="text-lg font-semibold text-ink">
          Your saved jobs
        </h2>
        {jobs.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing saved yet. <Link href={browseHref} className="font-medium text-brand underline underline-offset-4">Browse jobs</Link> and press Save on any you like.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-2xl border border-border bg-white">
            {jobs.map((j) => (
              <li key={`${j.href}|${j.title}|${j.company}`} className="px-4 py-3">
                <Link href={j.href} className="font-medium text-ink underline-offset-4 hover:underline">
                  {j.title}
                </Link>
                <p className="text-sm text-muted-foreground">{[j.company, j.place].filter(Boolean).join(' · ')}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
