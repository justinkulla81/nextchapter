'use client'

import { useActionState, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Button, buttonVariants } from '@/components/ui/button'
import { saveAppliedJob, type ApplySaveState } from '@/lib/leads/apply-save'
import { posthog } from '@/lib/posthog/client'
import { cn } from '@/lib/utils'
import { SaveJourneyStep } from '@/components/jobs/SaveJourneyStep'
import { JobFitCard } from '@/components/jobs/JobFitCard'

// The Apply button on a public job page plus the one-field "save this job" box under it.
// Control: Apply opens the employer's page in a new tab; this page stays open behind it and the
// box appears, so the person finds it when they come back. Nothing blocks the apply.
// Gate (everyone, owner decision 2026-11-02): Apply first opens a prompt that asks for an email, with alert boxes for new jobs at this
// employer, with this title and in this industry. Saving opens the employer's page the same way, then the fit and account steps follow.
// The skip link stays but is small and muted (owner decision 2026-11-02: ask hard, say why, keep an exit). Someone who already gave an email on this browser (kept in localStorage) goes straight to the employer ('returning').
// Every apply_* event carries `variant` ('gate' or 'returning') so PostHog can compare Apply-through rate and emails captured per job-page view.
type Variant = 'returning' | 'gate'
const EMAIL_KEY = 'nc_apply_email_given_v1'
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function pickVariant(): Variant {
  try {
    return localStorage.getItem(EMAIL_KEY) ? 'returning' : 'gate'
  } catch {
    return 'gate'
  }
}

const noSubscribe = () => () => {}

export function ApplyAndSave({ jobId, company, jobTitle, industry, applyUrl, emailOn, reminderOn }: { jobId: string; company: string; jobTitle: string; industry: string | null; applyUrl: string; emailOn: boolean; reminderOn: boolean }) {
  const [open, setOpen] = useState(false)
  const [trigger, setTrigger] = useState<'apply_click' | 'save_link' | 'apply_gate'>('save_link')
  // Read on the browser only; the server and the first paint say 'gate' (a button, never a bare link), then it settles on the saved variant.
  const variant = useSyncExternalStore<Variant>(noSubscribe, pickVariant, () => 'gate')
  const [gateOpen, setGateOpen] = useState(false)
  const employerLinkRef = useRef<HTMLAnchorElement>(null)
  const [state, action, pending] = useActionState<ApplySaveState, FormData>(saveAppliedJob, undefined)
  const emailRef = useRef<HTMLInputElement>(null)

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

  // Close the gate when a save comes back (adjusting state while rendering, not in an effect).
  const [seenSaved, setSeenSaved] = useState(state?.saved)
  if (state?.saved !== seenSaved) {
    setSeenSaved(state?.saved)
    if (state?.saved) {
      setGateOpen(false)
      try {
        localStorage.setItem(EMAIL_KEY, '1')
      } catch {}
    }
  }

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
              <h2 id="apply-gate-title" className="text-lg font-semibold">Apply at {company}, and get more jobs like this</h2>
              <ul className="mt-2 space-y-1 text-sm">
                <li className="flex gap-2"><span aria-hidden className="text-success">✓</span><span>New jobs like this one in your inbox, so you hear first</span></li>
                <li className="flex gap-2"><span aria-hidden className="text-success">✓</span><span>See if you’d get an interview here, free, about a minute</span></li>
                <li className="flex gap-2"><span aria-hidden className="text-success">✓</span><span>This job saved, with a reminder to follow up</span></li>
              </ul>
              <p className="mt-2 text-xs text-muted-foreground">That’s why we ask for your email. We never share it. Unsubscribe any time.</p>
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
              <fieldset className="mt-4 space-y-2">
                <legend className="text-sm font-medium">Send me new jobs</legend>
                {[
                  { name: 'alert_company', label: `at ${company}`, on: true },
                  { name: 'alert_title', label: `titled ${jobTitle.replace(/\s+[-–—|].*$/, '')}`, on: true },
                  ...(industry ? [{ name: 'alert_industry', label: `in ${industry}`, on: true }] : []),
                ].map((a) => (
                  <label key={a.name} className="flex items-start gap-2 text-sm">
                    <input type="checkbox" name={a.name} value="1" defaultChecked={a.on} className="mt-0.5 size-4" />
                    <span>{a.label}</span>
                  </label>
                ))}
                <p className="text-xs text-muted-foreground">One email a day at most. We ask you to confirm first.</p>
              </fieldset>
              <Button type="submit" disabled={pending} className="mt-4 h-11 w-full rounded-full bg-action px-5 text-action-foreground hover:brightness-95">
                {pending ? 'Saving…' : `Save and go to ${company}`}
              </Button>
              <button
                type="button"
                onClick={() => {
                  posthog.capture('apply_gate_skipped', { jobId, company, variant })
                  employerLinkRef.current?.click()
                  setGateOpen(false)
                }}
                className="mt-4 block w-full text-center text-[11px] text-muted-foreground/70 underline underline-offset-2"
              >
                No thanks, go to the employer site
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
                ? <>Saved. We emailed <span className="font-medium">{state.email}</span> a link back to this job{trigger === 'apply_click' && reminderOn ? ', and we’ll send a reminder in 3 days to follow up' : ''}.</>
                : reminderOn && (trigger === 'apply_click' || trigger === 'apply_gate')
                  ? <>Saved for <span className="font-medium">{state.email}</span>. We’ll email you this job, then a reminder in 3 days to follow up.</>
                  : <>Saved{state.email ? <> for <span className="font-medium">{state.email}</span></> : ''}. Keep this page open to come back to the job.</>}
            </p>
            {!!state.alerts && (
              <p className="mt-2 text-sm text-muted-foreground">
                {emailOn ? `Check ${state.email} to confirm your ${state.alerts === 1 ? 'job alert' : `${state.alerts} job alerts`}. They start after you click the link.` : `Your ${state.alerts === 1 ? 'job alert is' : `${state.alerts} job alerts are`} saved.`}
              </p>
            )}
            <JobFitCard jobId={jobId} placement="after_save" heading="Would you get an interview?" className="mt-3" />
            <SaveJourneyStep email={state.email ?? ''} what="job" properties={{ placement: 'job_saved', jobId, company, trigger }} />
          </div>
        ) : (
          <form
            action={action}
            noValidate
            className={cn('mt-4 rounded-2xl border border-border bg-white p-4', pending && 'cursor-wait')}
            onSubmit={() => posthog.capture('job_save_submitted_client', { jobId, company, trigger })}
          >
            <p className="text-sm font-semibold">{trigger === 'apply_click' ? `Applying to ${company}? We’ll keep track of it for you.` : 'Keep this job and see how you fit.'}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {trigger === 'apply_click' && reminderOn
                ? 'We email you this job now and a reminder in 3 days to follow up. Optional.'
                : emailOn
                  ? 'We email you the job so you can find it again. Then create a free account to see your fit.'
                  : 'Save it with your email, then create a free account to see your fit.'}
            </p>
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
                className="h-11 rounded-full bg-action px-5 text-action-foreground hover:brightness-95"
              >
                {pending ? 'Saving…' : trigger === 'apply_click' && reminderOn ? 'Remind me to follow up' : emailOn ? 'Email me this job' : 'Save this job'}
              </Button>
            </div>
            {state?.error && (
              <p role="alert" className="mt-2 text-sm text-destructive">
                {state.error}
              </p>
            )}
          </form>
        ))}

      {/* After an Apply click the tracking box leads (the one primary action); the fit offer follows it. */}
      {open && trigger === 'apply_click' && !state?.saved && (
        <JobFitCard jobId={jobId} placement="after_apply" heading={`Applied to ${company}? See if you’d get an interview.`} className="mt-4" />
      )}
    </div>
  )
}
