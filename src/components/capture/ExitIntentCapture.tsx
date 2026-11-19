'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { posthog } from '@/lib/posthog/client'
import { cn } from '@/lib/utils'
import { saveAppliedJob, type ApplySaveState } from '@/lib/leads/apply-save'
import { RESUME_EMAIL_KEY } from '@/components/capture/ResumeMatchBox'

// "Get jobs like this every morning" on a public job page (owner decision 2026-11-18): shown once per browser session, when the
// pointer leaves the top of the window (going for the tab bar or the back button) or after 40 seconds without giving an email.
// Never shown to someone who already gave an email on this browser, or while they are typing in a field. It saves the job and
// switches on alerts for this title and industry through the same action as the Apply prompt (src/lib/leads/apply-save.ts), so
// the alert is still confirmed by email.

const DISMISSED_KEY = 'nc_exit_capture_seen_v1'
const IDLE_MS = 40_000
const ARM_MS = 5_000
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function alreadyHandled(): boolean {
  try {
    return !!localStorage.getItem(RESUME_EMAIL_KEY) || !!sessionStorage.getItem(DISMISSED_KEY)
  } catch {
    return false
  }
}

export function ExitIntentCapture({ jobId, company, jobTitle, industry }: { jobId: string; company: string; jobTitle: string; industry: string | null }) {
  const [open, setOpen] = useState(false)
  const [trigger, setTrigger] = useState<'exit' | 'idle'>('exit')
  const [state, action, pending] = useActionState<ApplySaveState, FormData>(saveAppliedJob, undefined)
  const emailRef = useRef<HTMLInputElement>(null)
  const props = { jobId, company }

  useEffect(() => {
    if (alreadyHandled()) return
    let armed = false
    let fired = false
    const show = (why: 'exit' | 'idle') => {
      if (fired || alreadyHandled()) return
      const active = document.activeElement
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return
      // Mid-way through the résumé match box: let them finish.
      if (document.querySelector('[data-capture-active]')) return
      fired = true
      try {
        sessionStorage.setItem(DISMISSED_KEY, '1')
      } catch {}
      setTrigger(why)
      setOpen(true)
      posthog.capture('exit_capture_shown', { ...props, trigger: why })
    }
    const arm = setTimeout(() => (armed = true), ARM_MS)
    const idle = setTimeout(() => show('idle'), IDLE_MS)
    const onOut = (e: MouseEvent) => {
      if (armed && !e.relatedTarget && e.clientY <= 0) show('exit')
    }
    document.addEventListener('mouseout', onOut)
    return () => {
      clearTimeout(arm)
      clearTimeout(idle)
      document.removeEventListener('mouseout', onOut)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!open) return
    emailRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (!state?.saved) return
    try {
      localStorage.setItem(RESUME_EMAIL_KEY, '1')
    } catch {}
  }, [state?.saved])

  function close() {
    if (!state?.saved) posthog.capture('exit_capture_dismissed', { ...props, trigger })
    setOpen(false)
  }

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center" onClick={close}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="exit-capture-title"
        onClick={(e) => e.stopPropagation()}
        className={cn('w-full max-w-md rounded-2xl bg-white p-6 shadow-xl', pending && 'cursor-wait')}
      >
        {state?.saved ? (
          <div role="status">
            <h2 id="exit-capture-title" className="text-xl font-semibold text-navy">You are on the list</h2>
            <p className="mt-2 text-sm">Confirm in your inbox and new jobs like this one start arriving, one email a day at most. We saved this job for you too.</p>
            <Button type="button" onClick={() => setOpen(false)} className="mt-4 h-11 w-full rounded-full bg-action px-5 text-action-foreground hover:brightness-95">
              Back to the job
            </Button>
          </div>
        ) : (
          <form
            action={action}
            noValidate
            onSubmit={(e) => {
              const email = String(new FormData(e.currentTarget).get('email') ?? '').trim()
              posthog.capture('exit_capture_submitted', { ...props, trigger, valid: EMAIL_SHAPE.test(email) })
            }}
          >
            <h2 id="exit-capture-title" className="text-xl font-semibold text-navy">Get jobs like this every morning</h2>
            <p className="mt-2 text-sm">
              New {jobTitle} jobs{industry ? ` and more in ${industry}` : ''}, the day they open, before they fill. One email a day at most.
            </p>
            <input type="hidden" name="jobId" value={jobId} />
            <input type="hidden" name="trigger" value="save_link" />
            <input type="hidden" name="alert_title" value="1" />
            {industry && <input type="hidden" name="alert_industry" value="1" />}
            <div className="hidden" aria-hidden>
              <label htmlFor="exit-website">Website</label>
              <input id="exit-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
            </div>
            <label htmlFor="exit-email" className="sr-only">Email address</label>
            <input
              ref={emailRef}
              id="exit-email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              defaultValue={state?.email}
              placeholder="you@example.com"
              aria-invalid={state?.error ? true : undefined}
              className="mt-4 h-11 w-full rounded-lg border border-border bg-white px-3 text-base"
            />
            {state?.error && <p role="alert" className="mt-2 text-sm text-destructive">{state.error}</p>}
            <Button type="submit" disabled={pending} className="mt-3 h-11 w-full rounded-full bg-action px-5 text-action-foreground hover:brightness-95">
              {pending ? 'Saving…' : 'Send me jobs like this'}
            </Button>
            <p className="mt-2 text-xs text-muted-foreground">We ask you to confirm by email first. Unsubscribe any time.</p>
            <button type="button" onClick={close} className="mt-3 block w-full text-center text-xs text-muted-foreground underline underline-offset-2">
              No thanks
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
