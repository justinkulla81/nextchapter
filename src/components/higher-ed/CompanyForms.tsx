'use client'

import { useActionState, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SubmitButton } from '@/components/ui/submit-button'
import { cn } from '@/lib/utils'
import { requestSeatsAction, setOwnHiring } from '@/app/i/[slug]/(portal)/company-actions'

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
        <Input id="sr-note" name="note" maxLength={1000} placeholder="Last day, teams affected, a WARN filing" />
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
