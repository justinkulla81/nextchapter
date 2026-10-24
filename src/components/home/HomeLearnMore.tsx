'use client'

import { useState } from 'react'
import Link from 'next/link'
import { posthog } from '@/lib/posthog/client'
import { cn } from '@/lib/utils'

// Everything the long homepage used to stack, one tab at a time. Four tabs, each with
// a short claim and the reason for it, and one link to the full page.

const TABS = [
  {
    id: 'steps',
    label: 'Three steps',
    title: 'How it works',
    items: [
      { title: 'Know where you stand.', body: 'A Market Reality Assessment shows how hard this search will be and which parts are in your control.' },
      { title: 'Fix what’s fixable.', body: 'Your résumé is tested against the eleven systems that read it. Every issue comes with its fix, in about twenty minutes.' },
      { title: 'Build what your résumé can’t say.', body: 'Structured references and a skills and personality assessment, kept in one Executive Dossier you own.' },
    ],
    why: 'Each step covers something a hiring manager scores that a résumé alone cannot show.',
    link: { href: '/how-it-works', label: 'See how it works in full' },
  },
  {
    id: 'coach',
    label: 'Your coach',
    title: 'A coach that has read everything you have done.',
    items: [
      { title: 'Your work', body: 'Résumé, references and work samples.' },
      { title: 'Your applications', body: 'Tracked for you once you connect Gmail and Calendar.' },
      { title: 'Your networking', body: 'Contacts, outreach and replies.' },
      { title: 'Your learning', body: 'Skills you have, and the ones worth building.' },
    ],
    why: 'Most coaches start from what you tell them in an hour. Victoria starts from your actual search, so every plan and nudge fits you.',
    link: { href: '/start/searching-too-long', label: 'Been searching a while? Start here' },
  },
  {
    id: 'free',
    label: 'Free, always',
    title: 'Free for candidates, permanently.',
    items: [
      { title: 'What is free', body: 'The Market Reality Report, Resume Studio, your networking and application tracker, the skills assessment, community and company pages.' },
      { title: 'Who it is for', body: 'Employers, recruiters, colleges and coaches have their own tools. Candidates are never charged.' },
    ],
    why: 'Someone who just lost a job needs a plan, not a paywall.',
    link: { href: '/pricing', label: 'See plans for organizations' },
  },
  {
    id: 'scams',
    label: 'Scam watch',
    title: 'Fake recruiters, caught in minutes.',
    items: [
      { title: 'What it does', body: 'Victoria checks the recruiter emails in your connected Gmail and emails you right away when one looks fake.' },
    ],
    why: 'Scammers pose as recruiters because job hunters are hopeful and in a hurry.',
    link: { href: '/scam-watch', label: 'See how scam watch works' },
  },
] as const

export function HomeLearnMore() {
  const [active, setActive] = useState<(typeof TABS)[number]['id']>('steps')
  const tab = TABS.find((t) => t.id === active) ?? TABS[0]

  return (
    <section className="bg-white py-16" aria-labelledby="home-learn-heading">
      <div className="mx-auto max-w-4xl px-6">
        <h2 id="home-learn-heading" className="text-center font-display text-3xl font-semibold tracking-tight text-ink text-balance">
          What you get
        </h2>
        <div role="tablist" aria-label="What you get" className="mt-6 flex flex-wrap justify-center gap-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`home-tab-${t.id}`}
              aria-selected={t.id === active}
              aria-controls={`home-panel-${t.id}`}
              onClick={() => {
                setActive(t.id)
                posthog.capture('home_learn_tab_opened', { tab: t.id })
              }}
              className={cn(
                'h-10 rounded-full border px-5 text-sm font-semibold transition-colors',
                t.id === active ? 'border-ink bg-ink text-white' : 'border-border bg-white text-ink hover:bg-muted',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div
          role="tabpanel"
          id={`home-panel-${tab.id}`}
          aria-labelledby={`home-tab-${tab.id}`}
          className="mt-8 rounded-2xl border border-border bg-white p-6 sm:p-8"
        >
          <h3 className="font-display text-2xl font-semibold text-ink text-balance">{tab.title}</h3>
          <ul className={cn('mt-5 grid gap-4', tab.items.length > 2 ? 'sm:grid-cols-2' : '')}>
            {tab.items.map((item) => (
              <li key={item.title}>
                <p className="font-semibold text-ink">{item.title}</p>
                <p className="mt-1 text-base text-muted-foreground">{item.body}</p>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-base text-ink">
            <span className="font-semibold">Why:</span> {tab.why}
          </p>
          <Link href={tab.link.href} className="mt-4 inline-block text-sm font-medium text-brand underline underline-offset-4">
            {tab.link.label}
          </Link>
        </div>
      </div>
    </section>
  )
}
