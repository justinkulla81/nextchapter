'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { saveCheckInDetails, submitCheckInAnswer } from '@/app/i/[slug]/checkin/[id]/actions'
import { CHANGE_DISTANCES, DETAIL_FIELDS } from '@/lib/higher-ed/checkin-details'
import type { Unlocks } from '@/lib/higher-ed/checkin-unlocks'
import { posthog } from '@/lib/posthog/client'

const TEAM_SIZES = [
  { key: '1-3', label: '1 to 3' },
  { key: '4-10', label: '4 to 10' },
  { key: '11+', label: '11 or more' },
]

function TextField(p: { id: string; label: string; value: string; placeholder?: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={p.id} className="text-sm font-medium">
        {p.label}
      </label>
      <input
        id={p.id}
        value={p.value}
        placeholder={p.placeholder}
        maxLength={120}
        onChange={(e) => p.onChange(e.target.value)}
        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
      />
    </div>
  )
}

// Two to four choices as adjacent buttons (design principle 1).
function Choice(p: { label: string; options: { key: string; label: string }[]; value?: string; onChange: (v: string) => void }) {
  return (
    <fieldset className="space-y-1.5">
      <legend className="text-sm font-medium">{p.label}</legend>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={p.label}>
        {p.options.map((o) => (
          <Button key={o.key} type="button" role="radio" aria-checked={p.value === o.key} variant={p.value === o.key ? 'default' : 'outline'} onClick={() => p.onChange(o.key)}>
            {o.label}
          </Button>
        ))}
      </div>
    </fieldset>
  )
}

// Step three: what the answer unlocked, and what the college now sees.
export function UnlockView({ unlocks, college, slug, answer }: { unlocks: Unlocks; college: string; slug: string; answer: string }) {
  const track = (card: string) => posthog.capture('he_checkin_unlock_opened', { slug, answer, card })
  return (
    <div className="space-y-6" role="status">
      <div className="space-y-3">
        <p className="text-xl font-semibold tracking-tight">{unlocks.headline}</p>
        <Link href={unlocks.primary.href} onClick={() => track('primary')} className={buttonVariants({ size: 'lg' })}>
          {unlocks.primary.label}
        </Link>
      </div>
      {unlocks.cards.length > 0 && (
        <section aria-labelledby="ci-unlocked" className="space-y-2">
          <h2 id="ci-unlocked" className="text-base font-semibold">
            Yours from {college}
          </h2>
          <ul className="divide-y rounded-lg border">
            {unlocks.cards.map((c) => (
              <li key={c.key}>
                <Link href={c.href} onClick={() => track(c.key)} className="block space-y-0.5 px-4 py-3 hover:bg-muted/50">
                  <span className="block text-sm font-medium text-primary">{c.title}</span>
                  <span className="block text-sm text-muted-foreground">{c.detail}</span>
                  <span className="block text-xs text-muted-foreground">From {c.office}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {unlocks.sees.length > 0 && (
        <section aria-labelledby="ci-sees" className="space-y-2 rounded-lg bg-muted/50 px-4 py-3">
          <h2 id="ci-sees" className="text-base font-semibold">
            What {college} sees
          </h2>
          <ul className="space-y-1.5">
            {unlocks.sees.map((x) => (
              <li key={x.office + x.what} className="text-sm">
                <span className="font-medium">{x.office}:</span> <span className="text-muted-foreground">{x.what}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

type Answer = { key: string; label: string }

// The answers as buttons (design principle 1), the one from the email
// preselected, then one click to send.
export function CheckInAnswerForm(props: {
  slug: string
  checkInId: string
  token: string
  answers: readonly Answer[]
  initial: string | null
  college: string
  joined: boolean
}) {
  const [answer, setAnswer] = useState<string | null>(props.initial)
  const [done, setDone] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const [details, setDetails] = useState<Record<string, string>>({})
  const [unlocks, setUnlocks] = useState<Unlocks | null>(null)

  if (unlocks) return <UnlockView unlocks={unlocks} college={props.college} slug={props.slug} answer={done!} />

  if (done) {
    const fields = DETAIL_FIELDS[done as keyof typeof DETAIL_FIELDS] ?? []
    const set = (k: string, v: string) => setDetails((d) => ({ ...d, [k]: v }))
    const send = (skip: boolean) =>
      start(async () => {
        setError(null)
        const r = await saveCheckInDetails(props.slug, props.checkInId, props.token, skip ? {} : details)
        if (r.error || !r.unlocks) setError(r.error ?? 'Something went wrong. Try again.')
        else setUnlocks(r.unlocks)
      })
    return (
      <div className="space-y-5">
        <div role="status" className="space-y-1">
          <p className="text-lg font-medium">Thanks. {props.college} has it.</p>
          <p className="text-sm text-muted-foreground">A few details help {props.college} point you to the right help. All optional.</p>
        </div>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            send(false)
          }}
        >
          {fields.includes('employer') && (
            <TextField id="ci-employer" label={done === 'new_job' ? 'Your new employer' : done === 'laid_off' ? 'Where you last worked' : 'Where you work now'} value={details.employer ?? ''} onChange={(v) => set('employer', v)} />
          )}
          {fields.includes('title') && <TextField id="ci-title" label="Your title" value={details.title ?? ''} onChange={(v) => set('title', v)} />}
          {fields.includes('target') && (
            <TextField
              id="ci-target"
              label={done === 'back_to_school' ? 'What you’d like to study' : 'The role or field you want next'}
              placeholder={done === 'back_to_school' ? 'e.g. teaching, data analysis, nursing' : 'e.g. product manager, teaching, finance'}
              value={details.target ?? ''}
              onChange={(v) => set('target', v)}
            />
          )}
          {fields.includes('distance') && (
            <Choice label="How big a change?" options={CHANGE_DISTANCES} value={details.distance} onChange={(v) => set('distance', v)} />
          )}
          {fields.includes('teamSize') && (
            <Choice label="How many people on your team?" options={TEAM_SIZES} value={details.teamSize} onChange={(v) => set('teamSize', v)} />
          )}
          {fields.includes('company') && <TextField id="ci-company" label="Your company’s name" value={details.company ?? ''} onChange={(v) => set('company', v)} />}
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" size="lg" disabled={pending} className={cn(pending && 'cursor-wait')}>
              {pending ? 'Saving…' : 'Show what’s for me'}
            </Button>
            <Button type="button" variant="ghost" disabled={pending} className={cn(pending && 'cursor-wait')} onClick={() => send(true)}>
              Skip
            </Button>
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </form>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Has anything changed?">
        {props.answers.map((a) => (
          <Button
            key={a.key}
            type="button"
            role="radio"
            aria-checked={answer === a.key}
            variant={answer === a.key ? 'default' : 'outline'}
            onClick={() => setAnswer(a.key)}
          >
            {a.label}
          </Button>
        ))}
      </div>
      {!answer && <p className="text-sm text-muted-foreground">Pick the answer that fits, then send it.</p>}
      <Button
        size="lg"
        disabled={!answer || pending}
        className={cn(pending && 'cursor-wait')}
        onClick={() =>
          start(async () => {
            setError(null)
            const r = await submitCheckInAnswer(props.slug, props.checkInId, props.token, answer!)
            if (r.error) setError(r.error)
            else setDone(answer)
          })
        }
      >
        {pending ? 'Sending…' : 'Send my answer'}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
