'use client'

import { useActionState, useMemo, useState, useTransition } from 'react'
import { usePostHog } from '@/lib/posthog/client'
import { acceptInviteAction, addPlaceAction, removePlaceAction, saveLastSalaryAction } from './actions'

const field = 'h-11 w-full rounded-xl border border-border bg-white px-3.5 text-base text-ink'
const action = 'inline-flex h-11 items-center rounded-full bg-action px-7 text-base font-semibold text-action-foreground hover:brightness-95 disabled:cursor-wait disabled:opacity-70'
const quiet = 'inline-flex h-11 items-center rounded-full border border-border px-6 text-base font-semibold text-ink hover:bg-muted disabled:cursor-wait disabled:opacity-70'

// A searchable list: there are hundreds of areas, so a typed filter beats a long dropdown.
export function AddPlaceForm({ options, disabledReason }: { options: Array<{ code: string; name: string }>; disabledReason?: string | null }) {
  const [q, setQ] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const matches = useMemo(() => {
    const t = q.trim().toLowerCase()
    return t.length < 2 ? [] : options.filter((o) => o.name.toLowerCase().includes(t)).slice(0, 8)
  }, [q, options])
  if (disabledReason) return <p className="text-base text-ink">{disabledReason}</p>
  return (
    <div className={pending ? 'cursor-wait space-y-3' : 'space-y-3'}>
      <label htmlFor="place-q" className="block text-base font-semibold text-ink">Find a place</label>
      <input id="place-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type a city, like Raleigh" autoComplete="off" className={field} />
      {matches.length > 0 && (
        <ul className="divide-y divide-border rounded-2xl border border-border" aria-label="Matching places">
          {matches.map((m) => (
            <li key={m.code}>
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const r = await addPlaceAction(m.code)
                    if (r.ok) { setQ(''); setError(null) } else setError(r.error ?? 'Could not add that place. Try again.')
                  })
                }
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-base text-ink hover:bg-muted disabled:cursor-wait"
              >
                <span>{m.name}</span>
                <span className="text-sm font-semibold underline underline-offset-4">Add this place</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {q.trim().length >= 2 && matches.length === 0 && <p className="text-sm text-muted-foreground">No match. Try the main city’s name, or a different spelling.</p>}
      {error && <p role="alert" className="text-base text-destructive">{error}</p>}
    </div>
  )
}

export function RemovePlaceButton({ id, name }: { id: string; name: string }) {
  const [confirming, setConfirming] = useState(false)
  const [pending, start] = useTransition()
  if (!confirming) return <button type="button" onClick={() => setConfirming(true)} className="text-sm font-medium text-muted-foreground underline underline-offset-4 hover:text-foreground">Remove</button>
  return (
    <span className="flex items-center gap-3 text-sm">
      <span>Remove {name}?</span>
      <button type="button" onClick={() => setConfirming(false)} className="font-medium underline underline-offset-4">Keep it</button>
      <button type="button" disabled={pending} onClick={() => start(() => removePlaceAction(id))} className="font-medium text-destructive underline underline-offset-4 disabled:cursor-wait">{pending ? 'Removing…' : 'Yes, remove'}</button>
    </span>
  )
}

export function LastSalaryAsk({ homeName }: { homeName: string }) {
  const posthog = usePostHog()
  const [skipped, setSkipped] = useState(false)
  const [state, formAction, pending] = useActionState(saveLastSalaryAction, null)
  if (skipped || state?.ok) return null
  return (
    <section className="space-y-3 rounded-2xl border border-border bg-muted/40 p-5" aria-labelledby="salary-ask">
      <h2 id="salary-ask" className="font-display text-xl font-semibold text-ink">See what each salary is really worth</h2>
      <p className="text-base text-ink">A salary goes further in some places than others. What did you earn in your last role? We’ll show each place’s pay in what it would buy you in {homeName}.</p>
      <form action={formAction} className={pending ? 'cursor-wait space-y-3' : 'space-y-3'}>
        <label htmlFor="salary" className="block text-base font-semibold text-ink">Last annual salary</label>
        <input id="salary" name="salary" inputMode="numeric" autoComplete="off" placeholder="$ 120,000" className={`${field} max-w-60`} />
        <p className="text-sm text-muted-foreground">Why we ask: so the comparison uses your pay, not a typical one. Only you see it. You can skip this and still see the costs below.</p>
        <div className="flex flex-wrap items-center gap-4">
          <button type="submit" disabled={pending} className={quiet}>{pending ? 'Saving…' : 'Show what it’s worth'}</button>
          <button type="button" onClick={() => { setSkipped(true); posthog?.capture('last_salary_skipped', { source: 'move_plan' }) }} className="text-base font-medium underline underline-offset-4">Skip for now</button>
        </div>
        {state?.error && <p role="alert" className="text-base text-destructive">{state.error}</p>}
      </form>
    </section>
  )
}

export function AcceptInviteCard({ linkId, ownerName }: { linkId: string; ownerName: string }) {
  const [state, setState] = useState<{ error?: string } | null>(null)
  const [pending, start] = useTransition()
  return (
    <section className="space-y-3 rounded-2xl border border-border p-5" aria-labelledby="invite-title">
      <h2 id="invite-title" className="font-display text-xl font-semibold text-ink">{ownerName} invited you to search together</h2>
      <p className="text-base text-ink">You keep your own account and your own search. You’ll see the places {ownerName} is comparing and what it costs to live there. {ownerName} never sees your applications, contacts or messages, and either of you can end this at any time.</p>
      <button
        type="button"
        disabled={pending}
        onClick={() => start(async () => setState((await acceptInviteAction(linkId)) ?? null))}
        className={action}
      >
        {pending ? 'Joining…' : `Join ${ownerName}’s search`}
      </button>
      {state?.error && <p role="alert" className="text-base text-destructive">{state.error}</p>}
    </section>
  )
}
