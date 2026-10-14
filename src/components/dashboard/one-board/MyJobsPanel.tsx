import Link from 'next/link'
import { Mail } from 'lucide-react'
import type { MyJobsView } from '@/lib/jobs/my-jobs-data'
import { JOB_STATUS_LABEL, type JobStatus } from '@/lib/jobs/my-jobs'
import { WORK_TYPE_CHIP } from '@/lib/jobs/work-type'
import { normalizeOrgName } from '@/lib/text/org-name-match'
import { cn } from '@/lib/utils'
import { ShowMoreList } from '@/components/dashboard/ShowMoreList'
import { JobTrackControls } from './JobTrackControls'
import { ApplyPrompts } from './ApplyPrompts'
import { SkillsGapInsightCard } from './SkillsGapInsightCard'
import { MyJobsViewed } from './MyJobsViewed'
import { ApplicationStatusButtons } from './ApplicationStatusButtons'

const STATUS_STYLE: Record<JobStatus, string> = {
  saved: 'bg-muted text-foreground',
  applied: 'bg-brand/10 text-brand',
  interviewing: 'bg-success/10 text-success',
  offer: 'bg-success/15 text-success',
  closed: 'bg-muted text-muted-foreground',
}

const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

function Funnel({ funnel }: { funnel: MyJobsView['funnel'] }) {
  const steps = [
    { label: 'Opened an application', n: funnel.clicked },
    { label: 'Applied', n: funnel.applied },
    { label: 'Interviewing', n: funnel.interviewing },
    { label: 'Offers', n: funnel.offer },
  ]
  return (
    <ol aria-label="Your search funnel" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {steps.map((s, i) => (
        <li key={s.label} className="rounded-md border border-border bg-card px-3 py-2">
          <p className="text-xl font-semibold text-foreground">{s.n}</p>
          <p className="text-xs text-muted-foreground">
            {s.label}
            {i > 0 && steps[i - 1].n > 0 && s.n > 0 && ` · ${Math.round((100 * s.n) / steps[i - 1].n)}%`}
          </p>
        </li>
      ))}
    </ol>
  )
}

/**
 * My jobs: every job the member saved or applied to, from the board, their Gmail
 * or the Application Tracker — one row per job (a Gmail confirmation for a job
 * they opened from the board is linked to it, never listed twice).
 */
export function MyJobsPanel({ view }: { view: MyJobsView }) {
  const counts = { saved: 0, applied: 0, interviewing: 0, offer: 0, closed: 0 } as Record<JobStatus, number>
  for (const i of view.items) counts[i.status]++
  const fromEmail = view.items.filter((i) => i.origin === 'email').length

  return (
    <section id="my-jobs" aria-labelledby="my-jobs-heading" className="scroll-mt-4 space-y-4">
      <MyJobsViewed saved={counts.saved} applied={counts.applied} interviewing={counts.interviewing} offer={counts.offer} prompts={view.prompts.length} fromEmail={fromEmail} />
      <div>
        <h2 id="my-jobs-heading" className="text-lg font-semibold tracking-tight">
          My jobs
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Jobs you saved or applied to. Applications we find in your connected Gmail show up here on their own.
        </p>
      </div>

      <Funnel funnel={view.funnel} />

      <ApplyPrompts prompts={view.prompts.map((p) => ({ trackedJobId: p.trackedJobId, title: p.title, companyName: p.companyName, clickedOn: fmt(p.clickedAt) }))} />

      {view.insight && <SkillsGapInsightCard insight={view.insight} surface="my_jobs" />}

      {view.items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-6 text-center">
          <p className="text-sm font-medium text-foreground">Nothing saved or applied yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Press Save on a job you like, or I applied once you have. Applications in your connected Gmail appear here too.
          </p>
          <Link href="/dashboard/find-my-job" className="mt-3 inline-block text-sm font-medium text-primary underline underline-offset-4">
            Browse the job board
          </Link>
        </div>
      ) : (
        <div className="divide-y divide-border rounded-md border border-border">
          <ShowMoreList pageSize={10}>
            {view.items.map((item) => (
              <div key={item.key} className="space-y-2 px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {item.url ? (
                        <a href={item.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                          {item.title}
                        </a>
                      ) : (
                        item.title
                      )}
                      {item.companyName && item.title !== item.companyName && <span className="font-normal text-muted-foreground"> at {item.companyName}</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {JOB_STATUS_LABEL[item.status]} {fmt(item.date)}
                      {item.workType && ` · ${WORK_TYPE_CHIP[item.workType]}`}
                      {item.status !== 'closed' && ` · Next: ${item.nextStep}`}
                    </p>
                  </div>
                  <span className="flex items-center gap-1.5">
                    {item.origin === 'email' && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground" title="Found from an application confirmation in your connected Gmail">
                        <Mail className="size-3" aria-hidden /> Found in your email
                      </span>
                    )}
                    <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', STATUS_STYLE[item.status])}>{JOB_STATUS_LABEL[item.status]}</span>
                  </span>
                </div>
                {item.ref ? (
                  <JobTrackControls
                    jobRef={item.ref}
                    initial={{ saved: item.status === 'saved', status: item.status === 'saved' ? null : item.status }}
                    watched={!!item.companyName && view.watchedCompanies.has(normalizeOrgName(item.companyName))}
                    surface="my_jobs"
                  />
                ) : item.jobPostingId && item.status !== 'saved' ? (
                  <ApplicationStatusButtons jobPostingId={item.jobPostingId} title={item.title} initial={item.status} />
                ) : null}
              </div>
            ))}
          </ShowMoreList>
        </div>
      )}
    </section>
  )
}
