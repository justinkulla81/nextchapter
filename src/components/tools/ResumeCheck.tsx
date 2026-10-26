'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { emailResumeCheck, runResumeCheck, type ResumeCheckState } from '@/lib/tools/resume-check-actions'
import { posthog } from '@/lib/posthog/client'
import { cn } from '@/lib/utils'

const STATUS_LABEL = { pass: 'Good', partial: 'Fix', fail: 'Fix first' } as const
const STATUS_STYLE = { pass: 'bg-green-50 text-green-800', partial: 'bg-amber-50 text-amber-900', fail: 'bg-red-50 text-red-800' } as const

// Paste a résumé, see the score and how many fixes there are, then leave an email to see the fixes. The email leads to one
// question about where they are in their search. The résumé is read once on the server and never stored.
export function ResumeCheck({ journeyChoices }: { journeyChoices: { slug: string; label: string }[] }) {
  const [resume, setResume] = useState('')
  const [state, run, running] = useActionState<ResumeCheckState, FormData>(runResumeCheck, {})
  const [unlock, sendEmail, unlocking] = useActionState<ResumeCheckState, FormData>(emailResumeCheck, {})
  const started = useRef(false)
  const teaser = state.teaser

  useEffect(() => {
    posthog.capture('resume_check_viewed')
  }, [])

  useEffect(() => {
    if (teaser) posthog.capture('resume_check_result_shown', { score: teaser.score, band: teaser.band, issueCount: teaser.issueCount })
  }, [teaser])

  useEffect(() => {
    if (unlock.token) posthog.capture('resume_check_email_captured', { band: teaser?.band, score: teaser?.score })
  }, [unlock.token, teaser])

  return (
    <div className="mt-8 max-w-2xl space-y-6">
      <form action={run} noValidate className={cn('space-y-4 rounded-xl border border-border bg-white p-6', running && 'cursor-wait')}>
        <label className="block text-sm font-medium text-navy" htmlFor="rc-resume">
          Paste your résumé as text
          <textarea
            id="rc-resume"
            name="resume"
            value={resume}
            onChange={(e) => {
              setResume(e.target.value)
              if (!started.current) {
                started.current = true
                posthog.capture('resume_check_started')
              }
            }}
            rows={12}
            placeholder="Open your résumé, select all, copy, and paste it here."
            className="mt-1 w-full rounded-lg border border-border bg-white p-3 text-base"
          />
        </label>
        <p className="text-xs text-muted-foreground">We read it once to score it and do not save it.</p>
        <Button type="submit" disabled={running} className="h-11 rounded-full bg-action px-6 text-action-foreground hover:brightness-95" onClick={() => posthog.capture('resume_check_submitted', { chars: resume.length })}>
          {running ? 'Checking…' : 'Check my résumé'}
        </Button>
        {state.error && (
          <p role="alert" className="text-sm text-destructive">
            {state.error}
          </p>
        )}
      </form>

      {teaser && (
        <div role="status" className="space-y-4 rounded-xl border border-border bg-white p-6">
          <div className="flex items-baseline gap-3">
            <p className="text-4xl font-bold tabular-nums text-navy">{teaser.score}<span className="text-lg text-muted-foreground"> / 100</span></p>
            <p className="text-lg font-semibold text-navy">{teaser.bandLabel}</p>
          </div>
          <p className="text-sm text-foreground">
            {teaser.issueCount === 0
              ? `All ${teaser.checkCount} checks passed.`
              : `${teaser.issueCount} of ${teaser.checkCount} checks have something to fix. The biggest: ${teaser.topIssue?.toLowerCase()}.`}
          </p>
          <p className="text-xs text-muted-foreground">
            This reads structure and wording with fixed rules: contact details, headings, results with numbers, duty phrases, dates and layout. It cannot tell whether your experience fits a role.
          </p>

          {!unlock.token ? (
            <form action={sendEmail} noValidate className={cn('border-t border-border pt-4', unlocking && 'cursor-wait')} onSubmit={() => posthog.capture('resume_check_email_submitted')}>
              <p className="text-sm font-semibold text-navy">See exactly what to change</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Enter your email to unlock every check with its fix. No account needed.</p>
              <input type="hidden" name="resume" value={resume} />
              <div className="hidden" aria-hidden>
                <label htmlFor="rc-website">Website</label>
                <input id="rc-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
              </div>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <label className="sr-only" htmlFor="rc-email">Email address</label>
                <input id="rc-email" name="email" type="email" inputMode="email" autoComplete="email" defaultValue={unlock.email} placeholder="you@example.com" className="h-11 flex-1 rounded-lg border border-border bg-white px-3 text-base" />
                <Button type="submit" disabled={unlocking} className="h-11 rounded-full bg-action px-5 text-action-foreground hover:brightness-95">
                  {unlocking ? 'Unlocking…' : 'Show my fixes'}
                </Button>
              </div>
              {unlock.error && (
                <p role="alert" className="mt-2 text-sm text-destructive">
                  {unlock.error}
                </p>
              )}
            </form>
          ) : (
            <div className="border-t border-border pt-4">
              <ul className="space-y-3">
                {unlock.findings?.map((f) => (
                  <li key={f.id} className="rounded-lg border border-border p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-navy">{f.label}</p>
                      <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', STATUS_STYLE[f.status])}>
                        {STATUS_LABEL[f.status]} · {f.earned}/{f.points}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{f.detail}</p>
                    {f.status !== 'pass' && <p className="mt-1 text-sm text-foreground">{f.fix}</p>}
                  </li>
                ))}
              </ul>
              <p className="mt-6 text-sm font-semibold text-navy">Which sounds most like you? One tap sets up your free profile.</p>
              <div className="mt-3 flex flex-col gap-2">
                {journeyChoices.map((c, i) => (
                  <Link
                    key={c.slug}
                    href={`/api/job-alerts/journey/${encodeURIComponent(unlock.token!)}?p=${c.slug}`}
                    onClick={() => posthog.capture('resume_check_signup_clicked', { situation: c.slug, band: teaser.band })}
                    className={i === 0 ? 'rounded-full bg-action px-5 py-3 text-center font-semibold text-action-foreground hover:brightness-95' : 'rounded-full border border-border bg-white px-5 py-3 text-center font-medium text-foreground hover:bg-off-white'}
                  >
                    {c.label}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
