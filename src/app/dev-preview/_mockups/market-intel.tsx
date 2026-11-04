'use client'

import { useState } from 'react'
import { Lock } from 'lucide-react'
import { PreviewShell } from '@/components/candidate/PreviewShell'
import { PageHeader } from '@/components/candidate/PageHeader'
import { HomeFold } from '@/components/candidate/HomeFold'
import { PrimaryButton, SecondaryButton } from '@/components/candidate/ui'
import { cn } from '@/lib/utils'

// Market intelligence, shortened to the page contract (docs/candidate-redesign.md). Sample data.
// One headline fact (the comp band, with where it comes from), then the target companies as rows that each say why, with
// the four trajectory choices as adjacent buttons. The weekly brief, the other filters and the "more ways" pointers fold away.
// Removed: the three icon cards, the seven-column table, the "No data provider connected" empty state, and the
// Insider network / Contact data / Board and advisory cards (now one line each in a fold).

const more = 'text-sm font-medium text-brand underline underline-offset-4'

const COMPANIES = [
  { n: 'Northwind', v: 'Growing', why: 'Hiring more than last quarter, and Priya Shah in your network works there.', fact: '1,000–5,000 employees · Boston', paths: '2 in your network' },
  { n: 'Harbor Health', v: 'Growing', why: 'Open roles are up and it is not owned by private equity.', fact: '5,000+ employees · Boston', paths: null },
  { n: 'Lattice Labs', v: 'Flat', why: 'Steady hiring. A recruiter at Lattice matches your search.', fact: '200–1,000 employees · Remote', paths: '1 in your network' },
  { n: 'Arsenault Partners', v: 'Contracting', why: 'Fewer openings than a year ago, so expect more competition.', fact: '200–1,000 employees · New York', paths: null },
]
const TRAJ = ['Any', 'Growing', 'Flat', 'Contracting']

export function MarketIntelFull() {
  const [traj, setTraj] = useState('Any')
  const shown = COMPANIES.filter((c) => traj === 'Any' || c.v === traj)
  return (
    <PreviewShell place="jobs" entry="market" part="market" wide>
      <PageHeader title="Who is hiring and what it pays" />

      <section aria-labelledby="comp" className="space-y-1 rounded-2xl border border-border p-5">
        <h2 id="comp" className="font-display text-2xl font-semibold text-ink">$210,000–$250,000 base for VP Operations</h2>
        <p className="text-base text-ink"><span className="font-semibold">Why:</span> that is the middle half of 1,240 advertised salaries for this role in Boston.</p>
        <p className="text-sm text-muted-foreground">We did not have enough NC Job Board salary data for your target yet, so this comes from Adzuna. <a href="#" className={more}>Adzuna attribution</a></p>
      </section>

      <section aria-labelledby="targets" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="targets" className="font-display text-xl font-semibold text-ink">Companies worth a conversation</h2>
          <div role="group" aria-label="Hiring trend" className="flex flex-wrap gap-2">
            {TRAJ.map((t) => (
              <button key={t} type="button" aria-pressed={traj === t} onClick={() => setTraj(t)} className={cn('rounded-full border px-4 py-1.5 text-sm font-medium', traj === t ? 'border-ink bg-ink text-white' : 'border-border text-muted-foreground hover:bg-muted')}>{t}</button>
            ))}
          </div>
        </div>
        <ul className="divide-y divide-border rounded-2xl border border-border bg-white">
          {shown.map((c, i) => (
            <li key={c.n} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0 flex-1 basis-72 space-y-0.5">
                <p className="text-base font-semibold text-ink">{c.n}</p>
                <p className="text-sm"><span className={cn('font-semibold', c.v === 'Contracting' ? 'text-muted-foreground' : 'text-success')}>{c.v}.</span> {c.why}</p>
                <p className="text-xs text-muted-foreground">{c.fact}</p>
              </div>
              <div className="flex items-center gap-4">
                {c.paths && <a href="#" className={more}>{c.paths}</a>}
                {i === 0 ? <PrimaryButton>Open company</PrimaryButton> : <SecondaryButton>Open company</SecondaryButton>}
              </div>
            </li>
          ))}
          {shown.length === 0 && <li className="p-4 text-sm text-muted-foreground">No tracked company is {traj.toLowerCase()} right now. Choose Any to see them all.</li>}
        </ul>
      </section>

      <HomeFold title="More filters: size, ownership and metro" event="market_intel_filters_toggled">
        <div className="flex flex-wrap items-end gap-3">
          {['Size', 'Ownership', 'Metro'].map((l) => (
            <label key={l} className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">{l}
              <select className="h-9 rounded-lg border border-input bg-transparent px-2 text-sm text-ink"><option>Any</option></select>
            </label>
          ))}
          <SecondaryButton>Apply filters</SecondaryButton>
        </div>
        <p className="text-xs text-muted-foreground">Ownership is confirmed by our team, not guessed. Companies without a confirmed private-equity or venture relationship show as Unknown.</p>
      </HomeFold>

      <HomeFold title="Your weekly market brief" event="market_intel_brief_toggled">
        <p className="text-xs text-muted-foreground">Week of November 2</p>
        <p className="text-base text-ink">Three of your four target companies posted new operations roles. Median posted pay for VP Operations moved up about 2% in Boston.</p>
        <SecondaryButton>Generate this week’s brief</SecondaryButton>
      </HomeFold>

      <HomeFold title="More ways to find the right people" event="market_intel_more_toggled">
        <ul className="space-y-2 text-base text-ink">
          <li>Open any company page and tag where you have worked to see who else worked there and ask them a question.</li>
          <li>Board and advisory openings are part of the Alumni plan. <a href="#" className={more}>See them on Interim work</a></li>
          <li className="text-sm text-muted-foreground">Warm paths come from your own contacts and members who opted in to the insider network, never a purchased list. Your access level: Premium.</li>
        </ul>
      </HomeFold>
    </PreviewShell>
  )
}

function LockRow({ what, tier }: { what: string; tier: string }) {
  return (
    <p className="flex flex-wrap items-center gap-2 rounded-2xl border border-dashed border-border px-5 py-4 text-base text-ink">
      <Lock className="size-4 text-muted-foreground" aria-hidden />
      <span>{what}</span> <span className="text-sm text-muted-foreground">{tier} only.</span> <a href="#" className={more}>See what unlocks it</a>
    </p>
  )
}

export function MarketIntelLocked() {
  return (
    <PreviewShell place="jobs" entry="market" part="market" wide>
      <PageHeader title="Who is hiring and what it pays" />
      <LockRow what="The real posted-salary range for your target, from our own posting data." tier="Premium" />
      <LockRow what="Companies filtered by hiring trend, size, ownership and metro, to build a real target list." tier="Premium" />
      <LockRow what="A weekly summary of openings, pay movement and warm paths at your target companies." tier="Alumni plan" />
    </PreviewShell>
  )
}
