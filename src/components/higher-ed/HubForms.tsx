'use client'

import { useActionState, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SubmitButton } from '@/components/ui/submit-button'
import { cn } from '@/lib/utils'
import { addMemberCompany, addParticipant, answerSeatRequestAction, inviteMemberContact, openLayoffSeats, saveLocalArea, setCompanyHiring, setLayoffOpen, type HubResult } from '@/app/i/[slug]/(portal)/hub-actions'

const sel = 'h-9 w-full rounded-md border border-input bg-background px-2 text-sm'
const area = 'min-h-20 w-full rounded-md border border-input bg-background p-2 text-sm'

function Msg({ r }: { r: HubResult }) {
  if (!r?.error && !r?.message) return null
  return (
    <p role={r.error ? 'alert' : 'status'} className={cn('text-sm', r.error ? 'text-destructive' : 'text-muted-foreground')}>
      {r.error ?? r.message}
    </p>
  )
}

export function MemberCompanyForm({ slug }: { slug: string }) {
  const [state, action] = useActionState<HubResult, FormData>(addMemberCompany.bind(null, slug), undefined)
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-3">
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="mc-name">Company</Label>
        <Input id="mc-name" name="name" required maxLength={120} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="mc-industry">Industry (optional)</Label>
        <Input id="mc-industry" name="industry" maxLength={80} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="mc-city">City (optional)</Label>
        <Input id="mc-city" name="city" maxLength={80} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="mc-state">State (optional)</Label>
        <Input id="mc-state" name="state" maxLength={2} placeholder="KY" className="uppercase" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="mc-contact">HR contact (optional)</Label>
        <Input id="mc-contact" name="contactName" maxLength={120} />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="mc-email">Contact email (optional)</Label>
        <Input id="mc-email" name="contactEmail" type="email" />
      </div>
      <label className="flex items-center gap-2 self-end pb-2 text-sm">
        <input type="checkbox" name="hiring" />
        Hiring now
      </label>
      <div className="flex items-center gap-3 sm:col-span-3">
        <SubmitButton pendingLabel="Adding…">Add company</SubmitButton>
        <Msg r={state} />
      </div>
    </form>
  )
}

export function HiringToggle({ slug, companyId, hiring }: { slug: string; companyId: string; hiring: boolean }) {
  const [on, setOn] = useState(hiring)
  const [err, setErr] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const set = (v: boolean) =>
    start(async () => {
      setErr(null)
      const r = await setCompanyHiring(slug, companyId, v)
      if (r.error) setErr(r.error)
      else setOn(v)
    })
  return (
    <span className={cn('inline-flex items-center gap-1', pending && 'cursor-wait')} role="group" aria-label="Hiring">
      <Button type="button" size="xs" variant={on ? 'default' : 'outline'} aria-pressed={on} disabled={pending} onClick={() => set(true)}>
        Hiring
      </Button>
      <Button type="button" size="xs" variant={!on ? 'default' : 'outline'} aria-pressed={!on} disabled={pending} onClick={() => set(false)}>
        Not hiring
      </Button>
      {err && <span className="text-xs text-destructive">{err}</span>}
    </span>
  )
}

export function LayoffSeatsForm({
  slug,
  companies,
  notices,
  seatsLeft,
  defaultCompanyId,
}: {
  slug: string
  companies: { id: string; name: string }[]
  notices: { id: string; label: string }[]
  seatsLeft: number
  defaultCompanyId?: string
}) {
  const [state, action] = useActionState<HubResult, FormData>(openLayoffSeats.bind(null, slug), undefined)
  if (!companies.length) return <p className="text-sm text-muted-foreground">Add the company first, under Member companies.</p>
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-3">
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="lo-company">Company with the layoff</Label>
        <select id="lo-company" name="companyId" className={sel} defaultValue={defaultCompanyId ?? companies[0].id}>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="lo-seats">Seats to give</Label>
        <Input id="lo-seats" name="seats" type="number" min={1} max={5000} required defaultValue={Math.min(25, Math.max(seatsLeft, 1))} />
        <p className="text-xs text-muted-foreground">{seatsLeft.toLocaleString()} left in your pool</p>
      </div>
      {notices.length > 0 && (
        <div className="space-y-1.5 sm:col-span-3">
          <Label htmlFor="lo-warn">The WARN notice, if there is one (optional)</Label>
          <select id="lo-warn" name="warnNoticeId" className={sel} defaultValue="">
            <option value="">None</option>
            {notices.map((n) => (
              <option key={n.id} value={n.id}>
                {n.label}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="space-y-1.5 sm:col-span-3">
        <Label htmlFor="lo-title">Headline on the sign-up page (optional)</Label>
        <Input id="lo-title" name="title" maxLength={140} placeholder="Free career support for … employees" />
      </div>
      <div className="space-y-1.5 sm:col-span-3">
        <Label htmlFor="lo-message">Message (optional)</Label>
        <textarea id="lo-message" name="message" maxLength={2000} className={area} placeholder="We write a plain message for you if you leave this blank." />
      </div>
      <div className="flex items-center gap-3 sm:col-span-3">
        <SubmitButton pendingLabel="Opening…">Open seats</SubmitButton>
        <Msg r={state} />
      </div>
    </form>
  )
}

export function LayoffOpenToggle({ slug, id, isActive }: { slug: string; id: string; isActive: boolean }) {
  const [open, setOpen] = useState(isActive)
  const [confirming, setConfirming] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const run = (v: boolean) =>
    start(async () => {
      setErr(null)
      const r = await setLayoffOpen(slug, id, v)
      if (r.error) setErr(r.error)
      else {
        setOpen(v)
        setConfirming(false)
      }
    })
  return (
    <span className={cn('inline-flex flex-wrap items-center gap-2', pending && 'cursor-wait')}>
      {open ? (
        confirming ? (
          <>
            <span className="text-xs text-muted-foreground">New sign-ups stop. People already signed up keep their seats.</span>
            <Button type="button" size="xs" variant="destructive" disabled={pending} onClick={() => run(false)}>
              Close sign-ups
            </Button>
            <Button type="button" size="xs" variant="ghost" autoFocus onClick={() => setConfirming(false)}>
              Keep open
            </Button>
          </>
        ) : (
          <Button type="button" size="xs" variant="outline" onClick={() => setConfirming(true)}>
            Close sign-ups
          </Button>
        )
      ) : (
        <Button type="button" size="xs" variant="outline" disabled={pending} onClick={() => run(true)}>
          Reopen sign-ups
        </Button>
      )}
      {err && <span className="text-xs text-destructive">{err}</span>}
    </span>
  )
}

export function ParticipantForm({ slug, companies }: { slug: string; companies: { id: string; name: string }[] }) {
  const [state, action] = useActionState<HubResult, FormData>(addParticipant.bind(null, slug), undefined)
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-3">
      <div className="space-y-1.5">
        <Label htmlFor="pa-first">First name</Label>
        <Input id="pa-first" name="firstName" required maxLength={80} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="pa-last">Last name</Label>
        <Input id="pa-last" name="lastName" maxLength={80} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="pa-email">Email</Label>
        <Input id="pa-email" name="email" type="email" required />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="pa-company">Laid off from (optional)</Label>
        <select id="pa-company" name="companyId" className={sel} defaultValue="">
          <option value="">Not a member company</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-end gap-3">
        <SubmitButton pendingLabel="Adding…">Add participant</SubmitButton>
      </div>
      <div className="sm:col-span-3">
        <Msg r={state} />
      </div>
    </form>
  )
}

export function LocalAreaForm({ slug, value }: { slug: string; value: { anchorCity: string; anchorState: string; radiusMiles: number; label: string } | null }) {
  const [state, action] = useActionState<HubResult, FormData>(saveLocalArea.bind(null, slug), undefined)
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-4">
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="la-city">Main city</Label>
        <Input id="la-city" name="anchorCity" required defaultValue={value?.anchorCity ?? ''} placeholder="Louisville" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="la-state">State</Label>
        <Input id="la-state" name="anchorState" required maxLength={2} defaultValue={value?.anchorState ?? ''} placeholder="KY" className="uppercase" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="la-radius">Miles around it</Label>
        <Input id="la-radius" name="radiusMiles" type="number" min={5} max={150} defaultValue={value?.radiusMiles ?? 40} />
      </div>
      <div className="space-y-1.5 sm:col-span-4">
        <Label htmlFor="la-label">What people call the region (optional)</Label>
        <Input id="la-label" name="label" maxLength={60} defaultValue={value?.label ?? ''} placeholder="the Louisville region" />
      </div>
      <div className="flex items-center gap-3 sm:col-span-4">
        <SubmitButton pendingLabel="Saving…">Save region</SubmitButton>
        <Msg r={state} />
      </div>
    </form>
  )
}

// A hiring member company's login: invite its contact, or show it's connected.
export function MemberAccess({
  slug,
  companyId,
  contactEmail,
  invitedAt,
  connected,
}: {
  slug: string
  companyId: string
  contactEmail: string | null
  invitedAt: string | null
  connected: boolean
}) {
  const [email, setEmail] = useState(contactEmail ?? '')
  const [open, setOpen] = useState(false)
  const [msg, setMsg] = useState<{ error?: string; message?: string; path?: string } | null>(null)
  const [pending, start] = useTransition()
  if (connected) return <span className="text-xs text-emerald-800">Connected</span>
  if (!open)
    return (
      <span className="flex flex-col items-start gap-1">
        {invitedAt && <span className="text-xs text-muted-foreground">Invited {new Date(invitedAt).toLocaleDateString('en-US', { timeZone: 'UTC' })}</span>}
        <Button type="button" size="xs" variant="outline" onClick={() => setOpen(true)}>
          {invitedAt ? 'Resend invite' : 'Give portal access'}
        </Button>
      </span>
    )
  return (
    <span className={cn('flex w-64 flex-col gap-1', pending && 'cursor-wait')}>
      <label htmlFor={`ma-${companyId}`} className="text-xs font-medium">
        Contact&apos;s work email
      </label>
      <span className="flex gap-1">
        <Input id={`ma-${companyId}`} type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-7" />
        <Button
          type="button"
          size="xs"
          disabled={pending || !email.trim()}
          onClick={() =>
            start(async () => {
              const r = await inviteMemberContact(slug, companyId, email)
              setMsg(r)
            })
          }
        >
          {pending ? 'Sending…' : 'Send'}
        </Button>
      </span>
      {!email.trim() && <span className="text-xs text-muted-foreground">Add an email to send the invite.</span>}
      {msg?.error && <span className="text-xs text-destructive">{msg.error}</span>}
      {msg?.message && <span className="text-xs text-muted-foreground">{msg.message}</span>}
      {msg?.path && !msg.error && (
        <a href={msg.path} target="_blank" className="text-xs break-all text-primary hover:underline">
          {msg.path}
        </a>
      )}
    </span>
  )
}

// A member company's seat request: approve (seats editable) or decline.
export function SeatRequestAnswer({ slug, id, requested }: { slug: string; id: string; requested: number }) {
  const [seats, setSeats] = useState(String(requested))
  const [done, setDone] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [confirmDecline, setConfirmDecline] = useState(false)
  const [pending, start] = useTransition()
  const run = (approve: boolean) =>
    start(async () => {
      setErr(null)
      const r = await answerSeatRequestAction(slug, id, approve, approve ? Number(seats) : undefined)
      if (r.error) setErr(r.error)
      else setDone(approve ? 'Approved. The company now has its sign-up page.' : 'Declined.')
    })
  if (done) return <span className="text-xs text-muted-foreground">{done}</span>
  return (
    <span className={cn('flex flex-wrap items-center gap-2', pending && 'cursor-wait')}>
      <label htmlFor={`sra-${id}`} className="text-xs">
        Seats
      </label>
      <Input id={`sra-${id}`} type="number" min={1} value={seats} onChange={(e) => setSeats(e.target.value)} className="h-7 w-20" />
      <Button type="button" size="xs" disabled={pending} onClick={() => run(true)}>
        Approve
      </Button>
      {confirmDecline ? (
        <>
          <Button type="button" size="xs" variant="destructive" disabled={pending} onClick={() => run(false)}>
            Decline request
          </Button>
          <Button type="button" size="xs" variant="ghost" autoFocus onClick={() => setConfirmDecline(false)}>
            Keep
          </Button>
        </>
      ) : (
        <Button type="button" size="xs" variant="outline" onClick={() => setConfirmDecline(true)}>
          Decline
        </Button>
      )}
      {err && <span className="text-xs text-destructive">{err}</span>}
    </span>
  )
}
