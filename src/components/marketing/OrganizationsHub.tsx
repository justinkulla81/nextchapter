'use client'

import { useState } from 'react'
import Link from 'next/link'
import { posthog } from '@/lib/posthog/client'
import { cn } from '@/lib/utils'

// The sub-homepage pattern for every audience page: one headline, a list of who you are,
// what you get as that audience (three lines at most), and one action. The long audience
// pages (outplacement, recruiters, nonprofits, workforce, coaches) become the "learn more"
// link under each entry instead of being stacked here.

interface Audience {
  id: string
  label: string
  who: string
  gets: string[]
  learnMore: { href: string; label: string }
  login?: { href: string; label: string }
}

const AUDIENCES: Audience[] = [
  {
    id: 'employers',
    label: 'Employers',
    who: 'Hiring, outplacement, growth and learning on one account.',
    gets: [
      'Hiring: post a role, see matched candidates who chose to be seen, ask for introductions.',
      'Outplacement: a seat for each person leaving. You see participation and outcomes as counts.',
      'Growth and learning: plans for the people who stay. You see counts by team, never who.',
    ],
    learnMore: { href: '/outplacement', label: 'For employers' },
    login: { href: '/talent/login', label: 'Employer log in' },
  },
  {
    id: 'recruiters',
    label: 'Recruiters and agencies',
    who: 'Search firms, staffing agencies and in-house sourcers.',
    gets: [
      'Search candidates who opted in to be found, with their résumé and work history.',
      'A résumé page in your logo, with each résumé routed to the right recruiter.',
      'Candidates who arrive with their file already built.',
    ],
    learnMore: { href: '/recruiters', label: 'For recruiters' },
    login: { href: '/recruiters/login', label: 'Recruiter log in' },
  },
  {
    id: 'coaches',
    label: 'Coaches',
    who: 'Independent career coaches and coaching practices. No organization needed.',
    gets: [
      'Invite clients with a code. You keep billing them your way.',
      'See the plan, applications and progress each client chooses to share, before every session.',
      'Track sessions left and share your scheduling link.',
    ],
    learnMore: { href: '/coaches', label: 'For coaches' },
    login: { href: '/support/coach/login', label: 'Coach log in' },
  },
  {
    id: 'colleges',
    label: 'Colleges and nonprofits',
    who: 'Alumni relations, career services and mission-driven programs.',
    gets: [
      'A workspace for your alumni or participants, in your colors.',
      'Outcomes reporting in counts, with small groups held back.',
      'Mentors, employer partners and jobs posted only for your people.',
    ],
    learnMore: { href: '/nonprofits', label: 'For colleges and nonprofits' },
  },
  {
    id: 'workforce',
    label: 'Government and workforce',
    who: 'Workforce boards, economic development groups, chambers and state agencies.',
    gets: [
      'A program workspace for job seekers in your region.',
      'A layoff response sign-up page for workers affected in your area.',
      'Your member companies, with hiring and outplacement seats you can sponsor.',
    ],
    learnMore: { href: '/government-workforce', label: 'For government and workforce' },
  },
]

const action =
  'inline-flex h-14 items-center rounded-full bg-action px-8 text-base font-semibold text-action-foreground hover:brightness-95'

export function OrganizationsHub() {
  const [id, setId] = useState(AUDIENCES[0].id)
  const a = AUDIENCES.find((x) => x.id === id) ?? AUDIENCES[0]

  return (
    <>
      <section className="mx-auto max-w-3xl px-6 pt-10 pb-12 text-center" aria-labelledby="org-hero-heading">
        <h1 id="org-hero-heading" className="font-display text-4xl leading-tight font-semibold tracking-tight text-balance sm:text-5xl">
          Free for the people you serve.
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg text-muted-foreground">
          Employers, recruiters, coaches, colleges and workforce agencies use NextChapter to get people hired. Candidates are never charged.
        </p>
        <div className="mt-8">
          <Link
            href="#contact"
            onClick={() => posthog.capture('organizations_cta_clicked', { cta: 'talk_to_us', audience: id })}
            className={action}
          >
            Talk to us
          </Link>
        </div>
      </section>

      <section className="mx-auto w-full max-w-5xl px-6 pb-16" aria-labelledby="org-who-heading">
        <h2 id="org-who-heading" className="font-display text-2xl font-semibold text-ink">Who are you?</h2>
        <div className="mt-5 grid gap-6 md:grid-cols-[16rem_1fr]">
          <div role="tablist" aria-label="Who you are" className="flex flex-col gap-2">
            {AUDIENCES.map((x) => (
              <button
                key={x.id}
                type="button"
                role="tab"
                aria-selected={x.id === id}
                aria-controls="org-panel"
                id={`org-tab-${x.id}`}
                onClick={() => {
                  setId(x.id)
                  posthog.capture('organizations_audience_selected', { audience: x.id })
                }}
                className={cn(
                  'rounded-xl border px-4 py-3 text-left text-base font-semibold transition-colors',
                  x.id === id ? 'border-ink bg-ink text-white' : 'border-border bg-white text-ink hover:bg-muted',
                )}
              >
                {x.label}
              </button>
            ))}
          </div>

          <div role="tabpanel" id="org-panel" aria-labelledby={`org-tab-${a.id}`} className="rounded-2xl border border-border bg-white p-6 sm:p-8">
            <h3 className="font-display text-2xl font-semibold text-ink">{a.label}</h3>
            <p className="mt-1 text-base text-muted-foreground">{a.who}</p>
            <ul className="mt-5 space-y-3">
              {a.gets.map((g) => (
                <li key={g} className="flex gap-3 text-base text-ink">
                  <span aria-hidden className="mt-2.5 size-1.5 shrink-0 rounded-full bg-ink" />
                  <span>{g}</span>
                </li>
              ))}
            </ul>
            <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2">
              <Link
                href={a.learnMore.href}
                onClick={() => posthog.capture('organizations_learn_more_clicked', { audience: a.id })}
                className="text-sm font-semibold text-brand underline underline-offset-4"
              >
                {a.learnMore.label}
              </Link>
              {a.login && (
                <Link href={a.login.href} className="text-sm text-muted-foreground underline underline-offset-4">
                  {a.login.label}
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
