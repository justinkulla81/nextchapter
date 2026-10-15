'use client'

// Client controls for the lifecycle features: alumni intros, office hours,
// events, segments, attendance and completion rules, learners, rapid
// response. Busy cursor while anything runs; forms keep what was typed.

import { useActionState, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SubmitButton } from '@/components/ui/submit-button'
import { cn } from '@/lib/utils'
import {
  addLearnerForm,
  addOfficeHoursForm,
  answerAlumniIntroAction,
  askForAlumniIntro,
  bookOfficeHourAction,
  cancelOfficeHourAction,
  checkInAction,
  createEventForm,
  createRapidResponseForm,
  rsvpAction,
  saveSegmentForm,
  setCohortRulesForm,
  setProgressAction,
  type FormResult,
} from '@/app/i/[slug]/(portal)/lifecycle-actions'

type R = { error?: string; message?: string; ok?: boolean } | null | undefined

function Msg({ r }: { r: R }) {
  if (!r?.error && !r?.message) return null
  return (
    <p role={r.error ? 'alert' : 'status'} className={cn('text-sm', r.error ? 'text-destructive' : 'text-muted-foreground')}>
      {r.error ?? r.message}
    </p>
  )
}
const area = 'min-h-16 w-full rounded-md border border-input bg-background p-2 text-sm'
const sel = 'h-9 w-full rounded-md border border-input bg-background px-2 text-sm'

function useRun() {
  const [pending, start] = useTransition()
  const [r, setR] = useState<R>(null)
  const run = (fn: () => Promise<R>, after?: () => void) =>
    start(async () => {
      setR(null)
      const out = await fn()
      setR(out)
      if (!out?.error) after?.()
    })
  return { pending, r, run }
}

// ── Intros ──────────────────────────────────────────────────────────────────

const PURPOSES = [
  ['exploring', 'Learning about it'],
  ['applying', 'Applying'],
  ['interviewing', 'Interviewing'],
  ['offer', 'Weighing an offer'],
  ['referral', 'Asking for a referral'],
] as const

export function AskIntro({ slug, targetMemberId, companyName, name }: { slug: string; targetMemberId: string; companyName: string; name: string }) {
  const [open, setOpen] = useState(false)
  const [purpose, setPurpose] = useState<string>('applying')
  const [note, setNote] = useState('')
  const [jobUrl, setJobUrl] = useState('')
  const { pending, r, run } = useRun()
  if (r?.ok) return <Msg r={r} />
  if (!open)
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        Ask {name.split(' ')[0]} for 15 minutes or a referral
      </Button>
    )
  return (
    <div className={cn('w-full space-y-2', pending && 'cursor-wait')}>
      <select aria-label="Why you're asking" className={sel} value={purpose} onChange={(e) => setPurpose(e.target.value)}>
        {PURPOSES.map(([k, l]) => (
          <option key={k} value={k}>
            {l}
          </option>
        ))}
      </select>
      {purpose === 'referral' && (
        <input aria-label="Link to the job" type="url" className={sel} placeholder="Link to the job you want to be referred for (https://…)" value={jobUrl} onChange={(e) => setJobUrl(e.target.value)} />
      )}
      <textarea aria-label="A short note" className={area} placeholder="What you’d like to ask, in a sentence or two." value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
      <div className="flex gap-2">
        <Button size="sm" disabled={pending} onClick={() => run(() => askForAlumniIntro(slug, targetMemberId, companyName, purpose, note, purpose === 'referral' ? jobUrl : null))}>
          {pending ? 'Sending…' : 'Send request'}
        </Button>
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
      <Msg r={r} />
    </div>
  )
}

export function AnswerIntro({ slug, requestId }: { slug: string; requestId: string }) {
  const { pending, r, run } = useRun()
  if (r?.ok) return <Msg r={r} />
  return (
    <div className={cn('flex flex-wrap gap-2', pending && 'cursor-wait')}>
      <Button size="sm" disabled={pending} onClick={() => run(() => answerAlumniIntroAction(slug, requestId, true))}>
        Accept and share my email
      </Button>
      <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => answerAlumniIntroAction(slug, requestId, false))}>
        Not right now
      </Button>
      <Msg r={r} />
    </div>
  )
}

// ── Office hours ────────────────────────────────────────────────────────────

export function OfficeHoursForm({ slug, zone }: { slug: string; zone: string }) {
  const [state, action] = useActionState<FormResult, FormData>(addOfficeHoursForm.bind(null, slug), undefined)
  const [v, setV] = useState({ date: '', time: '12:00', count: '2', minutes: '20', topic: '' })
  const bind = (k: keyof typeof v) => ({ name: k, value: v[k], onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV({ ...v, [k]: e.target.value }) })
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-5">
      <div className="space-y-1.5">
        <Label htmlFor="oh-date">Day</Label>
        <Input id="oh-date" type="date" {...bind('date')} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="oh-time">Start ({zone})</Label>
        <Input id="oh-time" type="time" {...bind('time')} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="oh-count">Slots in a row</Label>
        <select id="oh-count" className={sel} {...bind('count')}>
          {[1, 2, 3, 4].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="oh-min">Minutes each</Label>
        <select id="oh-min" className={sel} {...bind('minutes')}>
          {[15, 20, 30].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="oh-topic">Good for (optional)</Label>
        <Input id="oh-topic" {...bind('topic')} placeholder="Résumés, mock interviews" />
      </div>
      <div className="flex items-center gap-3 sm:col-span-5">
        <SubmitButton pendingLabel="Adding…">Add office hours</SubmitButton>
        <Msg r={state} />
      </div>
    </form>
  )
}

export function BookSlot({ slug, slotId }: { slug: string; slotId: string }) {
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState('')
  const { pending, r, run } = useRun()
  if (r?.ok) return <Msg r={r} />
  if (!open)
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        Book
      </Button>
    )
  return (
    <div className={cn('w-full space-y-2', pending && 'cursor-wait')}>
      <Input aria-label="What you'd like to cover" placeholder="What you’d like to cover" value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} />
      <div className="flex gap-2">
        <Button size="sm" disabled={pending} onClick={() => run(() => bookOfficeHourAction(slug, slotId, note))}>
          {pending ? 'Booking…' : 'Book this time'}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
      <Msg r={r} />
    </div>
  )
}

export function CancelSlot({ slug, slotId, label }: { slug: string; slotId: string; label: string }) {
  const [confirming, setConfirming] = useState(false)
  const { pending, r, run } = useRun()
  if (r?.ok) return <span className="text-xs text-muted-foreground">Cancelled</span>
  return confirming ? (
    <span className={cn('flex items-center gap-2', pending && 'cursor-wait')}>
      <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => cancelOfficeHourAction(slug, slotId))}>
        {label}
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setConfirming(false)} autoFocus>
        Keep it
      </Button>
      <Msg r={r} />
    </span>
  ) : (
    <Button size="sm" variant="ghost" onClick={() => setConfirming(true)}>
      {label}
    </Button>
  )
}

// ── Events ──────────────────────────────────────────────────────────────────

export function RsvpButton({ slug, eventId, going: initial, full }: { slug: string; eventId: string; going: boolean; full: boolean }) {
  const [going, setGoing] = useState(initial)
  const { pending, r, run } = useRun()
  return (
    <div className={cn('flex items-center gap-2', pending && 'cursor-wait')}>
      {going ? (
        <>
          <span className="text-sm text-primary">You’re going</span>
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => rsvpAction(slug, eventId, false), () => setGoing(false))}>
            Can’t make it
          </Button>
        </>
      ) : full ? (
        <span className="text-xs text-muted-foreground">Full</span>
      ) : (
        <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => rsvpAction(slug, eventId, true), () => setGoing(true))}>
          RSVP
        </Button>
      )}
      {r?.error && <Msg r={r} />}
    </div>
  )
}

const KINDS = [
  ['panel', 'Career panel'],
  ['employer_night', 'Employer night'],
  ['workshop', 'Workshop'],
  ['networking', 'Networking'],
] as const

export function EventForm({ slug, zone }: { slug: string; zone: string }) {
  const [state, action] = useActionState<FormResult, FormData>(createEventForm.bind(null, slug), undefined)
  const [v, setV] = useState({ title: '', kind: 'panel', date: '', time: '18:00', location: '', url: '', capacity: '', description: '' })
  const bind = (k: keyof typeof v) => ({ name: k, value: v[k], onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setV({ ...v, [k]: e.target.value }) })
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-3">
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="ev-title">Title</Label>
        <Input id="ev-title" {...bind('title')} placeholder="Careers in healthcare: a panel of W&J alumni" />
      </div>
      <fieldset className="space-y-1.5">
        <legend className="text-sm font-medium">Kind</legend>
        <input type="hidden" name="kind" value={v.kind} />
        <div className="flex flex-wrap gap-1">
          {KINDS.map(([k, l]) => (
            <Button key={k} type="button" size="sm" variant={v.kind === k ? 'default' : 'outline'} aria-pressed={v.kind === k} onClick={() => setV({ ...v, kind: k })}>
              {l}
            </Button>
          ))}
        </div>
      </fieldset>
      <div className="space-y-1.5">
        <Label htmlFor="ev-date">Date</Label>
        <Input id="ev-date" type="date" {...bind('date')} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ev-time">Start ({zone})</Label>
        <Input id="ev-time" type="time" {...bind('time')} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ev-cap">Capacity (blank: no limit)</Label>
        <Input id="ev-cap" inputMode="numeric" {...bind('capacity')} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ev-loc">Where</Label>
        <Input id="ev-loc" {...bind('location')} placeholder="Rossin Campus Center, or Online" />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="ev-url">Link (registration or video)</Label>
        <Input id="ev-url" type="url" {...bind('url')} placeholder="https://" />
      </div>
      <div className="space-y-1.5 sm:col-span-3">
        <Label htmlFor="ev-desc">Description</Label>
        <textarea id="ev-desc" className={area} {...bind('description')} />
      </div>
      <div className="flex items-center gap-3 sm:col-span-3">
        <SubmitButton pendingLabel="Adding…">Add event</SubmitButton>
        <Msg r={state} />
      </div>
    </form>
  )
}

export function CheckInToggle({ slug, rsvpId, checkedIn }: { slug: string; rsvpId: string; checkedIn: boolean }) {
  const [on, setOn] = useState(checkedIn)
  const { pending, r, run } = useRun()
  return (
    <label className={cn('flex items-center gap-2 text-xs', pending && 'cursor-wait')}>
      <input type="checkbox" checked={on} disabled={pending} onChange={(e) => { const next = e.target.checked; run(() => checkInAction(slug, rsvpId, next), () => setOn(next)) }} />
      {on ? 'Checked in' : 'Check in'}
      {r?.error && <Msg r={r} />}
    </label>
  )
}

// ── Segments ────────────────────────────────────────────────────────────────

export function SegmentForm({ slug, majors, metros }: { slug: string; majors: string[]; metros: string[] }) {
  const [state, action] = useActionState<FormResult, FormData>(saveSegmentForm.bind(null, slug), undefined)
  const [v, setV] = useState({ name: '', classFrom: '', classTo: '', joined: '', employerContains: '', metro: '' })
  const [picked, setPicked] = useState<string[]>([])
  const [transition, setTransition] = useState(false)
  const bind = (k: keyof typeof v) => ({ name: k, value: v[k], onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV({ ...v, [k]: e.target.value }) })
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-3">
      <div className="space-y-1.5 sm:col-span-3">
        <Label htmlFor="sg-name">Segment name</Label>
        <Input id="sg-name" {...bind('name')} placeholder="Laid off, class of 2000–2010, Pittsburgh" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="sg-from">Class from</Label>
        <Input id="sg-from" inputMode="numeric" {...bind('classFrom')} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="sg-to">Class to</Label>
        <Input id="sg-to" inputMode="numeric" {...bind('classTo')} />
      </div>
      <fieldset className="space-y-1.5">
        <legend className="text-sm font-medium">Joined</legend>
        <input type="hidden" name="joined" value={v.joined} />
        <div className="flex gap-1">
          {[
            ['', 'Either'],
            ['joined', 'Joined'],
            ['not_joined', 'Not yet'],
          ].map(([k, l]) => (
            <Button key={k} type="button" size="sm" variant={v.joined === k ? 'default' : 'outline'} aria-pressed={v.joined === k} onClick={() => setV({ ...v, joined: k })}>
              {l}
            </Button>
          ))}
        </div>
      </fieldset>
      <div className="space-y-1.5">
        <Label htmlFor="sg-emp">Works at (roster employer contains)</Label>
        <Input id="sg-emp" {...bind('employerContains')} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="sg-metro">Metro (joined alumni)</Label>
        <select id="sg-metro" className={sel} {...bind('metro')}>
          <option value="">Any</option>
          {metros.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>
      <label className="flex items-end gap-2 pb-2 text-sm">
        <input type="checkbox" name="inTransition" checked={transition} onChange={(e) => setTransition(e.target.checked)} />
        In transition only
      </label>
      {majors.length > 0 && (
        <fieldset className="space-y-1.5 sm:col-span-3">
          <legend className="text-sm font-medium">Majors (any)</legend>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {majors.map((m) => (
              <label key={m} className="flex items-center gap-1.5 text-sm">
                <input type="checkbox" name="majors" value={m} checked={picked.includes(m)} onChange={(e) => setPicked(e.target.checked ? [...picked, m] : picked.filter((x) => x !== m))} />
                {m}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <div className="flex items-center gap-3 sm:col-span-3">
        <SubmitButton variant="outline" pendingLabel="Saving…">
          Save segment
        </SubmitButton>
        <Msg r={state} />
      </div>
    </form>
  )
}

// ── Exec Ed: attendance, completion rules, learners ────────────────────────

export function ProgressControls(props: { slug: string; enrollmentId: string; attended: number; sessions: number | null; capstone: boolean; needsCapstone: boolean }) {
  const [attended, setAttended] = useState(props.attended)
  const [capstone, setCapstone] = useState(props.capstone)
  const { pending, r, run } = useRun()
  return (
    <div className={cn('flex flex-wrap items-center gap-2 text-xs', pending && 'cursor-wait')}>
      {props.sessions !== null && (
        <span className="flex items-center gap-1">
          <Button size="sm" variant="ghost" aria-label="One fewer session" disabled={pending || attended <= 0} onClick={() => run(() => setProgressAction(props.slug, props.enrollmentId, { sessionsAttended: attended - 1 }), () => setAttended(attended - 1))}>
            −
          </Button>
          <span className="tabular-nums">
            {attended} of {props.sessions} sessions
          </span>
          <Button size="sm" variant="ghost" aria-label="One more session" disabled={pending || attended >= (props.sessions ?? 0)} onClick={() => run(() => setProgressAction(props.slug, props.enrollmentId, { sessionsAttended: attended + 1 }), () => setAttended(attended + 1))}>
            +
          </Button>
        </span>
      )}
      {props.needsCapstone && (
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={capstone} disabled={pending} onChange={(e) => { const next = e.target.checked; run(() => setProgressAction(props.slug, props.enrollmentId, { capstoneDone: next }), () => setCapstone(next)) }} />
          Capstone done
        </label>
      )}
      {r?.error && <Msg r={r} />}
    </div>
  )
}

export function CohortRulesForm({ slug, cohortId, defaults }: { slug: string; cohortId: string; defaults: { sessionsTotal: number | null; minAttendancePct: number | null; requiresCapstone: boolean } }) {
  const [state, action] = useActionState<FormResult, FormData>(setCohortRulesForm.bind(null, slug, cohortId), undefined)
  const [s, setS] = useState(defaults.sessionsTotal ? String(defaults.sessionsTotal) : '')
  const [p, setP] = useState(defaults.minAttendancePct ? String(defaults.minAttendancePct) : '')
  const [cap, setCap] = useState(defaults.requiresCapstone)
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <div className="space-y-1">
        <Label htmlFor={`rs-${cohortId}`} className="text-xs">
          Sessions
        </Label>
        <Input id={`rs-${cohortId}`} name="sessionsTotal" inputMode="numeric" className="h-8 w-20" value={s} onChange={(e) => setS(e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`rp-${cohortId}`} className="text-xs">
          Attend at least (%)
        </Label>
        <Input id={`rp-${cohortId}`} name="minAttendancePct" inputMode="numeric" className="h-8 w-20" value={p} onChange={(e) => setP(e.target.value)} />
      </div>
      <label className="flex items-center gap-1.5 pb-1.5 text-xs">
        <input type="checkbox" name="requiresCapstone" checked={cap} onChange={(e) => setCap(e.target.checked)} />
        Capstone required
      </label>
      <SubmitButton size="sm" variant="outline" pendingLabel="Saving…">
        Save completion rule
      </SubmitButton>
      <Msg r={state} />
    </form>
  )
}

export function LearnerForm({ slug, cohorts, clients }: { slug: string; cohorts: { id: string; label: string }[]; clients: { id: string; name: string }[] }) {
  const [state, action] = useActionState<FormResult, FormData>(addLearnerForm.bind(null, slug), undefined)
  const [v, setV] = useState({ firstName: '', lastName: '', email: '', cohortId: cohorts[0]?.id ?? '', payer: 'EMPLOYER', clientId: clients[0]?.id ?? '' })
  const bind = (k: keyof typeof v) => ({ name: k, value: v[k], onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV({ ...v, [k]: e.target.value }) })
  if (!cohorts.length) return <p className="text-sm text-muted-foreground">Add a cohort first.</p>
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-3">
      <div className="space-y-1.5">
        <Label htmlFor="ln-first">First name</Label>
        <Input id="ln-first" {...bind('firstName')} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ln-last">Last name</Label>
        <Input id="ln-last" {...bind('lastName')} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ln-email">Email</Label>
        <Input id="ln-email" type="email" {...bind('email')} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ln-cohort">Cohort</Label>
        <select id="ln-cohort" className={sel} {...bind('cohortId')}>
          {cohorts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </div>
      <fieldset className="space-y-1.5">
        <legend className="text-sm font-medium">Who pays</legend>
        <input type="hidden" name="payer" value={v.payer} />
        <div className="flex flex-wrap gap-1">
          {[
            ['EMPLOYER', 'Employer'],
            ['SELF_PAY', 'Self-pay'],
            ['WIOA_VOUCHER', 'WIOA'],
          ].map(([k, l]) => (
            <Button key={k} type="button" size="sm" variant={v.payer === k ? 'default' : 'outline'} aria-pressed={v.payer === k} onClick={() => setV({ ...v, payer: k })}>
              {l}
            </Button>
          ))}
        </div>
      </fieldset>
      {v.payer === 'EMPLOYER' && clients.length > 0 && (
        <div className="space-y-1.5">
          <Label htmlFor="ln-client">Corporate client</Label>
          <select id="ln-client" className={sel} {...bind('clientId')}>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="flex items-center gap-3 sm:col-span-3">
        <SubmitButton pendingLabel="Enrolling…">Enroll learner</SubmitButton>
        <Msg r={state} />
      </div>
    </form>
  )
}

// ── Workforce: rapid response ───────────────────────────────────────────────

export function RapidResponseForm(props: { slug: string; warnNoticeId: string | null; employerName: string; programs: { id: string; name: string }[]; college: string }) {
  const [state, action] = useActionState<FormResult, FormData>(createRapidResponseForm.bind(null, props.slug, props.warnNoticeId, props.employerName), undefined)
  const [title, setTitle] = useState(`Free retraining for ${props.employerName} employees`)
  const [message, setMessage] = useState(
    `If you're affected by the layoff at ${props.employerName}, ${props.college} and the local workforce board can cover a short program to help you land your next role. WIOA funding may pay the full cost. Pick a program and we'll be in touch within two business days.`,
  )
  const [picked, setPicked] = useState<string[]>(props.programs.map((p) => p.id))
  return (
    <form action={action} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor={`rr-t-${props.employerName}`}>Title</Label>
        <Input id={`rr-t-${props.employerName}`} name="title" value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`rr-m-${props.employerName}`}>Message to affected workers</Label>
        <textarea id={`rr-m-${props.employerName}`} name="message" className={area} value={message} onChange={(e) => setMessage(e.target.value)} />
      </div>
      <fieldset className="space-y-1">
        <legend className="text-sm font-medium">Programs offered</legend>
        {props.programs.map((p) => (
          <label key={p.id} className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="programIds" value={p.id} checked={picked.includes(p.id)} onChange={(e) => setPicked(e.target.checked ? [...picked, p.id] : picked.filter((x) => x !== p.id))} />
            {p.name}
          </label>
        ))}
      </fieldset>
      <div className="flex items-center gap-3">
        <SubmitButton pendingLabel="Creating…">Create the offer and sign-up page</SubmitButton>
        <Msg r={state} />
      </div>
    </form>
  )
}
