import Link from 'next/link'
import type { ReactNode } from 'react'
import { EmployerEmailCapture } from './EmployerEmailCapture'

export interface NetworkHeroFacts {
  employer: string
  slug: string
  /** The page's own H1 (the SEO one). */
  h1: string
  workers: number
  stateLabel: string
  /** "about 96,000", already rounded. */
  openInState: string
  openAtEmployer: string | null
  latestFiled: string
  /** Where the cuts are, as the notices name them ("Redmond, Bellevue"). */
  places: string[]
  /** The local workforce boards matched to the notices, by name. */
  boards: string[]
  unemploymentHref: string
  /** Where the facts come from, e.g. "Washington Employment Security Department WARN filings". */
  source: string
}

/**
 * The top of a /network/company page: the employer's own facts first, then one field. The employer's primary color is an accent
 * (the top rule, the numbers, the step marks, the button) and its secondary is the highlight; every surface stays white or off-white.
 * Owner direction 2026-11-13: forward progress, not "a plan"; specific to the employer and place; no brands claimed that we do not have.
 */
const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)

export function NetworkHero({ f, aside }: { f: NetworkHeroFacts; aside?: ReactNode }) {
  const boardLine = f.boards.length > 0 ? f.boards.slice(0, 2).join(' and ') : null
  const steps = [
    { title: `Your ${f.stateLabel} deadlines`, body: 'What to file and by when, so nothing lapses.', href: f.unemploymentHref },
    { title: 'Roles that fit you', body: `${cap(f.openInState)} professional jobs are open in ${f.stateLabel}${f.openAtEmployer ? `, ${f.openAtEmployer} at ${f.employer}` : ''}, sorted by your background.` },
    { title: 'Free help near you', body: boardLine ? `${boardLine}: job search, training and filing help, at no cost.` : 'Your local workforce board and American Job Center: job search, training and filing help, at no cost.' },
  ]
  return (
    <section aria-labelledby="hero-h1" className="mt-4 overflow-hidden rounded-2xl border border-border bg-white">
      <div aria-hidden className="flex h-1.5"><div className="flex-1 bg-[var(--org-1,#14213D)]" /><div className="w-24 bg-[var(--org-2,#e0a43a)]" /></div>
      <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[1.25fr_1fr]">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            <span aria-hidden className="inline-block h-2 w-2 rounded-full bg-[var(--org-2,#e0a43a)]" />
            For people leaving {f.employer}
          </p>
          <h1 id="hero-h1" className="mt-3 text-balance font-display text-3xl font-bold tracking-tight text-navy sm:text-4xl">{f.h1}</h1>
          <p className="mt-4 max-w-xl text-lg text-navy">
            <strong className="text-[var(--org-1-text,#14213D)]">{f.workers.toLocaleString('en-US')}</strong> people are leaving {f.employer}.{' '}
            <strong className="text-[var(--org-1-text,#14213D)]">{cap(f.openInState)}</strong> professional jobs are open in {f.stateLabel}. Let&apos;s find the ones that fit you.
          </p>
          <EmployerEmailCapture slug={f.slug} employer={f.employer} tone="light" />
        </div>
        <ol className="space-y-4 self-center" aria-label="What you get first">
          {steps.map((s, i) => (
            <li key={s.title} className="flex gap-3">
              <span aria-hidden className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--org-1,#14213D)] text-sm font-semibold text-[var(--org-1-ink,#ffffff)]">{i + 1}</span>
              <div>
                <p className="font-semibold text-navy">{s.href ? <Link href={s.href} className="hover:underline">{s.title}</Link> : s.title}</p>
                <p className="text-sm text-muted-foreground">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
      <dl className="grid divide-y divide-border border-t border-border bg-off-white text-sm sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <div className="px-6 py-4"><dt className="text-muted-foreground">Latest filing</dt><dd className="mt-0.5 font-semibold text-navy">{f.latestFiled}</dd></div>
        <div className="px-6 py-4"><dt className="text-muted-foreground">Where</dt><dd className="mt-0.5 font-semibold text-navy">{f.places.length > 0 ? f.places.slice(0, 3).join(', ') : f.stateLabel}</dd></div>
        <div className="px-6 py-4"><dt className="text-muted-foreground">Source</dt><dd className="mt-0.5 font-semibold text-navy">{f.source}</dd></div>
      </dl>
      {aside}
    </section>
  )
}
