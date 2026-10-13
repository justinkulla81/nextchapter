'use client'

// Small client controls for release 4: each shows a busy cursor while it
// runs and says what happened. Nothing here is destructive; sends that
// email someone say so on the button.

import { useActionState, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SubmitButton } from '@/components/ui/submit-button'
import { cn } from '@/lib/utils'
import {
  answerIntro,
  askForIntro,
  decideEmployer,
  postRoleForCollege,
  saveEmployerPackage,
} from '@/app/i/[slug]/(portal)/network-actions'

type Result = { error?: string; message?: string; ok?: boolean }

function Msg({ r }: { r: Result | null | undefined }) {
  if (!r?.error && !r?.message) return null
  return (
    <p role={r.error ? 'alert' : 'status'} className={cn('text-sm', r.error ? 'text-destructive' : 'text-muted-foreground')}>
      {r.error ?? r.message}
    </p>
  )
}

// Ask with a short note: used for a mentor call and an employer intro.
function AskWithNote(props: { label: string; sendLabel: string; placeholder: string; run: (note: string) => Promise<Result>; done?: string | null }) {
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState('')
  const [pending, start] = useTransition()
  const [r, setR] = useState<Result | null>(null)
  if (r?.ok) return <Msg r={r} />
  if (props.done) return <p className="text-xs text-muted-foreground">{props.done}</p>
  return (
    <div className={cn('space-y-2', pending && 'cursor-wait')}>
      {open ? (
        <>
          <textarea
            aria-label="A short note"
            className="min-h-20 w-full rounded-md border border-input bg-background p-2 text-sm"
            placeholder={props.placeholder}
            value={note}
            maxLength={500}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="flex gap-2">
            <Button size="sm" disabled={pending} onClick={() => start(async () => setR(await props.run(note)))}>
              {pending ? 'Sending…' : props.sendLabel}
            </Button>
            <Button size="sm" variant="ghost" disabled={pending} onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </>
      ) : (
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
          {props.label}
        </Button>
      )}
      <Msg r={r} />
    </div>
  )
}

export function IntroAskButton({ slug, memberId, done }: { slug: string; memberId: string; done: string | null }) {
  return (
    <AskWithNote
      label="Request an intro"
      sendLabel="Send request"
      placeholder="The role and why you thought of them."
      run={(note) => askForIntro(slug, memberId, note)}
      done={done}
    />
  )
}

export function IntroAnswerButtons({ slug, requestId }: { slug: string; requestId: string }) {
  const [pending, start] = useTransition()
  const [r, setR] = useState<Result | null>(null)
  if (r?.ok) return <Msg r={r} />
  return (
    <div className={cn('flex flex-wrap items-center gap-2', pending && 'cursor-wait')}>
      <Button size="sm" disabled={pending} onClick={() => start(async () => setR(await answerIntro(slug, requestId, true)))}>
        Accept and share my email
      </Button>
      <Button size="sm" variant="outline" disabled={pending} onClick={() => start(async () => setR(await answerIntro(slug, requestId, false)))}>
        Decline
      </Button>
      <Msg r={r} />
    </div>
  )
}

export function EmployerDecision(props: { slug: string; id: string; status: string; tier: 'BASIC' | 'FEATURED'; featuredUntil: string | null }) {
  const [pending, start] = useTransition()
  const [status, setStatus] = useState(props.status)
  const [tier, setTier] = useState(props.tier)
  const [until, setUntil] = useState(props.featuredUntil ?? '')
  const [r, setR] = useState<Result | null>(null)
  const run = (fn: () => Promise<Result>, after?: () => void) =>
    start(async () => {
      const out = await fn()
      setR(out)
      if (!out.error) after?.()
    })
  return (
    <div className={cn('space-y-2', pending && 'cursor-wait')}>
      {status !== 'APPROVED' ? (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" disabled={pending} onClick={() => run(() => decideEmployer(props.slug, props.id, 'APPROVED'), () => setStatus('APPROVED'))}>
            Approve
          </Button>
          {status === 'PENDING' && (
            <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => decideEmployer(props.slug, props.id, 'REJECTED'), () => setStatus('REJECTED'))}>
              Turn down
            </Button>
          )}
        </div>
      ) : (
        <div className="flex flex-wrap items-end gap-2">
          {(['BASIC', 'FEATURED'] as const).map((t) => (
            <Button key={t} size="sm" variant={tier === t ? 'default' : 'outline'} aria-pressed={tier === t} onClick={() => setTier(t)}>
              {t === 'BASIC' ? 'Basic' : 'Featured'}
            </Button>
          ))}
          {tier === 'FEATURED' && (
            <div className="space-y-1">
              <Label htmlFor={`until-${props.id}`} className="text-xs">
                Featured until
              </Label>
              <Input id={`until-${props.id}`} type="date" className="h-8" value={until} onChange={(e) => setUntil(e.target.value)} />
            </div>
          )}
          <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => saveEmployerPackage(props.slug, props.id, tier, tier === 'FEATURED' ? until : null))}>
            Save package
          </Button>
        </div>
      )}
      <Msg r={r} />
    </div>
  )
}

export function EmployerRoleForm({ slug }: { slug: string }) {
  const [state, action] = useActionState(postRoleForCollege.bind(null, slug), undefined)
  const [v, setV] = useState({ title: '', location: '', url: '', description: '' })
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: e.target.value })
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor="role-title">Job title</Label>
        <Input id="role-title" name="title" value={v.title} onChange={set('title')} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="role-location">Location</Label>
        <Input id="role-location" name="location" value={v.location} onChange={set('location')} placeholder="Pittsburgh, PA or Remote" />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="role-url">Link to the posting</Label>
        <Input id="role-url" name="url" type="url" value={v.url} onChange={set('url')} placeholder="https://" required />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="role-desc">Why this role suits these alumni (optional)</Label>
        <Input id="role-desc" name="description" value={v.description} onChange={set('description')} />
      </div>
      <div className="flex items-center gap-3 sm:col-span-2">
        <SubmitButton pendingLabel="Posting…">Post for these alumni</SubmitButton>
        <Msg r={state} />
      </div>
    </form>
  )
}
