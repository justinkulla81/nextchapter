'use client'

import { useState, useTransition } from 'react'
import { Bookmark, BookmarkCheck, Eye } from 'lucide-react'
import { cn } from '@/lib/utils'
import { APPLICATION_STATUSES, JOB_STATUS_LABEL, type ApplicationStatus } from '@/lib/jobs/my-jobs'
import type { CardTrackState, TrackRef } from '@/lib/jobs/my-jobs-data'
import { setCompanyWatched, setJobSaved, setJobStatus } from '@/app/dashboard/find-my-job/my-jobs-actions'

/**
 * Save / Applied → Interviewing → Offer → Closed / Watch company, on any board job.
 * Optimistic: the buttons change at once and roll back with an explanation if the
 * save fails.
 */
export function JobTrackControls({
  jobRef,
  initial,
  watched: initialWatched,
  companyId,
  surface = 'card',
  showWatch = true,
}: {
  jobRef: TrackRef
  initial?: CardTrackState
  watched?: boolean
  companyId?: string | null
  surface?: 'card' | 'my_jobs'
  showWatch?: boolean
}) {
  const [saved, setSaved] = useState(initial?.saved ?? false)
  const [status, setStatus] = useState<ApplicationStatus | null>(initial?.status ?? null)
  const [watched, setWatched] = useState(!!initialWatched)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function run(apply: () => void, rollback: () => void, call: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null)
    apply()
    startTransition(async () => {
      const r = await call()
      if (!r.ok) {
        rollback()
        setError(r.error ?? 'That did not save. Try again.')
      }
    })
  }

  const toggleSave = () => {
    const before = saved
    run(() => setSaved(!before), () => setSaved(before), () => setJobSaved(jobRef, !before))
  }
  const changeStatus = (to: ApplicationStatus) => {
    if (to === status) return
    const before = status
    run(() => setStatus(to), () => setStatus(before), () => setJobStatus(jobRef, to, surface))
  }
  const toggleWatch = () => {
    if (!jobRef.companyName) return
    const before = watched
    run(() => setWatched(!before), () => setWatched(before), () => setCompanyWatched(jobRef.companyName!, !before, companyId ?? null))
  }

  const btn = 'inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium'
  return (
    <div className={cn('space-y-1', pending && 'cursor-wait')} aria-busy={pending}>
      <div className="flex flex-wrap items-center gap-2">
        {!status && (
          <button
            type="button"
            onClick={toggleSave}
            aria-pressed={saved}
            className={cn(btn, saved ? 'border-primary bg-primary/10 text-foreground' : 'border-border bg-background text-foreground', pending && 'cursor-wait')}
          >
            {saved ? <BookmarkCheck className="size-3.5" aria-hidden /> : <Bookmark className="size-3.5" aria-hidden />}
            {saved ? 'Saved' : 'Save'}
          </button>
        )}
        {status ? (
          <div role="group" aria-label={`Application status for ${jobRef.title}`} className="flex flex-wrap gap-1">
            {APPLICATION_STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => changeStatus(s)}
                aria-pressed={status === s}
                className={cn(
                  btn,
                  status === s ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background text-foreground',
                  pending && 'cursor-wait'
                )}
              >
                {JOB_STATUS_LABEL[s]}
              </button>
            ))}
          </div>
        ) : (
          <button type="button" onClick={() => changeStatus('applied')} className={cn(btn, 'border-border bg-background text-foreground', pending && 'cursor-wait')}>
            I applied
          </button>
        )}
        {showWatch && jobRef.companyName && (
          <button
            type="button"
            onClick={toggleWatch}
            aria-pressed={watched}
            className={cn(btn, watched ? 'border-primary bg-primary/10 text-foreground' : 'border-border bg-background text-foreground', pending && 'cursor-wait')}
          >
            <Eye className="size-3.5" aria-hidden />
            {watched ? `Watching ${jobRef.companyName}` : 'Watch company'}
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
