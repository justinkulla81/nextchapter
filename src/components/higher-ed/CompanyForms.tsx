'use client'

import { useActionState, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SubmitButton } from '@/components/ui/submit-button'
import { cn } from '@/lib/utils'
import { offerGrantSupportAction, requestSeatsAction, requestTrainingAction, setOwnHiring } from '@/app/i/[slug]/(portal)/company-actions'
import { GRANT_OFFERS, GRANT_OFFER_LABELS } from '@/lib/workforce/contact-roles'

type R = { error?: string; ok?: boolean; message?: string } | undefined

export function HiringStatus({ slug, hiring, readOnly }: { slug: string; hiring: boolean; readOnly: boolean }) {
  const [on, setOn] = useState(hiring)
  const [err, setErr] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const set = (v: boolean) =>
    start(async () => {
      setErr(null)
      const r = await setOwnHiring(slug, v)
      if (r.error) setErr(r.error)
      else setOn(v)
    })
  return (
    <div className={cn('space-y-1', pending && 'cursor-wait')}>
      <p className="text-sm font-medium">Are you hiring?</p>
      <div className="flex gap-1" role="group" aria-label="Are you hiring?">
        <Button type="button" size="sm" variant={on ? 'default' : 'outline'} aria-pressed={on} disabled={pending || readOnly} onClick={() => set(true)}>
          Yes, hiring
        </Button>
        <Button type="button" size="sm" variant={!on ? 'default' : 'outline'} aria-pressed={!on} disabled={pending || readOnly} onClick={() => set(false)}>
          Not now
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        {readOnly ? 'Read-only preview.' : on ? 'You see the Dossiers local job seekers chose to share, under Hiring.' : 'Say yes to see Dossiers local job seekers chose to share.'}
      </p>
      {err && <p className="text-xs text-destructive">{err}</p>}
    </div>
  )
}

export function SeatRequestForm({ slug }: { slug: string }) {
  const [state, action] = useActionState<R, FormData>(requestSeatsAction.bind(null, slug), undefined)
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-3">
      <div className="space-y-1.5">
        <Label htmlFor="sr-seats">People affected</Label>
        <Input id="sr-seats" name="seats" type="number" min={1} max={5000} required />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="sr-note">Anything the organization should know (optional)</Label>
        <Input id="sr-note" name="note" maxLength={1000} placeholder="Last day, teams affected, a layoff filing" />
      </div>
      <div className="flex items-center gap-3 sm:col-span-3">
        <SubmitButton pendingLabel="Sending…">Ask for seats</SubmitButton>
        {state?.error && (
          <p role="alert" className="text-sm text-destructive">
            {state.error}
          </p>
        )}
        {state?.message && <p className="text-sm text-muted-foreground">{state.message}</p>}
      </div>
    </form>
  )
}

function Result({ state }: { state: R }) {
  if (state?.error)
    return (
      <p role="alert" className="text-sm text-destructive">
        {state.error}
      </p>
    )
  if (state?.message)
    return (
      <p role="status" className="text-sm text-muted-foreground">
        {state.message}
      </p>
    )
  return null
}

// Learning and development: what the company's people need to learn. Suggestions are the skills local postings ask for.
export function TrainingRequestForm({ slug, suggestions }: { slug: string; suggestions: string[] }) {
  const [state, action] = useActionState<R, FormData>(requestTrainingAction.bind(null, slug), undefined)
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-3">
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="tr-topic">Skill or course</Label>
        <Input id="tr-topic" name="topic" required maxLength={160} list="tr-skills" placeholder="Project management, Excel for finance, AI tools for analysts" />
        <datalist id="tr-skills">
          {suggestions.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="tr-people">People to train (optional)</Label>
        <Input id="tr-people" name="people" type="number" min={1} max={5000} />
      </div>
      <div className="space-y-1.5 sm:col-span-3">
        <Label htmlFor="tr-note">Anything else (optional)</Label>
        <Input id="tr-note" name="note" maxLength={1000} placeholder="Roles, timing, on-site or online, who pays" />
      </div>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-3">
        <SubmitButton pendingLabel="Sending…">Ask for training</SubmitButton>
        <Result state={state} />
      </div>
    </form>
  )
}

// Grants and RFPs: what the company can put behind a grant. With applicationId, it is for that application.
export function GrantOfferForm({ slug, applicationId, applicationName }: { slug: string; applicationId?: string; applicationName?: string }) {
  const [state, action] = useActionState<R, FormData>(offerGrantSupportAction.bind(null, slug), undefined)
  const [offers, setOffers] = useState<string[]>(['LETTER'])
  const id = applicationId ?? 'new'
  const toggle = (o: string) => setOffers((cur) => (cur.includes(o) ? cur.filter((x) => x !== o) : [...cur, o]))
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-3">
      {applicationId ? (
        <input type="hidden" name="fundingApplicationId" value={applicationId} />
      ) : (
        <div className="space-y-1.5 sm:col-span-3">
          <Label htmlFor={`go-topic-${id}`}>Grant, RFP or project</Label>
          <Input id={`go-topic-${id}`} name="topic" required maxLength={160} placeholder="A state training grant, an apprenticeship RFP, a project idea" />
        </div>
      )}
      <fieldset className="space-y-1.5 sm:col-span-3">
        <legend className="text-sm font-medium">What you can offer{applicationName ? ` for ${applicationName}` : ''}</legend>
        <div className="flex flex-wrap gap-2">
          {GRANT_OFFERS.map((o) => {
            const on = offers.includes(o)
            return (
              <button
                key={o}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(o)}
                className={cn('rounded-md border px-3 py-1.5 text-sm transition-colors', on ? 'border-[color:var(--portal,var(--ink))] bg-[var(--portal-tint,var(--muted))] font-medium' : 'border-border hover:bg-muted')}
              >
                {GRANT_OFFER_LABELS[o]}
              </button>
            )
          })}
        </div>
        {offers.map((o) => (
          <input key={o} type="hidden" name="offers" value={o} />
        ))}
      </fieldset>
      {offers.includes('MATCH') && (
        <div className="space-y-1.5">
          <Label htmlFor={`go-match-${id}`}>Match, in dollars (optional)</Label>
          <Input id={`go-match-${id}`} name="matchAmount" inputMode="numeric" placeholder="25,000" />
        </div>
      )}
      <div className={cn('space-y-1.5', offers.includes('MATCH') ? 'sm:col-span-2' : 'sm:col-span-3')}>
        <Label htmlFor={`go-note-${id}`}>Anything else (optional)</Label>
        <Input id={`go-note-${id}`} name="note" maxLength={1000} placeholder="Who signs, in-kind details, how many hires" />
      </div>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-3">
        <SubmitButton pendingLabel="Sending…" disabled={!offers.length}>
          Offer support
        </SubmitButton>
        {!offers.length && <span className="text-xs text-muted-foreground">Pick at least one thing you can offer.</span>}
        <Result state={state} />
      </div>
    </form>
  )
}
