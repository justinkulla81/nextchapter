'use client'

import { useActionState, useState } from 'react'
import { Button } from '@/components/ui/button'
import { saveRetrainingInterest, type RetrainingState } from '@/lib/leads/ai-retraining-actions'
import { posthog } from '@/lib/posthog/client'
import { cn } from '@/lib/utils'
import { CATALOG_FUNCTIONS } from '@/lib/learning/public-catalog-shared'
import { FORMATS, type RetrainFormat } from '@/lib/learning/ai-retraining'
import { INDUSTRIES } from '@/lib/seo/topics'
import { ALL_STATE_CODES, stateName } from '@/lib/seo/states'
import { JoinFreeAfterSave } from '@/components/capture/JoinFreeAfterSave'

const FIELD = 'mt-1 h-11 w-full rounded-lg border border-border bg-white px-3 text-base'

/**
 * The first step of the AI retraining registration path: function, industry, how they want to learn and an email. Saves a
 * HomepageLead of kind ai_retraining (src/lib/leads/ai-retraining-actions.ts); the confirmation email finishes it.
 */
export function InterestForm({ source, confirmed }: { source: string; confirmed?: boolean }) {
  const [state, action, pending] = useActionState<RetrainingState, FormData>(saveRetrainingInterest, {})
  const [format, setFormat] = useState<RetrainFormat>('online')

  if (confirmed) {
    return (
      <section className="rounded-xl border border-border bg-white p-6" role="status">
        <h2 className="text-xl font-semibold tracking-tight text-navy">You are on the list</h2>
        <p className="mt-1 text-sm text-muted-foreground">Your email is confirmed. We will use it to tell you about AI retraining programs for your function and industry.</p>
      </section>
    )
  }
  if (state?.saved) {
    return (
      <section className="rounded-xl border border-border bg-white p-6" role="status">
        <h2 className="text-xl font-semibold tracking-tight text-navy">Interest saved</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {state.confirmEmailed
            ? <>Check your inbox{state.email ? <> at <span className="font-medium text-foreground">{state.email}</span></> : ''} and click the link to confirm.</>
            : <>Saved{state.email ? <> for <span className="font-medium text-foreground">{state.email}</span></> : ''}. Confirmation emails are turning on soon.</>}
        </p>
        <JoinFreeAfterSave from="ai_retraining_interest" properties={{ source }} />
      </section>
    )
  }

  return (
    <section aria-labelledby={`retrain-${source}`} className="rounded-xl border border-border bg-white p-6">
      <h2 id={`retrain-${source}`} className="text-xl font-semibold tracking-tight text-navy">Register your interest in AI retraining</h2>
      <p className="mt-1 text-sm text-muted-foreground">Tell us your work and how you want to learn. It takes under a minute.</p>
      <form
        action={action}
        noValidate
        className={cn('mt-4 grid gap-4 sm:grid-cols-2', pending && 'cursor-wait')}
        onSubmit={(e) => {
          const f = new FormData(e.currentTarget)
          posthog.capture('ai_retraining_interest_submitted_client', { source, function: f.get('function') || null, industry: f.get('industry') || null, format })
        }}
      >
        <input type="hidden" name="source" value={source} />
        <input type="hidden" name="format" value={format} />
        <div className="hidden" aria-hidden>
          <label htmlFor={`rt-website-${source}`}>Website</label>
          <input id={`rt-website-${source}`} name="website" type="text" tabIndex={-1} autoComplete="off" />
        </div>
        <label className="block text-sm font-medium text-navy">
          Your function
          <select name="function" defaultValue="" required className={FIELD}>
            <option value="" disabled>Choose one</option>
            {CATALOG_FUNCTIONS.map((f) => <option key={f.slug} value={f.slug}>{f.name}</option>)}
          </select>
        </label>
        <label className="block text-sm font-medium text-navy">
          Your industry
          <select name="industry" defaultValue="" required className={FIELD}>
            <option value="" disabled>Choose one</option>
            {INDUSTRIES.map((i) => <option key={i.slug} value={i.slug}>{i.name}</option>)}
          </select>
        </label>
        <div className="sm:col-span-2">
          <p className="text-sm font-medium text-navy" id={`rt-format-${source}`}>How do you want to learn?</p>
          <div role="group" aria-labelledby={`rt-format-${source}`} className="mt-2 flex flex-wrap gap-2">
            {FORMATS.map((o) => (
              <button
                key={o.value}
                type="button"
                aria-pressed={format === o.value}
                onClick={() => setFormat(o.value)}
                className={cn('h-10 rounded-full border px-5 text-sm font-medium', format === o.value ? 'border-navy bg-navy text-white' : 'border-border bg-white text-foreground hover:bg-off-white')}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
        {format !== 'online' && (
          <label className="block text-sm font-medium text-navy">
            Your state
            <select name="state" defaultValue="" required className={FIELD}>
              <option value="" disabled>Choose one</option>
              {ALL_STATE_CODES.map((c) => <option key={c} value={c}>{stateName(c)}</option>)}
            </select>
          </label>
        )}
        <label className={cn('block text-sm font-medium text-navy', format === 'online' && 'sm:col-span-2')}>
          Email address
          <input name="email" type="email" inputMode="email" autoComplete="email" defaultValue={state?.email} placeholder="you@example.com" required className={FIELD} />
        </label>
        <div className="sm:col-span-2">
          <Button type="submit" disabled={pending} className="h-11 rounded-full bg-action px-6 text-action-foreground hover:brightness-95">
            {pending ? 'Saving…' : 'Register my interest'}
          </Button>
          {state?.error && <p role="alert" className="mt-2 text-sm text-destructive">{state.error}</p>}
        </div>
      </form>
    </section>
  )
}
