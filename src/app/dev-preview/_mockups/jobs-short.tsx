'use client'

import { useState } from 'react'
import { PreviewShell } from '@/components/candidate/PreviewShell'
import { PageHeader } from '@/components/candidate/PageHeader'
import { NeedsYou } from '@/components/candidate/NeedsYou'
import { HomeFold } from '@/components/candidate/HomeFold'
import { PrimaryButton, SecondaryButton } from '@/components/candidate/ui'
import { ScopeToggle } from '@/components/dashboard/ScopeToggle'
import { ExploreQuestionCard, ExploredOptionsList } from '@/components/dashboard/PivotScopeCards'
import type { ExploredOption, SearchScope } from '@/lib/jobs/search-scope'
import { JobDetail, JobList } from './jobs-find'

// Find a job, shortened to the page contract (docs/candidate-redesign.md). Sample data.
// One tab row (the parts row in the menu frame; on the real page "Job board / My jobs" merges into it), the title alone,
// search, the scope switch as one row, then the jobs. The reconnect and Google prompts wait in the Needs you strip, the
// pivot message, question and explored options sit behind "Where we are looking", and the market claims are one line with
// their reason. The tune strip is one line below the list.

const more = 'text-sm font-medium text-brand underline underline-offset-4'
const OPTIONS: ExploredOption[] = [
  { kind: 'function', value: 'Strategy', on: true, source: 'exploration', at: '' },
  { kind: 'industry', value: 'Healthcare & Hospital Systems', on: false, source: 'exploration', at: '' },
]

export function JobsShort() {
  const [scope, setScope] = useState<SearchScope>('broader')
  return (
    <PreviewShell place="jobs" entry="find" part="jobs" wide>
      <PageHeader title="Find a job" />

      <form className="flex flex-wrap gap-3" role="search" aria-label="Search jobs">
        <input aria-label="Job title, skill or company" className="h-11 min-w-60 flex-1 rounded-full border border-border bg-white px-5 text-base" placeholder='Try "VP finance" or company:Stripe' />
        <input aria-label="City, state or remote" className="h-11 min-w-48 flex-1 rounded-full border border-border bg-white px-5 text-base" placeholder="City, state or Remote" />
        <PrimaryButton>Search jobs</PrimaryButton>
      </form>

      <ScopeToggle surface="find_my_job" current={scope} preview onPreview={setScope} />

      <NeedsYou>
        <p className="rounded-xl bg-white p-4 text-base">Your Gmail connection needs a fresh sign-in. <a href="#" className={more}>Reconnect Gmail</a></p>
        <p className="rounded-xl bg-white p-4 text-base">Connect Google so we can track replies to your applications. <a href="#" className={more}>Connect Google</a></p>
      </NeedsYou>

      <div className="grid items-start gap-6 lg:grid-cols-[26rem_1fr]">
        <div className="space-y-3">
          <p className="text-sm text-ink">
            <span className="font-medium">111 executive jobs in New York or remote.</span>{' '}
            <span className="text-muted-foreground">About 1,200 are open in your field, 14% more than last month.</span>
          </p>
          <JobList />
          <SecondaryButton>Show 10 more</SecondaryButton>
        </div>
        <JobDetail />
      </div>

      <HomeFold title="Where we are looking" event="jobs_scope_fold_toggled">
        <p className="text-sm text-muted-foreground">Broader adds the options you turned on: Strategy roles. Finance stays first.</p>
        <ExploreQuestionCard question={{ kind: 'industry', value: 'Insurance', text: 'Are you exploring a move into Insurance?' }} preview />
        <ExploredOptionsList options={OPTIONS} preview />
      </HomeFold>

      <HomeFold title="Filters and views" event="jobs_filters_fold_toggled">
        <p className="text-sm text-muted-foreground">Past jobs, work type, AI view, fresh or low competition, great employers, seniority, function, sector, requirements, open to career changers, entry level.</p>
      </HomeFold>

      <p className="rounded-2xl bg-muted/50 px-5 py-3 text-sm text-ink">
        <span className="font-semibold">Better jobs for you:</span> matching on executive operations, New York or remote, full-time. Add your tools and about 150 more jobs match.{' '}
        <a href="#" className={more}>Answer two questions</a>
      </p>
      <p className="text-sm"><a href="#" className={more}>Jobs you passed on and other ways to search</a></p>
    </PreviewShell>
  )
}

const MINE: [string, string, string, string][] = [
  ['VP Operations', 'Harbor Health', 'Interviewing', 'Send a thank-you note to Dana Ortiz.'],
  ['Director of Operations', 'Northwind', 'Applied 6 days ago', 'Follow up with Priya Shah.'],
  ['Head of Delivery', 'Lattice Labs', 'Saved', 'Tailor your résumé, then apply.'],
]

export function JobsMine() {
  return (
    <PreviewShell place="jobs" entry="mine" wide>
      <PageHeader title="My jobs" action={<PrimaryButton>Add a job</PrimaryButton>} />
      <ul className="divide-y divide-border rounded-2xl border border-border bg-white" aria-label="My jobs">
        {MINE.map(([t, c, s, n]) => (
          <li key={t} className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="min-w-0">
              <p className="text-base font-semibold text-ink">{t} <span className="text-sm font-normal text-muted-foreground">{c} · {s}</span></p>
              <p className="text-sm text-ink"><span className="font-semibold">Next:</span> {n}</p>
            </div>
            <SecondaryButton>Open</SecondaryButton>
          </li>
        ))}
      </ul>
      <HomeFold title="Applications, email activity and company tracker" event="my_jobs_tracker_fold_toggled">
        <dl className="grid grid-cols-3 gap-3 text-center">
          {[['9', 'applications'], ['3', 'replies'], ['1', 'interview']].map(([v, l]) => (
            <div key={l} className="rounded-xl bg-muted/60 px-2 py-4"><dd className="text-2xl font-semibold tabular-nums text-ink">{v}</dd><dt className="text-xs text-muted-foreground">{l}</dt></div>
          ))}
        </dl>
        <p className="text-sm text-muted-foreground">Search efficiency and conversion by source follow here once you have 10 applications.</p>
      </HomeFold>
    </PreviewShell>
  )
}
