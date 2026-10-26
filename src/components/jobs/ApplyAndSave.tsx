'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { Button, buttonVariants } from '@/components/ui/button'
import { saveAppliedJob, type ApplySaveState } from '@/lib/leads/apply-save'
import { posthog } from '@/lib/posthog/client'
import { cn } from '@/lib/utils'

// The Apply button on a public job page plus the one-field "save this job" box under it.
// Apply still opens the employer's page in a new tab; this page stays open behind it and the
// box appears, so the person finds it when they come back. Nothing blocks the apply.
export function ApplyAndSave({ jobId, company, applyUrl, emailOn }: { jobId: string; company: string; applyUrl: string; emailOn: boolean }) {
  const [open, setOpen] = useState(false)
  const [trigger, setTrigger] = useState<'apply_click' | 'save_link'>('save_link')
  const [state, action, pending] = useActionState<ApplySaveState, FormData>(saveAppliedJob, undefined)
  const emailRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open && trigger === 'save_link') emailRef.current?.focus()
  }, [open, trigger])

  function show(next: 'apply_click' | 'save_link') {
    setTrigger(next)
    if (!open) posthog.capture('job_save_box_shown', { jobId, company, trigger: next })
    setOpen(true)
  }

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <a
          href={applyUrl}
          target="_blank"
          rel="noopener noreferrer nofollow"
          onClick={() => {
            posthog.capture('public_job_apply_clicked', { jobId, company, placement: 'top' })
            show('apply_click')
          }}
          className={cn(buttonVariants({ size: 'lg' }), 'h-12 rounded-full bg-action px-6 text-action-foreground hover:brightness-95')}
        >
          Apply on employer site
        </a>
        {!open && (
          <button type="button" onClick={() => show('save_link')} className="text-sm font-medium text-brand underline underline-offset-4">
            Save this job
          </button>
        )}
      </div>

      {open &&
        (state?.saved ? (
          <p role="status" className="mt-4 rounded-2xl border border-success/30 bg-success/5 px-4 py-3 text-sm">
            {state.emailed
              ? <>Saved. We emailed <span className="font-medium">{state.email}</span> a link back to this job.</>
              : <>Saved{state.email ? <> for <span className="font-medium">{state.email}</span></> : ''}. Keep this page open to come back to the job.</>}
          </p>
        ) : (
          <form
            action={action}
            noValidate
            className={cn('mt-4 rounded-2xl border border-border bg-white p-4', pending && 'cursor-wait')}
            onSubmit={() => posthog.capture('job_save_submitted_client', { jobId, company, trigger })}
          >
            <p className="text-sm font-semibold">{trigger === 'apply_click' ? `Applying to ${company}? Keep a link to this job.` : 'Keep a link to this job.'}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{emailOn ? 'We email you the job so you can find it again. No account or password.' : 'Save it with your email. No account or password.'}</p>
            <input type="hidden" name="jobId" value={jobId} />
            <input type="hidden" name="trigger" value={trigger} />
            <div className="hidden" aria-hidden>
              <label htmlFor="save-website">Website</label>
              <input id="save-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
            </div>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <label className="sr-only" htmlFor="save-email">Email address</label>
              <input
                ref={emailRef}
                id="save-email"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                defaultValue={state?.email}
                placeholder="you@example.com"
                aria-invalid={state?.error ? true : undefined}
                className="h-11 flex-1 rounded-lg border border-border bg-white px-3 text-base"
              />
              <Button type="submit" disabled={pending} className="h-11 rounded-full bg-action px-5 text-action-foreground hover:brightness-95">
                {pending ? 'Saving…' : (emailOn ? 'Email me this job' : 'Save this job')}
              </Button>
            </div>
            {state?.error && (
              <p role="alert" className="mt-2 text-sm text-destructive">
                {state.error}
              </p>
            )}
          </form>
        ))}
    </div>
  )
}
