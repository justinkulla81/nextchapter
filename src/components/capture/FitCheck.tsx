'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { submitFitLead, type FitLeadState } from '@/lib/leads/fit-lead'
import { checkFit, checkFitItems, fitWords, type FitResult } from '@/lib/capture/fit-check'
import { MARKET_REALITY_START_HREF } from '@/lib/onboarding/resume-rule'
import { posthog } from '@/lib/posthog/client'
import { ALL_STATE_CODES, stateName } from '@/lib/seo/states'
import { cn } from '@/lib/utils'

const FIELD = 'h-11 w-full rounded-lg border border-border bg-white px-3 text-base'

/**
 * "How would your résumé fare?" on an industry or job-title page. Left: paste a résumé and see which of this page's skills it says
 * (runs in the browser, nothing is sent). Right: tell us your state and email, optionally attach the résumé, and we file it
 * (components/capture/FitCheck -> lib/leads/fit-lead). The skills are the ones the page's openings name most often.
 */
export function FitCheck({ label, source, skills, aiSkills }: { label: string; source: string; skills: string[]; aiSkills: { label: string; words: string[] }[] }) {
  const [resume, setResume] = useState('')
  const [fit, setFit] = useState<FitResult | null>(null)
  const [aiFit, setAiFit] = useState<FitResult | null>(null)
  const [state, action, pending] = useActionState<FitLeadState, FormData>(submitFitLead, undefined)

  function run() {
    const f = checkFit(resume, skills)
    setFit(f)
    setAiFit(aiSkills.length ? checkFitItems(resume, aiSkills) : null)
    posthog.capture('fit_check_run', { source, skills: skills.length, coveredCount: f.covered.length, fitPct: f.pct, resumeChars: resume.length })
  }

  return (
    <section aria-labelledby="fit-heading" className="mt-8 overflow-hidden rounded-3xl border border-border bg-white">
      <div className="bg-gradient-to-r from-brand to-light-blue px-6 py-5 text-white sm:px-8">
        <h2 id="fit-heading" className="text-2xl font-bold tracking-tight">How would your résumé fare for {label.toLowerCase()}?</h2>
        <p className="mt-1 max-w-2xl text-sm text-white/90">Paste it to see which skills these openings ask for and which your résumé leaves out. It runs here in your browser, so nothing you paste is sent.</p>
      </div>
      <div className="grid gap-0 md:grid-cols-2">
        <div className="bg-tint-sky p-6 sm:p-8">
          <label htmlFor="fit-resume" className="text-sm font-semibold text-navy">Your résumé, as text</label>
          <textarea
            id="fit-resume"
            value={resume}
            onChange={(e) => setResume(e.target.value)}
            rows={7}
            placeholder="Paste the text of your résumé here"
            className="mt-2 w-full rounded-lg border border-border bg-white p-3 text-base"
          />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button type="button" onClick={run} disabled={resume.trim().length < 80} className="h-11 rounded-full bg-action px-5 text-action-foreground hover:brightness-95">
              Check my résumé
            </Button>
            {resume.trim().length < 80 && <span className="text-xs text-muted-foreground">Paste at least a few lines to check it.</span>}
          </div>
          {fit && (
            <div role="status" className="mt-5">
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold tabular-nums text-navy">{fit.pct}%</span>
                <span className="text-sm text-muted-foreground">of the top skills named in {label.toLowerCase()} openings</span>
              </div>
              <div className="mt-2 h-3 overflow-hidden rounded-full bg-white" aria-hidden>
                <div className={cn('h-full rounded-full', fit.pct >= 70 ? 'bg-success' : fit.pct >= 40 ? 'bg-warning' : 'bg-orange')} style={{ width: `${Math.max(fit.pct, 4)}%` }} />
              </div>
              <p className="mt-2 text-sm text-navy">{fitWords(fit.pct)}</p>
              {fit.covered.length > 0 && (
                <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-tint-mint-ink">On your résumé</p>
              )}
              <ul className="mt-1 flex flex-wrap gap-1.5">
                {fit.covered.map((s) => <li key={s} className="rounded-full bg-tint-mint px-2.5 py-1 text-xs font-medium text-tint-mint-ink">{s}</li>)}
              </ul>
              {fit.missing.length > 0 && (
                <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-tint-sun-ink">Not on your résumé yet</p>
              )}
              <ul className="mt-1 flex flex-wrap gap-1.5">
                {fit.missing.map((s) => <li key={s} className="rounded-full bg-tint-sun px-2.5 py-1 text-xs font-medium text-tint-sun-ink">{s}</li>)}
              </ul>
              {aiFit && (
                <>
                  <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-tint-plum-ink">AI skills worth having</p>
                  <ul className="mt-1 flex flex-wrap gap-1.5">
                    {[...aiFit.covered.map((s) => [s, true] as const), ...aiFit.missing.map((s) => [s, false] as const)].map(([s, has]) => (
                      <li key={s} className={cn('rounded-full px-2.5 py-1 text-xs font-medium', has ? 'bg-tint-plum text-tint-plum-ink' : 'border border-tint-plum-ink/30 bg-white text-tint-plum-ink')}>{has ? '✓ ' : ''}{s}</li>
                    ))}
                  </ul>
                </>
              )}
              <p className="mt-3 text-xs text-muted-foreground">This compares wording only. Add a skill only where you have really done the work.</p>
            </div>
          )}
        </div>

        <div className="bg-tint-sun p-6 sm:p-8">
          {state?.sent ? (
            <div role="status" className="text-sm text-navy">
              <p className="text-lg font-bold">Thanks. We have it.</p>
              <p className="mt-2">{state.hasFile ? `We sent a confirmation to ${state.email}.` : `We saved your email and state.`} For the full picture, with how recruiters read your whole background and every open job ranked for you:</p>
              <Link
                href={MARKET_REALITY_START_HREF}
                onClick={() => posthog.capture('fit_market_reality_clicked', { source })}
                className="mt-4 inline-flex h-11 items-center rounded-full bg-action px-5 text-sm font-semibold text-action-foreground hover:brightness-95"
              >
                Get my free assessment
              </Link>
            </div>
          ) : (
            <form action={action} noValidate onSubmit={() => posthog.capture('fit_lead_submitted_client', { source, ran: !!fit, fitPct: fit?.pct ?? null })} className={cn('space-y-3', pending && 'cursor-wait')}>
              <h3 className="text-lg font-bold text-navy">Make it yours</h3>
              <p className="text-sm text-navy/80">Tell us your state and where to reach you. Attach your résumé if you want a real read on it.</p>
              <input type="hidden" name="source" value={source} />
              <input type="hidden" name="label" value={label} />
              <input type="hidden" name="pct" value={fit?.pct ?? ''} />
              <div className="hidden" aria-hidden>
                <label htmlFor="fit-website">Website</label>
                <input id="fit-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
              </div>
              <div>
                <label htmlFor="fit-state" className="text-sm font-semibold text-navy">Your state</label>
                <select id="fit-state" name="state" defaultValue="" className={cn(FIELD, 'mt-1')}>
                  <option value="" disabled>Choose a state</option>
                  {ALL_STATE_CODES.map((c) => <option key={c} value={c}>{stateName(c)}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="fit-email" className="text-sm font-semibold text-navy">Email</label>
                <input id="fit-email" name="email" type="email" inputMode="email" autoComplete="email" defaultValue={state?.email} placeholder="you@example.com" aria-invalid={state?.error ? true : undefined} className={cn(FIELD, 'mt-1')} />
              </div>
              <div>
                <label htmlFor="fit-file" className="text-sm font-semibold text-navy">Résumé <span className="font-normal text-muted-foreground">(optional, PDF or Word)</span></label>
                <input id="fit-file" name="file" type="file" accept=".pdf,.doc,.docx" className="mt-1 block w-full text-sm file:mr-3 file:rounded-full file:border-0 file:bg-white file:px-4 file:py-2 file:text-sm file:font-medium file:text-navy" />
              </div>
              {state?.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
              <Button type="submit" disabled={pending} className="h-11 w-full rounded-full bg-action px-5 text-action-foreground hover:brightness-95">
                {pending ? 'Saving…' : 'Save my details'}
              </Button>
            </form>
          )}
        </div>
      </div>
    </section>
  )
}
