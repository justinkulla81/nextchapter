'use client'

// Class notes, job-search circles, the career fair, referrals and the monthly
// alumni email settings. Busy cursor while anything runs; results said in words.

import { useActionState, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SubmitButton } from '@/components/ui/submit-button'
import { cn } from '@/lib/utils'
import * as A from '@/app/i/[slug]/(portal)/connect-actions'

type R = { error?: string; message?: string; ok?: boolean } | null | undefined
type FormAction = (prev: A.FormResult, f: FormData) => Promise<A.FormResult>
const area = 'min-h-20 w-full rounded-md border border-input bg-background p-2 text-sm'

function Msg({ r }: { r: R }) {
  if (!r?.error && !r?.message) return null
  return (
    <p role={r.error ? 'alert' : 'status'} className={cn('text-sm', r.error ? 'text-destructive' : 'text-muted-foreground')}>
      {r.error ?? r.message}
    </p>
  )
}

const KINDS = [
  { key: 'career', label: 'Career news' },
  { key: 'life', label: 'Life news' },
  { key: 'achievement', label: 'An achievement' },
  { key: 'other', label: 'Something else' },
] as const

export function ClassNoteForm({ slug }: { slug: string }) {
  const [kind, setKind] = useState<string>('career')
  const [body, setBody] = useState('')
  const [pending, start] = useTransition()
  const [r, setR] = useState<R>(null)
  return (
    <div className={cn('space-y-2', pending && 'cursor-wait')}>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Kind of news">
        {KINDS.map((k) => (
          <Button key={k.key} type="button" size="sm" role="radio" aria-checked={kind === k.key} variant={kind === k.key ? 'default' : 'outline'} onClick={() => setKind(k.key)}>
            {k.label}
          </Button>
        ))}
      </div>
      <textarea aria-label="Your news" className={area} placeholder="New job, a move, a book, a wedding: a sentence or two for your class." value={body} maxLength={1000} onChange={(e) => setBody(e.target.value)} />
      <Button
        size="sm"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const out = await A.classNoteAction(slug, kind, body)
            setR(out)
            if (!out.error) setBody('')
          })
        }
      >
        {pending ? 'Posting…' : 'Share with my class'}
      </Button>
      <Msg r={r} />
    </div>
  )
}

export function CircleJoin({ slug, circleId, joined }: { slug: string; circleId: string; joined: boolean }) {
  const [goal, setGoal] = useState('')
  const [open, setOpen] = useState(false)
  const [pending, start] = useTransition()
  const [r, setR] = useState<R>(null)
  if (r?.ok) return <Msg r={r} />
  if (joined)
    return (
      <Button size="sm" variant="ghost" disabled={pending} className={cn(pending && 'cursor-wait')} onClick={() => start(async () => setR(await A.joinCircleAction(slug, circleId, '', true)))}>
        Leave this circle
      </Button>
    )
  if (!open)
    return (
      <Button size="sm" onClick={() => setOpen(true)}>
        Join this circle
      </Button>
    )
  return (
    <div className={cn('w-full space-y-2', pending && 'cursor-wait')}>
      <Input aria-label="Your goal" placeholder="Your goal for the six weeks (optional)" value={goal} maxLength={300} onChange={(e) => setGoal(e.target.value)} />
      <div className="flex gap-2">
        <Button size="sm" disabled={pending} onClick={() => start(async () => setR(await A.joinCircleAction(slug, circleId, goal)))}>
          {pending ? 'Joining…' : 'Join'}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
      <Msg r={r} />
    </div>
  )
}

export function CircleForm({ slug }: { slug: string }) {
  const [state, action] = useActionState<A.FormResult, FormData>(A.circleForm.bind(null, slug) as FormAction, undefined)
  const [v, setV] = useState({ name: '', focus: '', facilitator: '', startsAt: '', weeks: '6', meetingTime: '', meetingUrl: '', capacity: '6' })
  const bind = (k: keyof typeof v) => ({ name: k, value: v[k], onChange: (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: e.target.value }) })
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor="ci-name">Name</Label>
        <Input id="ci-name" {...bind('name')} placeholder="Fall circle: back to work" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ci-fac">Facilitator</Label>
        <Input id="ci-fac" {...bind('facilitator')} placeholder="A counselor or coach" />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="ci-focus">Focus (optional)</Label>
        <Input id="ci-focus" {...bind('focus')} placeholder="Laid-off managers; career changers; recent grads" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ci-start">Starts</Label>
        <Input id="ci-start" type="date" {...bind('startsAt')} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ci-time">When it meets</Label>
        <Input id="ci-time" {...bind('meetingTime')} placeholder="Tuesdays 6:00 pm" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ci-weeks">Weeks</Label>
        <Input id="ci-weeks" inputMode="numeric" {...bind('weeks')} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ci-cap">Seats</Label>
        <Input id="ci-cap" inputMode="numeric" {...bind('capacity')} />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="ci-url">Meeting link (optional)</Label>
        <Input id="ci-url" type="url" {...bind('meetingUrl')} placeholder="https://" />
      </div>
      <div className="flex items-center gap-3 sm:col-span-2">
        <SubmitButton pendingLabel="Opening…">Open for sign-ups</SubmitButton>
        <Msg r={state} />
      </div>
    </form>
  )
}

export function FairForm({ slug }: { slug: string }) {
  const [state, action] = useActionState<A.FormResult, FormData>(A.careerFairForm.bind(null, slug) as FormAction, undefined)
  const [v, setV] = useState({ title: '', date: '', time: '12:00' })
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <div className="space-y-1.5">
        <Label htmlFor="cf-title">Fair name</Label>
        <Input id="cf-title" name="title" value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} placeholder="Spring virtual career fair" className="w-64" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="cf-date">Date</Label>
        <Input id="cf-date" name="date" type="date" value={v.date} onChange={(e) => setV({ ...v, date: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="cf-time">Starts</Label>
        <Input id="cf-time" name="time" type="time" value={v.time} onChange={(e) => setV({ ...v, time: e.target.value })} />
      </div>
      <SubmitButton pendingLabel="Creating…">Create fair</SubmitButton>
      <Msg r={state} />
    </form>
  )
}

export function BoothForm({ slug, eventId }: { slug: string; eventId: string }) {
  const [state, action] = useActionState<A.FormResult, FormData>(A.boothForm.bind(null, slug, eventId) as FormAction, undefined)
  const [v, setV] = useState({ employerName: '', roles: '', pitch: '', meetingUrl: '' })
  return (
    <form action={action} className="grid gap-2 sm:grid-cols-2">
      <Input aria-label="Employer" name="employerName" placeholder="Employer" value={v.employerName} onChange={(e) => setV({ ...v, employerName: e.target.value })} />
      <Input aria-label="Meeting link" name="meetingUrl" type="url" placeholder="Booth video link (https://)" value={v.meetingUrl} onChange={(e) => setV({ ...v, meetingUrl: e.target.value })} />
      <Input aria-label="Roles hiring" name="roles" placeholder="Roles they’re hiring for" value={v.roles} onChange={(e) => setV({ ...v, roles: e.target.value })} className="sm:col-span-2" />
      <Input aria-label="Pitch" name="pitch" placeholder="A line on why alumni should stop by" value={v.pitch} onChange={(e) => setV({ ...v, pitch: e.target.value })} className="sm:col-span-2" />
      <div className="flex items-center gap-3 sm:col-span-2">
        <SubmitButton size="sm" pendingLabel="Adding…">
          Add booth
        </SubmitButton>
        <Msg r={state} />
      </div>
    </form>
  )
}

export function BoothVisit({ slug, boothId, visited }: { slug: string; boothId: string; visited: boolean }) {
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState('')
  const [share, setShare] = useState(false)
  const [pending, start] = useTransition()
  const [r, setR] = useState<R>(null)
  if (r?.ok) return <Msg r={r} />
  if (!open)
    return (
      <Button size="sm" variant={visited ? 'outline' : 'default'} onClick={() => setOpen(true)}>
        {visited ? 'Update my note' : 'I’m interested'}
      </Button>
    )
  return (
    <div className={cn('w-full space-y-2', pending && 'cursor-wait')}>
      <textarea aria-label="A note to the employer" className={area} placeholder="Which role, and why you’re a fit, in a sentence or two." value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={share} onChange={(e) => setShare(e.target.checked)} />
        Share my Dossier with this employer
      </label>
      <div className="flex gap-2">
        <Button size="sm" disabled={pending} onClick={() => start(async () => setR(await A.visitBoothAction(slug, boothId, note, share)))}>
          {pending ? 'Sending…' : 'Send to the employer'}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
      <Msg r={r} />
    </div>
  )
}

export function MarkReferred({ slug, introId }: { slug: string; introId: string }) {
  const [pending, start] = useTransition()
  const [r, setR] = useState<R>(null)
  if (r?.ok) return <Msg r={r} />
  return (
    <span className={cn('inline-flex items-center gap-2', pending && 'cursor-wait')}>
      <Button size="sm" variant="outline" disabled={pending} onClick={() => start(async () => setR(await A.markReferredAction(slug, introId)))}>
        I referred them
      </Button>
      <Msg r={r} />
    </span>
  )
}

export function MonthlyEmailSettings({ slug, on: initialOn, day: initialDay, disabled }: { slug: string; on: boolean; day: number; disabled: boolean }) {
  const [on, setOn] = useState(initialOn)
  const [day, setDay] = useState(String(initialDay))
  const [pending, start] = useTransition()
  const [r, setR] = useState<R>(null)
  const [confirming, setConfirming] = useState(false)
  return (
    <div className={cn('space-y-3', pending && 'cursor-wait')}>
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="mo-day">Day of the month</Label>
          <Input id="mo-day" inputMode="numeric" value={day} onChange={(e) => setDay(e.target.value)} className="w-20" disabled={disabled} />
        </div>
        {on ? (
          <Button variant="outline" disabled={disabled || pending} onClick={() => start(async () => {
            const out = await A.saveMonthlyEmail(slug, false, Number(day))
            setR(out)
            if (!out.error) setOn(false)
          })}>
            Turn off
          </Button>
        ) : confirming ? (
          <span className="flex flex-wrap items-center gap-2 text-sm">
            Every alum on your roster will get this email each month (unsubscribed and do-not-contact alumni are skipped).
            <Button disabled={pending} onClick={() => start(async () => {
              const out = await A.saveMonthlyEmail(slug, true, Number(day))
              setR(out)
              if (!out.error) setOn(true)
              setConfirming(false)
            })}>
              Turn on monthly email
            </Button>
            <Button variant="ghost" autoFocus onClick={() => setConfirming(false)}>
              Cancel
            </Button>
          </span>
        ) : (
          <Button disabled={disabled} onClick={() => setConfirming(true)}>
            Turn on
          </Button>
        )}
        <Button variant="ghost" disabled={disabled || pending} onClick={() => start(async () => setR(await A.sendMonthlyTest(slug)))}>
          Send me a test
        </Button>
      </div>
      <Msg r={r} />
    </div>
  )
}
