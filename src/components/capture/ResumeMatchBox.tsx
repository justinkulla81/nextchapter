'use client'

import { startTransition, useActionState, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { posthog } from '@/lib/posthog/client'
import { cn } from '@/lib/utils'
import { saveResumeMatch, scoreResumeForJob, type ResumeMatchSummary, type SaveMatchState, type ScoreState } from '@/lib/leads/resume-match'

// The résumé ask on public pages (owner decision 2026-11-18): drop a résumé, get the answer for this job in seconds, give an email
// for the full report. On a layoff page there is no job to score against, so the file and the email go in one step.
// Server side: src/lib/leads/resume-match.ts. The file is kept in the browser between the two steps and stored only with an email.

export const RESUME_EMAIL_KEY = 'nc_apply_email_given_v1'
const BAND_STYLE = { strong: 'text-green-700', good: 'text-green-700', partial: 'text-amber-700', weak: 'text-red-700' } as const
const ACCEPT = '.pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document'

type Common = { company: string; onSaved?: () => void; className?: string; /** Shown under the "check your inbox" note once saved. */ afterSaved?: React.ReactNode }
type Props = (Common & { placement: 'job_top' | 'apply_gate'; jobId: string }) | (Common & { placement: 'layoff'; layoffSlug: string })

export function ResumeMatchBox(props: Props) {
  const { placement, company } = props
  const jobId = 'jobId' in props ? props.jobId : null
  const layoffSlug = 'layoffSlug' in props ? props.layoffSlug : null
  const track = { placement, jobId, company, layoffSlug }

  const [file, setFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [scoreState, score, scoring] = useActionState<ScoreState, FormData>(scoreResumeForJob, undefined)
  const [saveState, save, saving] = useActionState<SaveMatchState, FormData>(saveResumeMatch, undefined)
  const inputRef = useRef<HTMLInputElement>(null)
  const emailRef = useRef<HTMLInputElement>(null)
  const shown = useRef(false)

  const result: ResumeMatchSummary | undefined = saveState?.result ?? scoreState?.result
  const saved = !!saveState?.saved
  const busy = scoring || saving

  useEffect(() => {
    if (shown.current) return
    shown.current = true
    posthog.capture('resume_match_box_shown', track)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (scoreState?.result) {
      posthog.capture('resume_match_scored', { ...track, score: scoreState.result.score, band: scoreState.result.band, missing: scoreState.result.missing.length })
      emailRef.current?.focus()
    }
    if (scoreState?.error) posthog.capture('resume_match_failed', { ...track, step: 'score', error: scoreState.error.slice(0, 80) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scoreState])

  useEffect(() => {
    if (saveState?.saved) {
      try {
        localStorage.setItem(RESUME_EMAIL_KEY, '1')
      } catch {}
      props.onSaved?.()
    }
    if (saveState?.error) posthog.capture('resume_match_failed', { ...track, step: 'save', error: saveState.error.slice(0, 80) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveState])

  function choose(f: File | null | undefined) {
    if (!f) return
    setFile(f)
    posthog.capture('resume_match_file_chosen', { ...track, sizeKb: Math.round(f.size / 1024), type: f.name.split('.').pop()?.toLowerCase() ?? '' })
    if (jobId) {
      const fd = new FormData()
      fd.set('file', f)
      fd.set('jobId', jobId)
      startTransition(() => score(fd))
    } else {
      setTimeout(() => emailRef.current?.focus(), 0)
    }
  }

  const heading =
    placement === 'layoff'
      ? `Laid off from ${company}? See the jobs you fit right now`
      : placement === 'apply_gate'
        ? 'Before you apply: see your match score'
        : 'Will your résumé get you an interview here?'
  const sub =
    placement === 'layoff'
      ? 'Drop your résumé and we rank every open job by how well you fit. Free.'
      : `Drop your résumé and see in seconds how well it matches what ${company} asks for. Free, no account needed.`

  return (
    <section
      aria-labelledby={`rmb-${placement}`}
      data-capture-active={file && !saved ? '' : undefined}
      className={cn('rounded-2xl border-2 border-action/40 bg-white p-5', busy && 'cursor-wait', props.className)}
    >
      {!saved && (
        <>
          <h2 id={`rmb-${placement}`} className="text-lg font-semibold text-navy">{heading}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{sub}</p>
        </>
      )}

      {!file && !saved && (
        <label
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            choose(e.dataTransfer.files?.[0])
          }}
          className={cn(
            'mt-4 flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors',
            dragging ? 'border-action bg-action/5' : 'border-border hover:border-action/60',
          )}
        >
          <span className="font-semibold text-navy">Drop your résumé here, or choose a file</span>
          <span className="text-xs text-muted-foreground">PDF or Word (.docx), up to 10 MB</span>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            className="sr-only"
            aria-label="Choose your résumé file"
            onChange={(e) => choose(e.target.files?.[0])}
          />
        </label>
      )}

      {file && scoring && (
        <p role="status" className="mt-4 text-sm font-medium text-navy">Reading {file.name} and comparing it with this job…</p>
      )}

      {(scoreState?.error || saveState?.error) && !busy && (
        <div className="mt-3">
          <p role="alert" className="text-sm text-destructive">{saveState?.error ?? scoreState?.error}</p>
          {!saveState?.error && (
            <button type="button" onClick={() => setFile(null)} className="mt-1 text-sm font-medium text-brand underline underline-offset-4">
              Choose a different file
            </button>
          )}
        </div>
      )}

      {result && (
        <div className="mt-4">
          <div className="flex flex-wrap items-baseline gap-x-3">
            <p className={cn('text-4xl font-bold tabular-nums', BAND_STYLE[result.band])}>{result.score}%</p>
            <p className="text-lg font-semibold text-navy">{result.bandLabel}</p>
          </div>
          <p className="mt-1 text-sm">
            Your résumé says {result.matched.length} of the {result.compared} things this posting stresses.
            {result.titleInResume === false && ' The job title itself is not on your résumé.'}
          </p>
          {result.missing.length > 0 && (
            <div className="mt-3">
              <p className="text-sm font-semibold text-navy">Missing from your résumé</p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {(saved ? result.missing : result.missing.slice(0, 3)).map((m) => (
                  <li key={m.term} className="rounded-full bg-amber-50 px-3 py-1 text-sm text-amber-900">
                    {m.term}
                    {m.required && <span className="ml-1 text-xs opacity-70">required</span>}
                  </li>
                ))}
                {!saved && result.missing.length > 3 && (
                  <li className="rounded-full bg-off-white px-3 py-1 text-sm text-muted-foreground">+{result.missing.length - 3} more in the full report</li>
                )}
              </ul>
            </div>
          )}
        </div>
      )}

      {file && !saved && (placement === 'layoff' || result) && (
        <form
          action={save}
          noValidate
          className="mt-4"
          onSubmit={(e) => {
            const email = String(new FormData(e.currentTarget).get('email') ?? '').trim()
            posthog.capture('resume_match_email_submitted', { ...track, score: result?.score ?? null })
            if (!email) e.preventDefault()
          }}
        >
          <input type="hidden" name="placement" value={placement} />
          {jobId && <input type="hidden" name="jobId" value={jobId} />}
          {layoffSlug && <input type="hidden" name="layoffSlug" value={layoffSlug} />}
          {placement === 'layoff' && <input type="hidden" name="layoffName" value={company} />}
          <FileField file={file} />
          <div className="hidden" aria-hidden>
            <label htmlFor={`rmb-website-${placement}`}>Website</label>
            <input id={`rmb-website-${placement}`} name="website" type="text" tabIndex={-1} autoComplete="off" />
          </div>
          {placement === 'layoff' && <p className="text-sm text-navy">Résumé: {file.name}</p>}
          <label htmlFor={`rmb-email-${placement}`} className="mt-2 block text-sm font-medium text-navy">
            {placement === 'layoff' ? 'Where should we send your ranked jobs?' : 'Get the full report and jobs you fit better'}
          </label>
          <div className="mt-1 flex flex-col gap-2 sm:flex-row">
            <input
              ref={emailRef}
              id={`rmb-email-${placement}`}
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              defaultValue={saveState?.email}
              placeholder="you@example.com"
              aria-invalid={saveState?.error ? true : undefined}
              className="h-11 w-full rounded-lg border border-border bg-white px-3 text-base sm:flex-1"
            />
            <Button type="submit" disabled={saving} className="h-11 rounded-full bg-action px-5 text-action-foreground hover:brightness-95">
              {saving ? 'Sending…' : placement === 'layoff' ? 'Show me the jobs I fit' : 'Email me the full report'}
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">We keep your résumé private and never share it. Unsubscribe any time.</p>
        </form>
      )}

      {saved && (
        <div role="status" className={cn(result ? 'mt-4 border-t border-border pt-4' : '')}>
          <p className="font-semibold text-navy">Check your inbox{saveState?.email ? ` (${saveState.email})` : ''}.</p>
          <p className="mt-1 text-sm">
            {result
              ? 'Your full report is on its way, with jobs like this one and the link to your free account, which ranks every job by how well you fit.'
              : 'Your link is on its way. Open it and every open job comes back ranked by how well you fit.'}
          </p>
          {props.afterSaved}
        </div>
      )}
    </section>
  )
}

/** Carries the chosen file into the email form's submit (a file input cannot be given a File any other way than a DataTransfer). */
function FileField({ file }: { file: File }) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (!ref.current) return
    try {
      const dt = new DataTransfer()
      dt.items.add(file)
      ref.current.files = dt.files
    } catch {}
  }, [file])
  return <input ref={ref} type="file" name="file" hidden aria-hidden tabIndex={-1} />
}
