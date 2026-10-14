'use client'

// Client controls for work, people, mentoring, learning, giving time, news,
// portal features and privacy requests. Three shared patterns keep every
// screen the same: ActionButton (one click), NoteAction (a note, then send)
// and the create forms (inputs stay filled if a save fails). Busy cursor
// while anything runs; every result is said in words.

import { useActionState, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SubmitButton } from '@/components/ui/submit-button'
import { cn } from '@/lib/utils'
import * as A from '@/app/i/[slug]/(portal)/community-actions'

type R = { error?: string; message?: string; ok?: boolean } | null | undefined
type FormAction = (prev: A.FormResult, f: FormData) => Promise<A.FormResult>

function Msg({ r }: { r: R }) {
  if (!r?.error && !r?.message) return null
  return (
    <p role={r.error ? 'alert' : 'status'} className={cn('text-sm', r.error ? 'text-destructive' : 'text-muted-foreground')}>
      {r.error ?? r.message}
    </p>
  )
}
const area = 'min-h-20 w-full rounded-md border border-input bg-background p-2 text-sm'
const sel = 'h-9 w-full rounded-md border border-input bg-background px-2 text-sm'

export function ActionButton({ label, run, variant = 'outline', done }: { label: string; run: () => Promise<R>; variant?: 'default' | 'outline' | 'ghost'; done?: string }) {
  const [pending, start] = useTransition()
  const [r, setR] = useState<R>(null)
  if (r?.ok && done) return <span className="text-xs text-muted-foreground">{done}</span>
  return (
    <span className={cn('inline-flex flex-wrap items-center gap-2', pending && 'cursor-wait')}>
      <Button size="sm" variant={variant} disabled={pending} onClick={() => start(async () => setR(await run()))}>
        {label}
      </Button>
      <Msg r={r && !r.ok ? r : r?.message ? r : null} />
    </span>
  )
}

export function NoteAction({ label, sendLabel, placeholder, run }: { label: string; sendLabel: string; placeholder: string; run: (note: string) => Promise<R> }) {
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState('')
  const [pending, start] = useTransition()
  const [r, setR] = useState<R>(null)
  if (r?.ok) return <Msg r={r} />
  if (!open)
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        {label}
      </Button>
    )
  return (
    <div className={cn('w-full space-y-2', pending && 'cursor-wait')}>
      <textarea aria-label={placeholder} className={area} placeholder={placeholder} value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} />
      <div className="flex gap-2">
        <Button size="sm" disabled={pending} onClick={() => start(async () => setR(await run(note)))}>
          {pending ? 'Sending…' : sendLabel}
        </Button>
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
      <Msg r={r} />
    </div>
  )
}

function Choice({ name, value, options, onChange }: { name: string; value: string; options: readonly { key: string; label: string }[]; onChange: (v: string) => void }) {
  return (
    <>
      <input type="hidden" name={name} value={value} />
      {options.length <= 4 ? (
        <div className="flex flex-wrap gap-1">
          {options.map((o) => (
            <Button key={o.key} type="button" size="sm" variant={value === o.key ? 'default' : 'outline'} aria-pressed={value === o.key} onClick={() => onChange(o.key)}>
              {o.label}
            </Button>
          ))}
        </div>
      ) : (
        <select className={sel} value={value} onChange={(e) => onChange(e.target.value)} aria-label={name}>
          {options.map((o) => (
            <option key={o.key} value={o.key}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </>
  )
}

function useFields<T extends Record<string, string>>(init: T) {
  const [v, setV] = useState(init)
  const bind = (k: keyof T) => ({ name: k as string, value: v[k], onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setV({ ...v, [k]: e.target.value }) })
  return { v, setV, bind }
}

// ── Projects and boards ─────────────────────────────────────────────────────

const KINDS = [
  { key: 'project', label: 'Short project' },
  { key: 'fractional', label: 'Fractional role' },
  { key: 'board', label: 'Board seat' },
  { key: 'advisory', label: 'Advisory role' },
] as const
const PAY = [
  { key: 'paid', label: 'Paid' },
  { key: 'equity', label: 'Equity' },
  { key: 'volunteer', label: 'Volunteer' },
] as const

export function OpportunityForm({ slug, as }: { slug: string; as: 'member' | 'staff' }) {
  const [state, action] = useActionState<A.FormResult, FormData>(A.postOpportunityForm.bind(null, slug, as) as FormAction, undefined)
  const { v, setV, bind } = useFields({ kind: 'project', compensation: 'paid', title: '', organization: '', description: '', skills: '', hoursPerWeek: '', durationWeeks: '', location: 'Remote' })
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <fieldset className="space-y-1.5 sm:col-span-2">
        <legend className="text-sm font-medium">What is it?</legend>
        <Choice name="kind" value={v.kind} options={KINDS} onChange={(k) => setV({ ...v, kind: k })} />
      </fieldset>
      <div className="space-y-1.5">
        <Label htmlFor="op-title">Title</Label>
        <Input id="op-title" {...bind('title')} placeholder="Build our first sales dashboard" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="op-org">Organization</Label>
        <Input id="op-org" {...bind('organization')} placeholder="Your company or the nonprofit" />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="op-desc">The work, the time it takes, what good looks like</Label>
        <textarea id="op-desc" className={area} {...bind('description')} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="op-skills">Skills (comma-separated)</Label>
        <Input id="op-skills" {...bind('skills')} />
      </div>
      <fieldset className="space-y-1.5">
        <legend className="text-sm font-medium">Paid?</legend>
        <Choice name="compensation" value={v.compensation} options={PAY} onChange={(k) => setV({ ...v, compensation: k })} />
      </fieldset>
      <div className="space-y-1.5">
        <Label htmlFor="op-hours">Hours a week</Label>
        <Input id="op-hours" inputMode="numeric" {...bind('hoursPerWeek')} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="op-weeks">How many weeks</Label>
        <Input id="op-weeks" inputMode="numeric" {...bind('durationWeeks')} />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="op-loc">Where</Label>
        <Input id="op-loc" {...bind('location')} />
      </div>
      <div className="flex items-center gap-3 sm:col-span-2">
        <SubmitButton pendingLabel="Posting…">Post to alumni</SubmitButton>
        <Msg r={state} />
      </div>
    </form>
  )
}

// ── People ──────────────────────────────────────────────────────────────────

export function ListedToggle({ slug, listed: initial }: { slug: string; listed: boolean }) {
  const [listed, setListed] = useState(initial)
  const [pending, start] = useTransition()
  const [r, setR] = useState<R>(null)
  return (
    <div className={cn('space-y-1', pending && 'cursor-wait')}>
      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          checked={listed}
          disabled={pending}
          onChange={(e) => {
            const next = e.target.checked
            start(async () => {
              const out = await A.setListed(slug, next)
              setR(out)
              if (!out.error) setListed(next)
            })
          }}
        />
        List me in the alumni directory
      </label>
      <p className="text-xs text-muted-foreground">Fellow alumni see your name, class, major and city, plus your title and employer if you share your outcome. Nobody sees your email unless you accept an intro.</p>
      <Msg r={r} />
    </div>
  )
}

export function GroupForm({ slug }: { slug: string }) {
  const [state, action] = useActionState<A.FormResult, FormData>(A.createGroupForm.bind(null, slug) as FormAction, undefined)
  const { v, setV, bind } = useFields({ kind: 'affinity', name: '', description: '', metro: '', leaderEmail: '' })
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <fieldset className="space-y-1.5 sm:col-span-2">
        <legend className="text-sm font-medium">Kind</legend>
        <Choice name="kind" value={v.kind} options={[{ key: 'affinity', label: 'Affinity group' }, { key: 'chapter', label: 'Regional chapter' }]} onChange={(k) => setV({ ...v, kind: k })} />
      </fieldset>
      <div className="space-y-1.5">
        <Label htmlFor="gr-name">Name</Label>
        <Input id="gr-name" {...bind('name')} placeholder={v.kind === 'chapter' ? 'Pittsburgh Chapter' : 'Women in Business'} />
      </div>
      {v.kind === 'chapter' && (
        <div className="space-y-1.5">
          <Label htmlFor="gr-metro">City</Label>
          <Input id="gr-metro" {...bind('metro')} placeholder="Pittsburgh" />
        </div>
      )}
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="gr-desc">What it’s for</Label>
        <Input id="gr-desc" {...bind('description')} />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="gr-lead">First leader’s email (optional, must be on the roster)</Label>
        <Input id="gr-lead" type="email" {...bind('leaderEmail')} />
      </div>
      <div className="flex items-center gap-3 sm:col-span-2">
        <SubmitButton pendingLabel="Adding…">Add group</SubmitButton>
        <Msg r={state} />
      </div>
    </form>
  )
}

export function LeaderForm({ slug, groupId }: { slug: string; groupId: string }) {
  const [email, setEmail] = useState('')
  const [pending, start] = useTransition()
  const [r, setR] = useState<R>(null)
  return (
    <div className={cn('flex flex-wrap items-center gap-2', pending && 'cursor-wait')}>
      <Input aria-label="Leader's email" className="h-8 w-56" type="email" placeholder="Leader’s roster email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <Button size="sm" variant="outline" disabled={pending || !email} onClick={() => start(async () => setR(await A.setGroupLeader(slug, groupId, email)))}>
        Add leader
      </Button>
      <Msg r={r} />
    </div>
  )
}

export function LeaderEventForm({ slug, groupId, zone }: { slug: string; groupId: string; zone: string }) {
  const [state, action] = useActionState<A.FormResult, FormData>(A.leaderEventForm.bind(null, slug, groupId) as FormAction, undefined)
  const { bind } = useFields({ title: '', date: '', time: '18:00', location: '' })
  return (
    <form action={action} className="grid gap-2 sm:grid-cols-4">
      <Input aria-label="Event title" placeholder="Event title" {...bind('title')} className="sm:col-span-2" />
      <Input aria-label="Date" type="date" {...bind('date')} />
      <Input aria-label={`Start (${zone})`} type="time" {...bind('time')} />
      <Input aria-label="Where" placeholder="Where" {...bind('location')} className="sm:col-span-2" />
      <div className="flex items-center gap-3 sm:col-span-2">
        <SubmitButton size="sm" pendingLabel="Adding…">
          Add group event
        </SubmitButton>
        <Msg r={state} />
      </div>
    </form>
  )
}

export function AskForm({ slug, topics }: { slug: string; topics: string[] }) {
  const [topic, setTopic] = useState('general')
  const [body, setBody] = useState('')
  const [pending, start] = useTransition()
  const [r, setR] = useState<R>(null)
  return (
    <div className={cn('space-y-2', pending && 'cursor-wait')}>
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="ask-topic" className="text-sm">
          Field
        </label>
        <select id="ask-topic" className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={topic} onChange={(e) => setTopic(e.target.value)}>
          <option value="general">General</option>
          {topics.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>
      <textarea aria-label="Your question" className={area} placeholder="What would you like to ask alumni?" value={body} maxLength={1500} onChange={(e) => setBody(e.target.value)} />
      <Button
        size="sm"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const out = await A.askQuestion(slug, topic, body)
            setR(out)
            if (!out.error) setBody('')
          })
        }
      >
        {pending ? 'Posting…' : 'Ask alumni'}
      </Button>
      <Msg r={r} />
    </div>
  )
}

// ── Mentoring ───────────────────────────────────────────────────────────────

export function CohortSignup({ slug, cohortId }: { slug: string; cohortId: string }) {
  const [role, setRole] = useState<'mentee' | 'mentor'>('mentee')
  const [goals, setGoals] = useState('')
  const [open, setOpen] = useState(false)
  const [pending, start] = useTransition()
  const [r, setR] = useState<R>(null)
  if (r?.ok) return <Msg r={r} />
  if (!open)
    return (
      <Button size="sm" onClick={() => setOpen(true)}>
        Sign up
      </Button>
    )
  return (
    <div className={cn('w-full space-y-2', pending && 'cursor-wait')}>
      <div className="flex gap-1" role="radiogroup" aria-label="Role">
        {(['mentee', 'mentor'] as const).map((k) => (
          <Button key={k} type="button" size="sm" role="radio" aria-checked={role === k} variant={role === k ? 'default' : 'outline'} onClick={() => setRole(k)}>
            {k === 'mentee' ? 'I want a mentor' : 'I’ll mentor'}
          </Button>
        ))}
      </div>
      <textarea aria-label="Goals" className={area} placeholder={role === 'mentee' ? 'What you want out of it' : 'What you can help with'} value={goals} onChange={(e) => setGoals(e.target.value)} />
      <Button size="sm" disabled={pending} onClick={() => start(async () => setR(await A.cohortSignupAction(slug, cohortId, role, goals)))}>
        {pending ? 'Signing up…' : 'Sign me up'}
      </Button>
      <Msg r={r} />
    </div>
  )
}

export function CohortForm({ slug }: { slug: string }) {
  const [state, action] = useActionState<A.FormResult, FormData>(A.createCohortForm.bind(null, slug) as FormAction, undefined)
  const { bind } = useFields({ name: '', theme: '', startsAt: '', weeks: '12' })
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-4">
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="mc-name">Program name</Label>
        <Input id="mc-name" {...bind('name')} placeholder="Spring mentoring: career changers" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="mc-start">Starts</Label>
        <Input id="mc-start" type="date" {...bind('startsAt')} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="mc-weeks">Weeks</Label>
        <Input id="mc-weeks" inputMode="numeric" {...bind('weeks')} />
      </div>
      <div className="space-y-1.5 sm:col-span-4">
        <Label htmlFor="mc-theme">Theme (optional)</Label>
        <Input id="mc-theme" {...bind('theme')} />
      </div>
      <div className="flex items-center gap-3 sm:col-span-4">
        <SubmitButton pendingLabel="Starting…">Open for sign-ups</SubmitButton>
        <Msg r={state} />
      </div>
    </form>
  )
}

export function MatchControl({ slug, cohortId, menteeId, suggested, options }: { slug: string; cohortId: string; menteeId: string; suggested: string | null; options: { id: string; name: string; load: number }[] }) {
  const [mentorId, setMentorId] = useState(suggested ?? options[0]?.id ?? '')
  const [pending, start] = useTransition()
  const [r, setR] = useState<R>(null)
  if (r?.ok) return <Msg r={r} />
  if (!options.length) return <span className="text-xs text-muted-foreground">No mentors signed up yet.</span>
  return (
    <span className={cn('flex flex-wrap items-center gap-2', pending && 'cursor-wait')}>
      <select aria-label="Mentor" className="h-8 rounded-md border border-input bg-background px-2 text-sm" value={mentorId} onChange={(e) => setMentorId(e.target.value)}>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name} ({o.load} mentees){o.id === suggested ? ' · suggested' : ''}
          </option>
        ))}
      </select>
      <Button size="sm" variant="outline" disabled={pending} onClick={() => start(async () => setR(await A.matchAction(slug, cohortId, mentorId, menteeId)))}>
        Match and email both
      </Button>
      <Msg r={r && !r.ok ? r : null} />
    </span>
  )
}

export function RateMentoring({ slug, pairId }: { slug: string; pairId: string }) {
  const [pending, start] = useTransition()
  const [r, setR] = useState<R>(null)
  if (r?.ok) return <Msg r={r} />
  return (
    <span className={cn('flex flex-wrap items-center gap-1 text-xs', pending && 'cursor-wait')}>
      How was it?
      {[1, 2, 3, 4, 5].map((n) => (
        <Button key={n} size="sm" variant="ghost" aria-label={`${n} of 5`} disabled={pending} onClick={() => start(async () => setR(await A.rateMentoring(slug, pairId, n)))}>
          {n}
        </Button>
      ))}
      <Msg r={r} />
    </span>
  )
}

// ── Learning: course auditing ───────────────────────────────────────────────

export function AuditCourseForm({ slug }: { slug: string }) {
  const [state, action] = useActionState<A.FormResult, FormData>(A.auditCourseForm.bind(null, slug) as FormAction, undefined)
  const { v, setV, bind } = useFields({ title: '', courseCode: '', term: '', schedule: '', modality: 'in_person', seats: '5', description: '', skills: '' })
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-3">
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="ac-title">Course</Label>
        <Input id="ac-title" {...bind('title')} placeholder="Behavioral Economics" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ac-code">Code</Label>
        <Input id="ac-code" {...bind('courseCode')} placeholder="ECO 340" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ac-term">Term</Label>
        <Input id="ac-term" {...bind('term')} placeholder="Spring 2027" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ac-sched">When</Label>
        <Input id="ac-sched" {...bind('schedule')} placeholder="Tue/Thu 2:00–3:15" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ac-seats">Auditor seats</Label>
        <Input id="ac-seats" inputMode="numeric" {...bind('seats')} />
      </div>
      <fieldset className="space-y-1.5 sm:col-span-3">
        <legend className="text-sm font-medium">Format</legend>
        <Choice name="modality" value={v.modality} options={[{ key: 'in_person', label: 'In person' }, { key: 'online', label: 'Online' }, { key: 'hybrid', label: 'Hybrid' }]} onChange={(k) => setV({ ...v, modality: k })} />
      </fieldset>
      <div className="space-y-1.5 sm:col-span-3">
        <Label htmlFor="ac-desc">Description</Label>
        <textarea id="ac-desc" className={area} {...bind('description')} />
      </div>
      <div className="space-y-1.5 sm:col-span-3">
        <Label htmlFor="ac-skills">Skills (comma-separated, matched to alumni gaps)</Label>
        <Input id="ac-skills" {...bind('skills')} />
      </div>
      <div className="flex items-center gap-3 sm:col-span-3">
        <SubmitButton pendingLabel="Opening…">Open to alumni auditors</SubmitButton>
        <Msg r={state} />
      </div>
    </form>
  )
}

// ── Giving time and news ────────────────────────────────────────────────────

const VKINDS = [
  { key: 'admissions_interview', label: 'Admissions interviews' },
  { key: 'guest_lecture', label: 'Guest lecture' },
  { key: 'class_agent', label: 'Class agent' },
  { key: 'mentor_students', label: 'Mentor students' },
  { key: 'event_host', label: 'Host an event' },
  { key: 'other', label: 'Other' },
] as const

export function VolunteerRoleForm({ slug }: { slug: string }) {
  const [state, action] = useActionState<A.FormResult, FormData>(A.volunteerRoleForm.bind(null, slug) as FormAction, undefined)
  const { v, setV, bind } = useFields({ kind: 'admissions_interview', title: '', description: '', timeCommitment: '', office: 'Admissions', slots: '' })
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor="vr-kind">Kind</Label>
        <Choice name="kind" value={v.kind} options={VKINDS} onChange={(k) => setV({ ...v, kind: k })} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="vr-title">Title</Label>
        <Input id="vr-title" {...bind('title')} placeholder="Interview applicants in your city" />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="vr-desc">What it involves</Label>
        <textarea id="vr-desc" className={area} {...bind('description')} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="vr-time">Time it takes</Label>
        <Input id="vr-time" {...bind('timeCommitment')} placeholder="Two hours a month, Nov–Feb" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="vr-office">Office</Label>
        <Input id="vr-office" {...bind('office')} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="vr-slots">Spots (blank: no limit)</Label>
        <Input id="vr-slots" inputMode="numeric" {...bind('slots')} />
      </div>
      <div className="flex items-center gap-3 sm:col-span-2">
        <SubmitButton pendingLabel="Adding…">Add role</SubmitButton>
        <Msg r={state} />
      </div>
    </form>
  )
}

export function NewsForm({ slug }: { slug: string }) {
  const [state, action] = useActionState<A.FormResult, FormData>(A.newsPostForm.bind(null, slug) as FormAction, undefined)
  const { bind } = useFields({ title: '', body: '', url: '' })
  return (
    <form action={action} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="nw-title">Headline</Label>
        <Input id="nw-title" {...bind('title')} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="nw-body">A sentence or two</Label>
        <textarea id="nw-body" className={area} {...bind('body')} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="nw-url">Link (optional)</Label>
        <Input id="nw-url" type="url" {...bind('url')} placeholder="https://" />
      </div>
      <div className="flex items-center gap-3">
        <SubmitButton pendingLabel="Posting…">Post news</SubmitButton>
        <Msg r={state} />
      </div>
    </form>
  )
}

// ── Portal features ─────────────────────────────────────────────────────────

export function ModuleToggle({ slug, moduleKey, on: initial, label, disabled }: { slug: string; moduleKey: string; on: boolean; label: string; disabled: boolean }) {
  const [on, setOn] = useState(initial)
  const [pending, start] = useTransition()
  const [r, setR] = useState<R>(null)
  return (
    <span className={cn('flex items-center gap-2', pending && 'cursor-wait')}>
      <Button
        size="sm"
        variant={on ? 'default' : 'outline'}
        aria-pressed={on}
        aria-label={`${label}: ${on ? 'on' : 'off'}`}
        disabled={disabled || pending}
        onClick={() =>
          start(async () => {
            const out = await A.setModule(slug, moduleKey as never, !on)
            setR(out)
            if (!out.error) setOn(!on)
          })
        }
      >
        {on ? 'On' : 'Off'}
      </Button>
      <Msg r={r?.error ? r : null} />
    </span>
  )
}
