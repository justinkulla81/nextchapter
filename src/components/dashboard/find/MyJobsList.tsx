'use client'

import { useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { Mail } from 'lucide-react'
import { Avatar, Chip } from '@/components/candidate/ui'
import { ActionLink } from '@/components/candidate/ActionLink'
import { JobTrackControls } from '@/components/dashboard/one-board/JobTrackControls'
import { ApplicationStatusButtons } from '@/components/dashboard/one-board/ApplicationStatusButtons'
import { ClosedJobAlternatives } from '@/components/jobs/ClosedJobAlternatives'
import type { TrackRef, TrackerFields } from '@/lib/jobs/my-jobs-merge'
import type { KeywordMatch } from '@/lib/jobs/keyword-match'
import { followUpLine, followUpState } from '@/lib/jobs/tracker'
import { JobTrackerPanel } from '@/components/dashboard/find/JobTrackerPanel'
import type { ApplicationStatus, JobStatus } from '@/lib/jobs/my-jobs'
import { CHIP_LABEL, CHIP_TONE, STAGE_FILTERS, countByStatus, matchesFilter, type NextAction, type StageFilter } from '@/lib/jobs/my-jobs-list'
import { posthog } from '@/lib/posthog/client'
import { cn } from '@/lib/utils'

// My jobs in the redesign (mockup: MyJobs in _mockups/jobs-more.tsx): one list, status chips, one next
// action per job. The list is already ordered by status (my-jobs-list.ts sortRows); the buttons above it
// only filter it.

export interface MyJobRow {
  key: string
  title: string
  companyName: string | null
  status: JobStatus
  /** When it got this status (the list is ordered by status, then by this). */
  date: Date
  /** "Applied on Monday". */
  when: string
  action: NextAction | null
  /** The job's page or the listing, for the "Open" button when there is no other step. */
  openHref: string | null
  /** A job found in the member's email rather than saved here. */
  fromEmail: boolean
  jobPostingId: string | null
  ref: TrackRef | null
  watched: boolean
  /** The board job has closed: the sentence saying so, and the job's id for the alternatives links. */
  closed: { sentence: string; jobId: string } | null
  /** The job's own page, shown in the closed note. */
  pageHref: string | null
  /** The member's notes, excitement, follow-up date, checklist and contacts (null until set). */
  tracker?: TrackerFields | null
  /** Resume keyword match against the job, when it has text to match. */
  keywordMatch?: KeywordMatch | null
}

export function MyJobsList({ rows, empty, now = new Date() }: { rows: MyJobRow[]; empty: ReactNode; now?: Date }) {
  const [filter, setFilter] = useState<StageFilter>('all')
  const counts = useMemo(() => countByStatus(rows), [rows])
  const hasOpen = rows.some((r) => r.status !== 'closed')
  const shown = rows.filter((r) => matchesFilter(r.status, filter, hasOpen))
  const filters = STAGE_FILTERS.filter((f) => f.key === 'all' || f.key === filter || counts[f.key] > 0)

  if (rows.length === 0) return <>{empty}</>

  return (
    <div className="space-y-4">
      <div role="group" aria-label="Show jobs by stage" className="flex flex-wrap gap-2">
        {filters.map((f) => {
          const n = f.key === 'all' ? rows.filter((r) => matchesFilter(r.status, 'all', hasOpen)).length : counts[f.key]
          const active = filter === f.key
          return (
            <button
              key={f.key}
              type="button"
              aria-pressed={active}
              onClick={() => {
                setFilter(f.key)
                posthog.capture('my_jobs_stage_filtered', { stage: f.key, count: n })
              }}
              className={cn('rounded-full border px-4 py-1.5 text-sm font-medium', active ? 'border-ink bg-ink text-white' : 'border-border text-muted-foreground hover:text-ink')}
            >
              {f.label} <span className="tabular-nums">{n}</span>
            </button>
          )
        })}
      </div>

      {shown.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground" role="status">
          Nothing here yet. Jobs move into this stage when you change their status.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-2xl border border-border" aria-label="Your jobs">
          {shown.map((r) => (
            <li key={r.key} className="space-y-3 p-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex min-w-0 flex-1 gap-4">
                  <Avatar name={r.companyName ?? r.title} />
                  <div className="min-w-0 space-y-0.5">
                    <p className="text-base font-semibold text-ink">
                      {r.title}
                      {r.companyName && r.companyName !== r.title && <span className="font-normal text-muted-foreground"> · {r.companyName}</span>}
                    </p>
                    <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
                      {r.when}
                      {r.tracker && followUpLine(r.tracker.followUpAt, r.tracker.followUpDoneAt, now) && (
                        <span className={cn(followUpState(r.tracker.followUpAt, r.tracker.followUpDoneAt, now) === 'due' && 'font-semibold text-ink')}>
                          · {followUpLine(r.tracker.followUpAt, r.tracker.followUpDoneAt, now)}
                        </span>
                      )}
                      {r.tracker?.excitement && <span aria-label={`Excitement ${r.tracker.excitement} of 5`}>· {'★'.repeat(r.tracker.excitement)}</span>}
                      {r.fromEmail && (
                        <span className="inline-flex items-center gap-1" title="Found from an application confirmation in your connected Gmail">
                          <Mail className="size-3" aria-hidden /> Found in your email
                        </span>
                      )}
                    </p>
                    {r.action && (
                      <p className="text-sm text-ink">
                        <span className="font-semibold">Next:</span> {r.action.label}. {r.action.reason}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Chip tone={CHIP_TONE[r.status]}>{CHIP_LABEL[r.status]}</Chip>
                  <RowAction row={r} />
                </div>
              </div>
              {r.closed && (
                <div role="status" className="space-y-1 rounded-xl bg-muted px-4 py-3">
                  <p className="text-sm text-ink">
                    {r.closed.sentence}{' '}
                    {r.pageHref && (
                      <Link href={r.pageHref} className="text-muted-foreground underline underline-offset-4">
                        View the job
                      </Link>
                    )}
                  </p>
                  <ClosedJobAlternatives jobId={r.closed.jobId} companyName={r.companyName} title={r.title} surface="my_jobs" />
                </div>
              )}
              <details
                className="text-sm"
                onToggle={(e) => {
                  if ((e.currentTarget as HTMLDetailsElement).open) posthog.capture('my_job_details_opened', { jobKey: r.key, status: r.status, hasNotes: !!r.tracker, keywordScore: r.keywordMatch?.score ?? null })
                }}
              >
                <summary className="cursor-pointer text-sm font-medium text-brand underline underline-offset-4">Status, notes and checklist</summary>
                <div className="pt-2">
                  {r.ref ? (
                    <JobTrackControls
                      jobRef={r.ref}
                      initial={{ saved: r.status === 'saved', status: r.status === 'saved' ? null : (r.status as ApplicationStatus) }}
                      watched={r.watched}
                      surface="my_jobs"
                    />
                  ) : r.jobPostingId ? (
                    <ApplicationStatusButtons jobPostingId={r.jobPostingId} title={r.title} initial={r.status === 'saved' ? null : (r.status as ApplicationStatus)} />
                  ) : (
                    <p className="text-sm text-muted-foreground">Open the job to change its status.</p>
                  )}
                </div>
                <JobTrackerPanel
                  row={{ itemKey: r.key, title: r.title, companyName: r.companyName }}
                  status={r.status}
                  statusDate={r.date}
                  tracker={r.tracker ?? null}
                  keywordMatch={r.keywordMatch ?? null}
                  now={now}
                />
              </details>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** The row's one button: its next step when that goes somewhere, otherwise opening the job. */
function RowAction({ row }: { row: MyJobRow }) {
  const href = row.action?.href ?? row.openHref
  if (!href) return null
  const label = row.action?.href ? row.action.label : 'Open'
  const external = /^https?:/i.test(href)
  return (
    <ActionLink href={href} external={external} event="my_job_action_clicked" props={{ jobKey: row.key, status: row.status, action: label }}>
      {label}
    </ActionLink>
  )
}
