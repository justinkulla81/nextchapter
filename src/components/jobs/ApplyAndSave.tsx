'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { Button, buttonVariants } from '@/components/ui/button'
import { saveAppliedJob, type ApplySaveState } from '@/lib/leads/apply-save'
import { posthog } from '@/lib/posthog/client'
import { cn } from '@/lib/utils'
import { SaveJourneyStep } from '@/components/jobs/SaveJourneyStep'
import { JobFitCard } from '@/components/jobs/JobFitCard'

// The Apply button on a public job page plus the one-field "save this job" box under it.
// Control: Apply opens the employer's page in a new tab; this page stays open behind it and the
// box appears, so the person finds it when they come back. Nothing blocks the apply.
// Gate (50% of browsers, kept in localStorage): Apply first opens a small prompt that says why we ask for an
// email. Saving or the "skip" link then opens the employer's page the same way. Every apply_* event carries
// `variant` so PostHog can compare Apply-through rate and emails captured per job-page view.
type Variant = 'control' | 'gate'
const VARIANT_KEY = 'nc_apply_capture_variant'
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function pickVariant(): Variant {
  try {
    const saved = localStorage.getItem(VARIANT_KEY)
    if (saved === 'control' || saved === 'gate') return saved
    const next: Variant = Math.random() < 0.5 ? 'gate' : 'control'
    localStorage.setItem(VARIANT_KEY, next)
    return next
  } catch {
    return 'control'
  }
}

export function ApplyAndSave({ jobId, company, applyUrl, emailOn }: { jobId: string; company: string; applyUrl: string; emailOn: boolean }) {
  const [open, setOpen] = useState(false)
  const [trigger, setTrigger] = useState<'apply_click' | 'save_link' | 'apply_gate'>('save_link')
  const [variant, setVariant] = useState<Variant>('control')
  const [gateOpen, setGateOpen] = useState(false)
  const employerLinkRef = useRef<HTMLAnchorElement>(null)
  const [state, action, pending] = useActionState<ApplySaveState, FormData>(saveAppliedJob, undefined)
  const emailRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const v = pickVariant()
    setVariant(v)
  }, [])

  useEffect(() => {
    if (!gateOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        posthog.capture('apply_gate_dismissed', { jobId, company, variant })
        setGateOpen(false)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [gateOpen, jobId, company, variant])

  useEffect(() => {
    if (state?.saved) setGateOpen(false)
  }, [state?.saved])

  useEffect(() => {
    if (open && trigger === 'save_link') emailRef.current?.focus()
  }, [open, trigger])

  function show(next: 'apply_click' | 'save_link' | 'apply_gate') {
    setTrigger(next)
    if (!open) posthog.capture('job_save_box_shown', { jobId, company, trigger: next })
    setOpen(true)
  }

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        {variant === 'gate' ? (
          // A button, not a link, so the visitor log counts an Apply click only when they actually go to the employer.
          <button
            type="button"
            onClick={() => {
              posthog.capture('apply_gate_shown', { jobId, company, variant })
              setGateOpen(true)
            }}
            className={cn(buttonVariants({ size: 'lg' }), 'h-12 rounded-full bg-action px-6 text-action-foreground hover:brightness-95')}
          >
            Apply on employer site
          </button>
        ) : (
          <a
            href={applyUrl}
            target="_blank"
            rel="noopener noreferrer nofollow"
            onClick={() => {
              posthog.capture('public_job_apply_clicked', { jobId, company, placement: 'top', variant })
              show('apply_click')
            }}
            className={cn(buttonVariants({ size: 'lg' }), 'h-12 rounded-full bg-action px-6 text-action-foreground hover:brightness-95')}
          >
            Apply on employer site
          </a>
        )}
        {/* Gate only: the real link to the employer. Clicking it (by hand or from the prompt) is what counts as an Apply. */}
        <a
          ref={employerLinkRef}
          href={applyUrl}
          target="_blank"
          rel="noopener noreferrer nofollow"
          tabIndex={-1}
          aria-hidden
          className="hidden"
          onClick={() => posthog.capture('public_job_apply_clicked', { jobId, company, placement: 'top', variant })}
        />
        {!open && (
          <button type="button" onClick={() => show('save_link')} className="text-sm font-medium text-brand underline underline-offset-4">
            Save this job
          </button>
        )}
      </div>

      {/* Before Apply is clicked the fit offer sits here on phones (desktop has the side card); after it, the offer leads the box. */}
      {!open && <JobFitCard jobId={jobId} placement="inline" className="mt-5 lg:hidden" />}
      {open && trigger === 'apply_click' && !state?.saved && (
        <JobFitCard jobId={jobId} placement="after_apply" heading={`Applied to ${company}? See if you’d get an interview.`} className="mt-4" />
      )}

      {gateOpen && variant === 'gate' && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center" onClick={() => setGateOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="apply-gate-title"
            className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <form
              action={action}
              noValidate
              onSubmit={(e) => {
                const email = String(new FormData(e.currentTarget).get('email') ?? '').trim()
                posthog.capture('apply_gate_submitted', { jobId, company, variant, valid: EMAIL_SHAPE.test(email) })
                if (!EMAIL_SHAPE.test(email)) return
                // Open the employer's page inside this click, so the browser allows the new tab.
                employerLinkRef.current?.click()
                setTrigger('apply_gate')
                setOpen(true)
              }}
            >
              <h2 id="apply-gate-title" className="text-lg font-semibold">Save this job before you go to {company}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {emailOn
                  ? 'Add your email and we send you this job, so you can find it again and see if you’d get an interview. One email about this job. Unsubscribe any time.'
                  : 'Add your email and we save this job for you, so you can come back to it and see if you’d get an interview.'}
              </p>
              <input type="hidden" name="jobId" value={jobId} />
              <input type="hidden" name="trigger" value="apply_gate" />
              <div className="hidden" aria-hidden>
                <label htmlFor="gate-website">Website</label>
                <input id="gate-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
              </div>
              <label className="sr-only" htmlFor="gate-email">Email address</label>
              <input
                id="gate-email"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoFocus
                defaultValue={state?.email}
                placeholder="you@example.com"
                aria-invalid={state?.error ? true : undefined}
                className="mt-3 h-11 w-full rounded-lg border border-border bg-white px-3 text-base"
              />
              {state?.error && (
                <p role="alert" className="mt-2 text-sm text-destructive">
                  {state.error}
                </p>
              )}
              <Button type="submit" disabled={pending} className="mt-3 h-11 w-full rounded-full bg-action px-5 text-action-foreground hover:brightness-95">
                {pending ? 'Saving…' : `Save and go to ${company}`}
              </Button>
              <button
                type="button"
                onClick={() => {
                  posthog.capture('apply_gate_skipped', { jobId, company, variant })
                  employerLinkRef.current?.click()
                  setGateOpen(false)
                }}
                className="mt-3 block w-full text-center text-xs text-muted-foreground underline underline-offset-4"
              >
                Skip and go to the employer site
              </button>
            </form>
          </div>
        </div>
      )}

      {open && !(trigger === 'apply_gate' && !state?.saved) &&
        (state?.saved ? (
          <div className="mt-4">
            <p role="status" className="rounded-2xl border border-success/30 bg-success/5 px-4 py-3 text-sm">
              {state.emailed
                ? <>Saved. We emailed <span className="font-medium">{state.email}</span> a link back to this job.</>
                : <>Saved{state.email ? <> for <span className="font-medium">{state.email}</span></> : ''}. Keep this page open to come back to the job.</>}
            </p>
            <SaveJourneyStep email={state.email ?? ''} what="job" properties={{ placement: 'job_saved', jobId, company, trigger }} />
          </div>
        ) : (
          <form
            action={action}
            noValidate
            className={cn('mt-4 rounded-2xl border border-border bg-white p-4', pending && 'cursor-wait')}
            onSubmit={() => posthog.capture('job_save_submitted_client', { jobId, company, trigger })}
          >
            <p className="text-sm font-semibold">{trigger === 'apply_click' ? 'Or keep this job for later.' : 'Keep this job and see how you fit.'}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{emailOn ? 'We email you the job so you can find it again. Then create a free account to see your fit.' : 'Save it with your email, then create a free account to see your fit.'}</p>
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
              <Button
                type="submit"
                disabled={pending}
                variant={trigger === 'apply_click' ? 'outline' : 'default'}
                className={cn('h-11 rounded-full px-5', trigger !== 'apply_click' && 'bg-action text-action-foreground hover:brightness-95')}
              >
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
