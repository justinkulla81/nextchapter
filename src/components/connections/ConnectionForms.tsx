'use client'

// The buttons on the connections panel. Each shows a busy cursor while it runs and says what happened.

import { useActionState } from 'react'
import { cn } from '@/lib/utils'
import type { ConnState } from '@/lib/connections/form'

type FormAction = (prev: ConnState, f: FormData) => Promise<ConnState>

function Result({ state }: { state: ConnState }) {
  if (state?.error) return <p role="alert" className="text-xs text-destructive">{state.error}</p>
  if (state?.ok && state.message) return <p role="status" className="text-xs text-success">{state.message}</p>
  return null
}

export function RequestConnectionButton({ action, other, name }: { action: FormAction; other: string; name: string }) {
  const [state, run, pending] = useActionState(action, undefined)
  if (state?.ok) return <Result state={state} />
  return (
    <form action={run} className={cn('space-y-1', pending && 'cursor-wait')}>
      <input type="hidden" name="other" value={other} />
      <button type="submit" disabled={pending} aria-label={`Ask ${name} to connect`} className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground disabled:cursor-wait disabled:opacity-70">
        {pending ? 'Sending…' : 'Ask to connect'}
      </button>
      <Result state={state} />
    </form>
  )
}

export function AnswerRequest({ action, id, name }: { action: FormAction; id: string; name: string }) {
  const [state, run, pending] = useActionState(action, undefined)
  if (state?.ok) return <Result state={state} />
  return (
    <form action={run} className={cn('space-y-1', pending && 'cursor-wait')}>
      <input type="hidden" name="id" value={id} />
      <div className="flex flex-wrap gap-2">
        <button type="submit" name="decision" value="accept" disabled={pending} aria-label={`Accept ${name}'s request`} className="rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground disabled:cursor-wait disabled:opacity-70">
          Accept
        </button>
        <button type="submit" name="decision" value="decline" disabled={pending} aria-label={`Decline ${name}'s request`} className="rounded-full border border-border px-4 py-1.5 text-sm font-medium disabled:cursor-wait disabled:opacity-70">
          Decline
        </button>
      </div>
      <Result state={state} />
    </form>
  )
}

export function ShareChoices({ action, id, items, current, name }: { action: FormAction; id: string; items: { key: string; label: string; detail: string }[]; current: string[]; name: string }) {
  const [state, run, pending] = useActionState(action, undefined)
  return (
    <form action={run} className={cn('space-y-2', pending && 'cursor-wait')}>
      <input type="hidden" name="id" value={id} />
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">What you share with {name}</legend>
        <div className="flex flex-wrap gap-2">
          {items.map((i) => (
            <label key={i.key} className="flex cursor-pointer items-start gap-2 rounded-lg border border-border bg-card p-2 text-sm has-[:checked]:border-navy has-[:focus-visible]:ring-2">
              <input type="checkbox" name="shares" value={i.key} defaultChecked={current.includes(i.key)} className="mt-0.5" />
              <span>
                <span className="font-medium">{i.label}</span>
                <span className="block text-xs text-muted-foreground">{i.detail}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <button type="submit" disabled={pending} className="rounded-full border border-border px-3 py-1 text-xs font-medium disabled:cursor-wait disabled:opacity-70">
        {pending ? 'Saving…' : 'Save what you share'}
      </button>
      <Result state={state} />
    </form>
  )
}
