'use client'

import { useActionState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { TrackedLink } from '@/components/marketing/TrackedLink'
import { coachAnswer, rewriteBullets, type AnswerState, type BulletsState } from '@/lib/ai-tools/actions'
import { ANSWER_MAX_CHARS, BULLETS_MAX_CHARS, INTERVIEW_QUESTIONS } from '@/lib/ai-tools/prompts'
import { MARKET_REALITY_START_HREF } from '@/lib/onboarding/resume-rule'
import { posthog } from '@/lib/posthog/client'
import { cn } from '@/lib/utils'

const INPUT = 'mt-1 w-full rounded-lg border border-border bg-white p-3 text-base'

function Honeypot() {
  return (
    <div aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
      <label>
        Website
        <input type="text" name="website" tabIndex={-1} autoComplete="off" />
      </label>
    </div>
  )
}

function NextStep({ tool }: { tool: string }) {
  return (
    <div className="rounded-xl border border-border bg-white p-5">
      <h2 className="text-lg font-semibold tracking-tight text-navy">See how the market reads you</h2>
      <p className="mt-1 text-sm text-muted-foreground">A free Market Reality Assessment ranks every open job for your background.</p>
      <TrackedLink href={MARKET_REALITY_START_HREF} event="free_ai_tool_cta_clicked" properties={{ tool }} className="mt-3 inline-flex h-11 items-center rounded-full bg-action px-6 text-base font-semibold text-action-foreground hover:brightness-95">
        Get my free assessment
      </TrackedLink>
    </div>
  )
}

function useToolEvents(tool: string, resultShown: boolean) {
  const started = useRef(false)
  useEffect(() => {
    posthog.capture('free_ai_tool_viewed', { tool })
  }, [tool])
  useEffect(() => {
    if (resultShown) posthog.capture('free_ai_tool_result_shown', { tool })
  }, [resultShown, tool])
  return () => {
    if (!started.current) {
      started.current = true
      posthog.capture('free_ai_tool_started', { tool })
    }
  }
}

export function RewriteBulletsTool() {
  const [state, run, running] = useActionState<BulletsState, FormData>(rewriteBullets, {})
  const started = useToolEvents('resume_bullets', !!state.rewrites)
  return (
    <div className="mt-8 max-w-2xl space-y-6">
      <form action={run} noValidate onSubmit={() => posthog.capture('free_ai_tool_submitted', { tool: 'resume_bullets' })} className={cn('relative space-y-4 rounded-xl border border-border bg-white p-6', running && 'cursor-wait')}>
        <Honeypot />
        <label className="block text-sm font-medium text-navy" htmlFor="fb-bullets">
          Paste one to four résumé bullets
          <textarea id="fb-bullets" name="bullets" defaultValue={state.input} onChange={started} rows={7} maxLength={BULLETS_MAX_CHARS} placeholder="One bullet per line. For example: Responsible for managing the quarterly budget and reporting to the VP." className={INPUT} />
        </label>
        <p className="text-xs text-muted-foreground">We use only the facts you give. Nothing is saved.</p>
        <Button type="submit" disabled={running} className="h-11 rounded-full bg-action px-6 text-action-foreground hover:brightness-95">
          {running ? 'Rewriting…' : 'Rewrite my bullets'}
        </Button>
        {state.error && (
          <p role="alert" className="text-sm text-destructive">
            {state.error}
          </p>
        )}
      </form>

      {state.rewrites && (
        <section aria-labelledby="fb-results" className="space-y-4">
          <h2 id="fb-results" className="text-xl font-semibold tracking-tight text-navy">Stronger versions</h2>
          {state.rewrites.map((r) => (
            <div key={r.original} className="rounded-xl border border-border bg-white p-5 text-sm">
              <p className="text-muted-foreground line-through">{r.original}</p>
              <p className="mt-2 text-base font-medium text-navy">{r.better}</p>
              {r.tip && <p className="mt-2 text-muted-foreground">{r.tip}</p>}
              <button type="button" onClick={() => { void navigator.clipboard?.writeText(r.better); posthog.capture('free_ai_tool_copied', { tool: 'resume_bullets' }) }} className="mt-3 text-sm font-medium text-brand underline underline-offset-4">
                Copy this bullet
              </button>
            </div>
          ))}
          <NextStep tool="resume_bullets" />
        </section>
      )}
    </div>
  )
}

export function InterviewAnswerTool() {
  const [state, run, running] = useActionState<AnswerState, FormData>(coachAnswer, {})
  const started = useToolEvents('interview_answer', !!state.coaching)
  const c = state.coaching
  return (
    <div className="mt-8 max-w-2xl space-y-6">
      <form action={run} noValidate onSubmit={() => posthog.capture('free_ai_tool_submitted', { tool: 'interview_answer' })} className={cn('relative space-y-4 rounded-xl border border-border bg-white p-6', running && 'cursor-wait')}>
        <Honeypot />
        <label className="block text-sm font-medium text-navy" htmlFor="ia-question">
          Question
          <select id="ia-question" name="question" defaultValue={state.question ?? INTERVIEW_QUESTIONS[0]} className="mt-1 h-12 w-full rounded-lg border border-border bg-white px-3 text-base">
            {INTERVIEW_QUESTIONS.map((q) => (
              <option key={q} value={q}>{q}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium text-navy" htmlFor="ia-answer">
          Your answer, written the way you would say it
          <textarea id="ia-answer" name="answer" defaultValue={state.input} onChange={started} rows={9} maxLength={ANSWER_MAX_CHARS} placeholder="Write out what you would say. About 150 to 250 words is a good length." className={INPUT} />
        </label>
        <p className="text-xs text-muted-foreground">We use only what you wrote. Nothing is saved.</p>
        <Button type="submit" disabled={running} className="h-11 rounded-full bg-action px-6 text-action-foreground hover:brightness-95">
          {running ? 'Coaching…' : 'Coach my answer'}
        </Button>
        {state.error && (
          <p role="alert" className="text-sm text-destructive">
            {state.error}
          </p>
        )}
      </form>

      {c && (
        <section aria-labelledby="ia-results" className="space-y-4">
          <h2 id="ia-results" className="text-xl font-semibold tracking-tight text-navy">Your coaching</h2>
          {c.strengths.length > 0 && (
            <div className="rounded-xl border border-border bg-white p-5 text-sm">
              <h3 className="font-semibold text-navy">Working well</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5">{c.strengths.map((s) => <li key={s}>{s}</li>)}</ul>
            </div>
          )}
          {c.improvements.length > 0 && (
            <div className="rounded-xl border border-border bg-white p-5 text-sm">
              <h3 className="font-semibold text-navy">Change next</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5">{c.improvements.map((s) => <li key={s}>{s}</li>)}</ul>
            </div>
          )}
          <div className="rounded-xl border border-border bg-white p-5 text-sm">
            <h3 className="font-semibold text-navy">A stronger version, built from what you wrote</h3>
            <p className="mt-2 whitespace-pre-line text-base">{c.stronger}</p>
            <button type="button" onClick={() => { void navigator.clipboard?.writeText(c.stronger); posthog.capture('free_ai_tool_copied', { tool: 'interview_answer' }) }} className="mt-3 text-sm font-medium text-brand underline underline-offset-4">
              Copy this answer
            </button>
          </div>
          <NextStep tool="interview_answer" />
        </section>
      )}
    </div>
  )
}
