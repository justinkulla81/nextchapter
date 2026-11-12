'use client'

import { useState } from 'react'
import { PreviewShell } from '@/components/candidate/PreviewShell'
import { PageHeader } from '@/components/candidate/PageHeader'
import { Avatar, PrimaryButton } from '@/components/candidate/ui'
import { JobDetail } from './jobs-find'
import { cn } from '@/lib/utils'

// Find a job with the quality gate (docs/jobs-report/jooble-footprint-and-plan.md). Sample data.
// Jobs listed on the employer's own career site come first and are the default. Listings from recruiters and job boards
// are one tap away, under their own heading, each saying why it is different. Two choices, so two adjacent buttons
// (design-principles.md). Listings that hide the employer ("Confidential") and junk boards are not shown at all, and
// a job board's listing is hidden when the employer has its own listing of the same job.

type Source = 'direct' | 'all'

interface Row { t: string; c: string; loc: string; pay: string | null; v: string; r: string; fact: string }

const DIRECT: Row[] = [
  { t: 'Chief Financial Officer', c: 'Arsenault', loc: 'New York, NY', pay: '$280–340K', v: 'Good fit', r: 'You have led finance at a company this size.', fact: 'On Arsenault’s career site · Posted 34 hours ago' },
  { t: 'Executive Director', c: 'Byrdcliffe', loc: 'Remote', pay: '$210–250K', v: 'Strong fit', r: 'Your non-profit board work matches what they ask for.', fact: 'On Byrdcliffe’s career site · Posted today' },
  { t: 'Chief Operating Officer', c: 'Intercontinental Exchange', loc: 'New York, NY', pay: '$320–400K', v: 'Worth a look', r: 'You have run operations, but not at this size yet.', fact: 'On the employer’s career site · Posted 3 days ago' },
  { t: 'President', c: 'Lemaitre Vascular', loc: 'Burlington, MA', pay: '$300–380K', v: 'Good fit', r: 'You have led a P&L in a regulated industry.', fact: 'On the employer’s career site · Posted 5 days ago' },
]

const OTHER: Row[] = [
  { t: 'Finance Director', c: 'Robert Half', loc: 'New York, NY', pay: '$230–260K', v: 'Good fit', r: 'Same function, one level down.', fact: 'Posted by a recruiter for a client it does not name' },
  { t: 'VP Finance', c: 'Harbor Health', loc: 'Hybrid, Boston', pay: null, v: 'Good fit', r: 'Same function and level, one industry over.', fact: 'Found on a job board; apply goes through the board' },
  { t: 'Controller', c: 'Kestrel Logistics', loc: 'Remote', pay: '$160–185K', v: 'Worth a look', r: 'You have run the close, but not for a logistics company.', fact: 'Found on a job board; apply goes through the board' },
]

const verdictTone = (v: string) => (v === 'Worth a look' ? 'text-muted-foreground' : 'text-success')

function JobRows({ rows, label }: { rows: Row[]; label: string }) {
  return (
    <ul className="divide-y divide-border rounded-2xl border border-border bg-white" aria-label={label}>
      {rows.map((j, i) => (
        <li key={j.t + j.c} className={cn('flex gap-3 p-4', i === 0 && label === 'Jobs from employers' && 'border-l-[3px] border-l-ink bg-muted/40')}>
          <Avatar name={j.c} />
          <div className="min-w-0 space-y-0.5">
            <p className="text-base leading-snug font-semibold text-ink">{j.t}</p>
            <p className="text-sm text-ink">{j.c} · {j.loc}</p>
            {j.pay && <p className="text-sm text-muted-foreground">{j.pay}</p>}
            <p className="pt-1 text-sm"><span className={cn('font-semibold', verdictTone(j.v))}>{j.v}.</span> {j.r}</p>
            <p className="text-xs text-muted-foreground">{j.fact}</p>
          </div>
        </li>
      ))}
    </ul>
  )
}

/** Two choices, adjacent buttons. The first is the default: the safest and most common. */
function SourceSwitch({ source, onChange }: { source: Source; onChange: (s: Source) => void }) {
  const base = 'inline-flex h-10 items-center px-5 text-sm transition-colors'
  const on = 'bg-muted font-semibold text-ink'
  const off = 'bg-white font-medium text-muted-foreground hover:bg-muted/60'
  return (
    <div role="group" aria-label="Which jobs to show" className="inline-flex overflow-hidden rounded-full border border-ink">
      <button type="button" aria-pressed={source === 'direct'} onClick={() => onChange('direct')} className={cn(base, source === 'direct' ? on : off)}>From employers</button>
      <button type="button" aria-pressed={source === 'all'} onClick={() => onChange('all')} className={cn(base, 'border-l border-ink', source === 'all' ? on : off)}>Employers and recruiters</button>
    </div>
  )
}

function Page({ initial, directRows, moreCount }: { initial: Source; directRows: Row[]; moreCount: number }) {
  const [source, setSource] = useState<Source>(initial)
  const none = directRows.length === 0
  return (
    <PreviewShell place="jobs" entry="find" part="jobs" wide>
      <PageHeader title="Find a job" />

      <form className="flex flex-wrap gap-3" role="search" aria-label="Search jobs">
        <input aria-label="Job title, skill or company" className="h-11 min-w-60 flex-1 rounded-full border border-border bg-white px-5 text-base" placeholder='Try "VP finance" or company:Stripe' />
        <input aria-label="City, state or remote" className="h-11 min-w-48 flex-1 rounded-full border border-border bg-white px-5 text-base" placeholder="City, state or Remote" />
        <PrimaryButton>Search jobs</PrimaryButton>
      </form>

      <div className="space-y-2">
        <SourceSwitch source={source} onChange={setSource} />
        <p className="text-sm text-muted-foreground">
          {source === 'direct'
            ? 'Jobs listed on the employer’s own career site, so you apply to the employer.'
            : 'Employer jobs first. Recruiter and job-board listings follow, marked as such.'}
        </p>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[26rem_1fr]">
        <div className="space-y-3">
          {none && source === 'direct' ? (
            <div className="space-y-3 rounded-2xl border border-border bg-white p-5">
              <p className="text-base font-semibold text-ink">No employer listings match this search yet.</p>
              <p className="text-sm text-muted-foreground">{moreCount} recruiter and job-board listings do. Try them, or widen the search.</p>
              <button type="button" onClick={() => setSource('all')} className="inline-flex h-10 items-center rounded-full border border-border px-5 text-sm font-medium text-ink hover:bg-muted">Show {moreCount} recruiter and job-board listings</button>
            </div>
          ) : (
            <>
              <p className="text-sm font-medium text-ink">{directRows.length === 4 ? '111 executive jobs from employers in New York or remote' : 'Executive jobs'}</p>
              <JobRows rows={directRows} label="Jobs from employers" />
              {source === 'direct' && (
                <p className="text-sm text-muted-foreground">
                  {moreCount} more from recruiters and job boards. The employer may not be named, and you apply through them.{' '}
                  <button type="button" onClick={() => setSource('all')} className="font-medium text-brand underline underline-offset-4">Show them</button>
                </p>
              )}
              {source === 'all' && (
                <>
                  <p className="pt-2 text-sm font-medium text-ink">From recruiters and job boards</p>
                  <JobRows rows={OTHER} label="Jobs from recruiters and job boards" />
                </>
              )}
            </>
          )}
        </div>
        {!(none && source === 'direct') && <JobDetail />}
      </div>
    </PreviewShell>
  )
}

/** The default: employer listings only, with the way to the rest as one line under the list. */
export function QualityGateDirect() {
  return <Page initial="direct" directRows={DIRECT} moreCount={412} />
}

/** Recruiter and job-board listings included: under their own heading, each saying how it differs. */
export function QualityGateAll() {
  return <Page initial="all" directRows={DIRECT} moreCount={412} />
}

/** A narrow search with no employer listing yet: the page says so and offers the other listings. */
export function QualityGateNoDirect() {
  return <Page initial="direct" directRows={[]} moreCount={38} />
}
