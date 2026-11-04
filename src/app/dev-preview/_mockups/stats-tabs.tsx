'use client'

import { useState } from 'react'
import { Award, Briefcase, Flame, Send, Trophy } from 'lucide-react'
import { PreviewShell } from '@/components/candidate/PreviewShell'
import { PageHeader } from '@/components/candidate/PageHeader'
import { HomeFold } from '@/components/candidate/HomeFold'
import { PrimaryButton, SecondaryButton } from '@/components/candidate/ui'
import { StatTile } from '@/components/dashboard/StatTile'
import { cn } from '@/lib/utils'

// Your stats (the "see all" view of Effort and results), split by purpose into four tabs instead of one long page with a jump-to-section bar.
// Sample data; the stat tile is the real component. In the built page only the open tab loads its data.

const more = 'text-sm font-medium text-brand underline underline-offset-4'
const TABS = ['Progress', 'Leaderboards', 'This week', 'How you feel'] as const

const BOARDS = [
  { t: 'Weekly effort', rank: 'Top 12%', note: 'Minutes of real search work this week' },
  { t: 'Conversations', rank: 'Top 25%', note: 'Outreach messages sent this month' },
  { t: 'Applications', rank: 'Top 40%', note: 'Applications sent this month' },
]
const ACTIONS = [
  ['Send 5 applications that fit you', '3 of 5 done', 'Applying'],
  ['Message one person who already likes you', 'Done', 'Networking'],
  ['Finish the SQL course module', 'Not started', 'Learning'],
]

export function StatsTabsMock() {
  const [tab, setTab] = useState<(typeof TABS)[number]>('Progress')
  return (
    <PreviewShell place="home" entry="progress" part="built">
      <PageHeader title="Your stats" action={<a href="#" className={more}>Back to effort and results</a>} />
      <div role="tablist" aria-label="Your stats" className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button key={t} role="tab" type="button" aria-selected={tab === t} onClick={() => setTab(t)} className={cn('rounded-full border px-4 py-1.5 text-sm font-medium', tab === t ? 'border-ink bg-ink text-white' : 'border-border text-muted-foreground hover:bg-muted')}>{t}</button>
        ))}
      </div>

      {tab === 'Progress' && (
        <section aria-label="Progress" className="space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile icon={Flame} value="12" label="day streak" accent="warning" />
            <StatTile icon={Trophy} value="21" label="longest streak" accent="brand" />
            <StatTile icon={Send} value="38" label="jobs applied, total" accent="brand" />
            <StatTile icon={Briefcase} value="5" label="jobs applied, this week" accent="warning" />
          </div>
          <div className="space-y-3 rounded-2xl bg-ink p-5 text-white">
            <h2 className="font-display text-xl font-semibold">Candidate+ is 2 of 5 steps away</h2>
            <p className="text-sm text-white/80">Recruiters and hiring managers see Candidate+ members. You need 2 references and 10 applications.</p>
            <PrimaryButton>Add your next reference</PrimaryButton>
          </div>
          <HomeFold title="Badges: 7 of 24 earned" event="stats_badges_toggled">
            <div className="flex flex-wrap gap-2">
              {['First application', '4-day week', 'First reference', 'Profile complete', 'First interview', '30 conversations', 'SQL course'].map((b) => (
                <span key={b} className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-3 py-1 text-sm font-medium text-success"><Award className="size-3.5" aria-hidden />{b}</span>
              ))}
            </div>
          </HomeFold>
        </section>
      )}

      {tab === 'Leaderboards' && (
        <section aria-label="Leaderboards" className="space-y-3">
          <p className="text-base text-ink">Where your effort stands among members like you. Only people who opt in appear by name; your own rank is always private to you.</p>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <label className="flex items-center gap-2 font-medium text-ink">Compare with
              <select className="h-9 rounded-lg border border-input bg-transparent px-2 text-sm"><option>All members</option><option>My seniority</option><option>My function</option></select>
            </label>
          </div>
          <ul className="divide-y divide-border rounded-2xl border border-border bg-white">
            {BOARDS.map((b) => (
              <li key={b.t} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div><p className="text-base font-semibold text-ink">{b.t}</p><p className="text-sm text-muted-foreground">{b.note}</p></div>
                <p className="text-base font-semibold text-ink">{b.rank}</p>
              </li>
            ))}
          </ul>
          <HomeFold title="Your leaderboard badges" event="stats_leaderboard_badges_toggled"><p className="text-base text-ink">Top 3 finish, week of October 19: Weekly effort.</p></HomeFold>
        </section>
      )}

      {tab === 'This week' && (
        <section aria-label="This week" className="space-y-4">
          <p className="text-base text-ink"><span className="font-semibold">105 of 150 minutes</span> this week. <span className="text-muted-foreground">1 point = 1 minute. You are on track for Friday.</span></p>
          <ul className="divide-y divide-border rounded-2xl border border-border bg-white">
            {ACTIONS.map(([a, s, e]) => (
              <li key={a} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div><p className="text-base font-semibold text-ink">{a}</p><p className="text-sm text-muted-foreground">{e} · {s}</p></div>
              </li>
            ))}
          </ul>
          <HomeFold title="Every action you could do" event="stats_all_actions_toggled"><p className="text-sm text-muted-foreground">Applying, networking, learning, preparing and tracking: the full menu with the points each is worth.</p></HomeFold>
          <p className="text-sm text-ink">Want to see what drives your odds? <a href="#" className={more}>Open your market report</a></p>
        </section>
      )}

      {tab === 'How you feel' && (
        <section aria-label="How you feel" className="space-y-3">
          <p className="text-base text-ink">Your last check-ins, oldest to newest: Getting there, Moving, Moving, Fired up.</p>
          <p className="text-sm text-muted-foreground">Only you can see this. Three weeks of Moving and Fired up after a Getting there week is a good sign.</p>
          <SecondaryButton>Do a check-in now</SecondaryButton>
        </section>
      )}
    </PreviewShell>
  )
}
