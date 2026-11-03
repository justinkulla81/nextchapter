'use client'

import { useState } from 'react'
import { Check, Lock } from 'lucide-react'
import { PreviewShell } from '@/components/candidate/PreviewShell'
import { cn } from '@/lib/utils'

// Network, shortened to the page contract (docs/candidate-redesign.md). Sample data.
// Overview: one headline, one next move, one list of the five circles. The ring diagram is gone (it repeated the list),
// the "moments" are progress bars on the circle each one belongs to, and the tune strip is one line under the list.
// Tracker: the long ?view=all page split by purpose into three tabs.

type State = 'active' | 'started' | 'empty' | 'locked'
const STATE_LABEL: Record<State, string> = { active: 'Active', started: 'Started', empty: 'Not started', locked: 'Locked' }
const more = 'text-sm font-medium text-brand underline underline-offset-4'

const CIRCLES: { name: string; state: State; status: string; gap?: string; bar?: { label: string; pct: number; why: string }; action: string }[] = [
  { name: 'Your close circle', state: 'started', status: 'Alex and Dana are in your corner. No coach yet.', gap: 'A coach reviews your plan and keeps you accountable week to week.', action: 'Open your close circle' },
  { name: 'People you know', state: 'active', status: '184 contacts. 12 are due a follow-up.', bar: { label: '38 of 50 messages', pct: 76, why: 'Fifty messages is one of the steps that puts you in front of recruiters.' }, action: 'Review follow-ups' },
  { name: 'Alumni and groups', state: 'active', status: 'Ohio State alumni and Northwind alumni.', action: 'Find alumni at your target companies' },
  { name: 'Industry and function', state: 'empty', status: 'Not joined yet.', gap: 'Communities for finance and operations leaders are open to you.', action: 'Join a community' },
  { name: 'Recruiters', state: 'locked', status: 'Recruiters can find you once you earn Candidate+.', bar: { label: '2 of 5 steps', pct: 40, why: 'Each step you finish opens recruiter visibility.' }, action: 'See what is left' },
]

export function NetworkShort() {
  return (
    <PreviewShell place="network" entry="circles" part="overview">
      <header className="space-y-1.5">
        <h1 className="font-display text-3xl leading-tight font-semibold tracking-tight text-ink text-balance">Your network</h1>
        <p className="max-w-xl text-base text-muted-foreground">Build it one conversation at a time. Each circle you add opens something new.</p>
      </header>

      <section aria-labelledby="next" className="space-y-3 rounded-2xl border border-border bg-white p-5">
        <h2 id="next" className="font-display text-2xl leading-tight font-semibold text-ink text-balance">Ask Priya Shah for a 15-minute chat.</h2>
        <p className="max-w-2xl text-base text-ink"><span className="font-semibold">Why:</span> Priya is a VP of Operations at Northwind, where you applied last week. A warm introduction there counts for more than the application.</p>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <a href="#" className="inline-flex h-12 items-center rounded-full bg-action px-8 text-base font-semibold text-action-foreground hover:brightness-95">Draft the message</a>
          <a href="#" className={more}>See this week’s plan</a>
        </div>
      </section>

      <section aria-labelledby="circles" className="space-y-3">
        <h2 id="circles" className="font-display text-xl font-semibold text-ink">Your five circles</h2>
        <ol className="divide-y divide-border rounded-2xl border border-border">
          {CIRCLES.map((c, i) => (
            <li key={c.name} className="grid gap-x-6 gap-y-1 p-4 md:grid-cols-[1fr_auto]">
              <div className="space-y-0.5">
                <h3 className="flex flex-wrap items-center gap-x-3 text-base font-semibold text-ink">
                  <span><span className="mr-2 text-muted-foreground tabular-nums">{i + 1}</span>{c.name}</span>
                  <span className={cn('inline-flex items-center gap-1 text-xs font-medium', c.state === 'active' ? 'text-success' : 'text-muted-foreground')}>
                    {c.state === 'active' && <Check className="size-3.5" aria-hidden />}
                    {c.state === 'locked' && <Lock className="size-3.5" aria-hidden />}
                    {STATE_LABEL[c.state]}
                  </span>
                </h3>
                <p className="text-base text-ink">{c.status}</p>
                {c.gap && <p className="text-sm text-muted-foreground">{c.gap}</p>}
              </div>
              <div className="flex flex-col justify-center gap-1.5 md:w-64">
                {c.bar && (
                  <div className="space-y-1">
                    <div className="h-1.5 overflow-hidden rounded-full bg-border" role="meter" aria-valuenow={c.bar.pct} aria-valuemin={0} aria-valuemax={100} aria-label={c.bar.label}>
                      <div className="h-full rounded-full bg-ink" style={{ width: `${c.bar.pct}%` }} />
                    </div>
                    <p className="text-sm font-medium text-ink">{c.bar.label}</p>
                    <p className="text-xs text-muted-foreground">{c.bar.why}</p>
                  </div>
                )}
                <a href="#" className={more}>{c.action}</a>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <p className="rounded-2xl bg-muted/50 px-5 py-3 text-sm text-ink">
        <span className="font-semibold">Warmer introductions:</span> we only know your past employers. Name 3 companies you want and we find who you know there.{' '}
        <a href="#" className={more}>Answer two questions</a>
      </p>
    </PreviewShell>
  )
}

const TABS = ['Who to contact', 'Tracking', 'Plan'] as const

const PEOPLE: [string, string, string, string][] = [
  ['Priya Shah', 'VP Operations, Northwind', 'Priority · you applied there last week', 'Draft a message'],
  ['Marcus Lee', 'Director, Harbor Health', 'Follow up · last spoke 3 weeks ago', 'Draft a follow-up'],
  ['Dana Ortiz', 'Recruiter, Lattice Labs', 'Recruiter · matches your search', 'Say hello'],
  ['Sam Reed', 'Ohio State alum, Northwind', 'Alumni · works at a company you applied to', 'Ask for a chat'],
]

export function NetworkTracker() {
  const [tab, setTab] = useState<(typeof TABS)[number]>('Who to contact')
  return (
    <PreviewShell place="network" entry="circles" part="know">
      <header className="space-y-1.5">
        <h1 className="font-display text-3xl leading-tight font-semibold tracking-tight text-ink text-balance">People you know</h1>
        <p className="max-w-xl text-base text-muted-foreground">184 contacts. 12 are due a follow-up.</p>
      </header>

      <div role="tablist" aria-label="People you know" className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button key={t} role="tab" type="button" aria-selected={tab === t} onClick={() => setTab(t)} className={cn('rounded-full border px-4 py-1.5 text-sm font-medium', tab === t ? 'border-ink bg-ink text-white' : 'border-border text-muted-foreground hover:bg-muted')}>{t}</button>
        ))}
      </div>

      {tab === 'Who to contact' && (
        <section aria-label="Who to contact" className="space-y-3">
          <p className="text-sm text-muted-foreground">Priority people, follow-ups, alumni and recruiters in one list, most useful first. Each says why.</p>
          <ul className="divide-y divide-border rounded-2xl border border-border">
            {PEOPLE.map(([n, r, why, a], i) => (
              <li key={n} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="text-base font-semibold text-ink">{n} <span className="text-sm font-normal text-muted-foreground">{r}</span></p>
                  <p className="text-sm text-muted-foreground">{why}</p>
                </div>
                <a href="#" className={i === 0 ? 'inline-flex h-10 items-center rounded-full bg-action px-6 text-sm font-semibold text-action-foreground hover:brightness-95' : more}>{a}</a>
              </li>
            ))}
          </ul>
          <a href="#" className={more}>Show all 184 contacts</a>
        </section>
      )}

      {tab === 'Tracking' && (
        <section aria-label="Tracking" className="space-y-4">
          <dl className="grid grid-cols-3 gap-3 text-center">
            {[['38', 'messages sent'], ['9', 'replies'], ['52', 'conversations']].map(([v, l]) => (
              <div key={l} className="rounded-xl bg-muted/60 px-2 py-4"><dd className="text-2xl font-semibold tabular-nums text-ink">{v}</dd><dt className="text-xs text-muted-foreground">{l}</dt></div>
            ))}
          </dl>
          <ul className="divide-y divide-border rounded-2xl border border-border text-base">
            <li className="flex items-center justify-between gap-3 p-4"><span>Gmail and Calendar tracking is on. We read, never write.</span><a href="#" className={more}>Manage</a></li>
            <li className="flex items-center justify-between gap-3 p-4"><span>LinkedIn connections imported: 184</span><a href="#" className={more}>Import again</a></li>
          </ul>
        </section>
      )}

      {tab === 'Plan' && (
        <section aria-label="Plan" className="space-y-3">
          <p className="text-base text-ink">Your outreach plan: <span className="font-semibold">5 people a week</span>, matched to how comfortable you said you are.</p>
          <ul className="list-disc space-y-1 pl-6 text-base text-ink">
            <li>Mix this week: 3 warm contacts, 1 alumnus, 1 recruiter</li>
            <li>Your search is leaning on postings. Two conversations a week balances it.</li>
          </ul>
          <a href="#" className={more}>Change what gets in the way</a>
        </section>
      )}
    </PreviewShell>
  )
}
