'use client'

// V2 programs: forms and row controls for Exec Ed, Teaching, Employer and
// the alum's Programs tab. Busy cursor while anything runs; failed forms
// keep what was typed (controlled inputs).

import { useActionState, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SubmitButton } from '@/components/ui/submit-button'
import { cn } from '@/lib/utils'
import {
  addCohortForm,
  applyToProgram,
  proposeCapstoneForm,
  saveClientForm,
  saveProgramForm,
  setCapstone,
  setEnrollment,
  type FormResult,
} from '@/app/i/[slug]/(portal)/program-actions'

function Msg({ r }: { r: { error?: string; message?: string } | null | undefined }) {
  if (!r?.error && !r?.message) return null
  return (
    <p role={r.error ? 'alert' : 'status'} className={cn('text-sm', r.error ? 'text-destructive' : 'text-muted-foreground')}>
      {r.error ?? r.message}
    </p>
  )
}

function useFields<T extends Record<string, string>>(init: T) {
  const [v, setV] = useState(init)
  const bind = (k: keyof T) => ({ name: k as string, value: v[k], onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setV({ ...v, [k]: e.target.value }) })
  return bind
}

const textarea = 'min-h-20 w-full rounded-md border border-input bg-background p-2 text-sm'
const select = 'h-9 w-full rounded-md border border-input bg-background px-2 text-sm'

export function ProgramForm(props: {
  slug: string
  program?: { id: string; name: string; summary: string | null; audience: string | null; credential: string | null; priceCents: number; wioaEligible: boolean; isActive: boolean }
  showWioa: boolean
}) {
  const p = props.program
  const [state, action] = useActionState<FormResult, FormData>(saveProgramForm.bind(null, props.slug, p?.id ?? null), undefined)
  const bind = useFields({ name: p?.name ?? '', summary: p?.summary ?? '', audience: p?.audience ?? '', credential: p?.credential ?? '', price: p ? String(p.priceCents / 100) : '' })
  const [wioa, setWioa] = useState(p?.wioaEligible ?? false)
  const [active, setActive] = useState(p?.isActive ?? true)
  const id = p?.id ?? 'new'
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor={`pn-${id}`}>Program name</Label>
        <Input id={`pn-${id}`} {...bind('name')} placeholder="AI-Ready Professional Certificate" />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor={`ps-${id}`}>What it covers</Label>
        <textarea id={`ps-${id}`} className={textarea} {...bind('summary')} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`pa-${id}`}>Who it’s for</Label>
        <Input id={`pa-${id}`} {...bind('audience')} placeholder="Mid-career alumni" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`pc-${id}`}>Completers earn</Label>
        <Input id={`pc-${id}`} {...bind('credential')} placeholder="A certificate or badge name" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`pp-${id}`}>Price ($, 0 for free)</Label>
        <Input id={`pp-${id}`} inputMode="decimal" {...bind('price')} />
      </div>
      <div className="flex flex-col justify-end gap-2 text-sm">
        {props.showWioa && (
          <label className="flex items-center gap-2">
            <input type="checkbox" name="wioaEligible" checked={wioa} onChange={(e) => setWioa(e.target.checked)} />
            On the state’s WIOA eligible training provider list
          </label>
        )}
        {p && (
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
            Open for new cohorts
            <input type="hidden" name="isActive" value={active ? 'on' : 'off'} />
          </label>
        )}
      </div>
      <div className="flex items-center gap-3 sm:col-span-2">
        <SubmitButton pendingLabel="Saving…">{p ? 'Save program' : 'Add program'}</SubmitButton>
        <Msg r={state} />
      </div>
    </form>
  )
}

export function CohortForm(props: { slug: string; programId: string; faculty: { id: string; name: string }[] }) {
  const [state, action] = useActionState<FormResult, FormData>(addCohortForm.bind(null, props.slug, props.programId), undefined)
  const bind = useFields({ name: '', startsAt: '', endsAt: '', seats: '', modality: 'online', facultyUserId: '' })
  const id = props.programId
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-3">
      <div className="space-y-1.5 sm:col-span-3">
        <Label htmlFor={`cn-${id}`}>Cohort name</Label>
        <Input id={`cn-${id}`} {...bind('name')} placeholder="Spring 2027, online" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`cs-${id}`}>Starts</Label>
        <Input id={`cs-${id}`} type="date" {...bind('startsAt')} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`ce-${id}`}>Ends (optional)</Label>
        <Input id={`ce-${id}`} type="date" {...bind('endsAt')} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`cseat-${id}`}>Seats (blank: no limit)</Label>
        <Input id={`cseat-${id}`} inputMode="numeric" {...bind('seats')} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`cm-${id}`}>Format</Label>
        <select id={`cm-${id}`} className={select} {...bind('modality')}>
          <option value="online">Online</option>
          <option value="in_person">In person</option>
          <option value="hybrid">Hybrid</option>
        </select>
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor={`cf-${id}`}>Taught by</Label>
        <select id={`cf-${id}`} className={select} {...bind('facultyUserId')}>
          <option value="">Not set yet</option>
          {props.faculty.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-3 sm:col-span-3">
        <SubmitButton variant="outline" pendingLabel="Adding…">
          Add cohort
        </SubmitButton>
        <Msg r={state} />
      </div>
    </form>
  )
}

const PAYER_OPTIONS = [
  ['SELF_PAY', 'Self-pay'],
  ['EMPLOYER', 'Employer'],
  ['RESILIENCE_FUND', 'Resilience Fund'],
  ['WIOA_VOUCHER', 'WIOA voucher'],
  ['BOARD_CONTRACT', 'Workforce board contract'],
  ['PELL', 'Pell grant'],
] as const

// The next steps for one enrollment, and who pays.
export function EnrollmentControls(props: { slug: string; id: string; status: string; payer: string; clientId: string | null; clients: { id: string; name: string }[] }) {
  const [pending, start] = useTransition()
  const [status, setStatus] = useState(props.status)
  const [payer, setPayer] = useState(props.payer)
  const [clientId, setClientId] = useState(props.clientId ?? '')
  const [error, setError] = useState<string | null>(null)
  const run = (change: { status?: string; payer?: string; corporateClientId?: string | null }, after: () => void) =>
    start(async () => {
      setError(null)
      const r = await setEnrollment(props.slug, props.id, change)
      if (r.error) setError(r.error)
      else after()
    })
  const next: [string, string][] =
    status === 'APPLIED' ? [['ENROLLED', 'Enroll'], ['WITHDREW', 'Decline']] : status === 'ENROLLED' ? [['COMPLETED', 'Mark completed'], ['WITHDREW', 'Withdrew']] : []
  return (
    <div className={cn('flex flex-wrap items-center gap-2', pending && 'cursor-wait')}>
      {next.map(([s, label]) => (
        <Button key={s} size="sm" variant={s === 'WITHDREW' ? 'ghost' : 'outline'} disabled={pending} onClick={() => run({ status: s }, () => setStatus(s))}>
          {label}
        </Button>
      ))}
      <label className="sr-only" htmlFor={`payer-${props.id}`}>
        Who pays
      </label>
      <select
        id={`payer-${props.id}`}
        value={payer}
        disabled={pending}
        onChange={(e) => {
          const v = e.target.value
          run({ payer: v, corporateClientId: v === 'EMPLOYER' ? clientId || null : null }, () => setPayer(v))
        }}
        className="h-8 rounded-md border border-input bg-background px-2 text-sm"
      >
        {PAYER_OPTIONS.map(([k, l]) => (
          <option key={k} value={k}>
            {l}
          </option>
        ))}
      </select>
      {payer === 'EMPLOYER' && props.clients.length > 0 && (
        <select
          aria-label="Corporate client paying"
          value={clientId}
          disabled={pending}
          onChange={(e) => {
            const v = e.target.value
            run({ payer: 'EMPLOYER', corporateClientId: v || null }, () => setClientId(v))
          }}
          className="h-8 rounded-md border border-input bg-background px-2 text-sm"
        >
          <option value="">Which client?</option>
          {props.clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      )}
      {error && (
        <span role="alert" className="text-xs text-destructive">
          {error}
        </span>
      )}
    </div>
  )
}

export function ClientForm(props: { slug: string; client?: { id: string; name: string; contactName: string | null; contactEmail: string | null; seatsPurchased: number; notes: string | null } }) {
  const c = props.client
  const [state, action] = useActionState<FormResult, FormData>(saveClientForm.bind(null, props.slug, c?.id ?? null), undefined)
  const bind = useFields({ name: c?.name ?? '', contactName: c?.contactName ?? '', contactEmail: c?.contactEmail ?? '', seatsPurchased: String(c?.seatsPurchased ?? ''), notes: c?.notes ?? '' })
  const id = c?.id ?? 'new'
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor={`kn-${id}`}>Company</Label>
        <Input id={`kn-${id}`} {...bind('name')} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`ks-${id}`}>Seats purchased</Label>
        <Input id={`ks-${id}`} inputMode="numeric" {...bind('seatsPurchased')} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`kc-${id}`}>Contact</Label>
        <Input id={`kc-${id}`} {...bind('contactName')} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`ke-${id}`}>Contact email</Label>
        <Input id={`ke-${id}`} type="email" {...bind('contactEmail')} />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor={`kno-${id}`}>Notes (which programs, renewal date)</Label>
        <Input id={`kno-${id}`} {...bind('notes')} />
      </div>
      <div className="flex items-center gap-3 sm:col-span-2">
        <SubmitButton variant={c ? 'outline' : 'default'} pendingLabel="Saving…">
          {c ? 'Save client' : 'Add client'}
        </SubmitButton>
        <Msg r={state} />
      </div>
    </form>
  )
}

export function CapstoneControls(props: { slug: string; id: string; status: string }) {
  const [pending, start] = useTransition()
  const [status, setStatus] = useState(props.status)
  const [error, setError] = useState<string | null>(null)
  const next: [string, string][] =
    status === 'PROPOSED'
      ? [['APPROVED', 'Approve'], ['DECLINED', 'Decline']]
      : status === 'APPROVED'
        ? [['IN_PROGRESS', 'Start']]
        : status === 'IN_PROGRESS'
          ? [['COMPLETED', 'Mark completed']]
          : []
  if (!next.length) return null
  return (
    <div className={cn('flex flex-wrap items-center gap-2', pending && 'cursor-wait')}>
      {next.map(([s, label]) => (
        <Button
          key={s}
          size="sm"
          variant={s === 'DECLINED' ? 'ghost' : 'outline'}
          disabled={pending}
          onClick={() =>
            start(async () => {
              setError(null)
              const r = await setCapstone(props.slug, props.id, s)
              if (r.error) setError(r.error)
              else setStatus(s)
            })
          }
        >
          {label}
        </Button>
      ))}
      {error && (
        <span role="alert" className="text-xs text-destructive">
          {error}
        </span>
      )}
    </div>
  )
}

export function CapstoneForm(props: { slug: string; from: 'employer' | 'teaching' }) {
  const [state, action] = useActionState<FormResult, FormData>(proposeCapstoneForm.bind(null, props.slug, props.from), undefined)
  const bind = useFields({ employerName: '', title: '', brief: '', term: '', interviewCommitments: '0' })
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      {props.from === 'teaching' && (
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="cap-emp">Sponsoring employer</Label>
          <Input id="cap-emp" {...bind('employerName')} />
        </div>
      )}
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="cap-title">Project</Label>
        <Input id="cap-title" {...bind('title')} placeholder="Forecast demand for our three Pittsburgh clinics" />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="cap-brief">The problem, the data, what you’d like delivered</Label>
        <textarea id="cap-brief" className={textarea} {...bind('brief')} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="cap-term">Term</Label>
        <Input id="cap-term" {...bind('term')} placeholder="Spring 2027" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="cap-int">Interviews you’ll commit to</Label>
        <Input id="cap-int" inputMode="numeric" {...bind('interviewCommitments')} />
      </div>
      <div className="flex items-center gap-3 sm:col-span-2">
        <SubmitButton pendingLabel="Sending…">{props.from === 'employer' ? 'Propose a capstone' : 'Add capstone'}</SubmitButton>
        <Msg r={state} />
      </div>
    </form>
  )
}

const APPLY = [
  ['SELF_PAY', 'I’ll pay'],
  ['EMPLOYER', 'My employer will pay'],
  ['HELP', 'I need help paying'],
] as const

// Apply to one cohort: who pays (three buttons) and a short note.
export function ApplyToCohort({ slug, cohortId, free }: { slug: string; cohortId: string; free: boolean }) {
  const [open, setOpen] = useState(false)
  const [payer, setPayer] = useState<string>('SELF_PAY')
  const [note, setNote] = useState('')
  const [pending, start] = useTransition()
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (done) return <p role="status" className="text-sm text-muted-foreground">Applied. The program team will be in touch.</p>
  if (!open)
    return (
      <Button size="sm" onClick={() => setOpen(true)}>
        Apply
      </Button>
    )
  return (
    <div className={cn('space-y-2', pending && 'cursor-wait')}>
      {!free && (
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Who pays">
          {APPLY.map(([k, l]) => (
            <Button key={k} type="button" size="sm" role="radio" aria-checked={payer === k} variant={payer === k ? 'default' : 'outline'} onClick={() => setPayer(k)}>
              {l}
            </Button>
          ))}
        </div>
      )}
      {payer === 'HELP' && <p className="text-xs text-muted-foreground">The program team will look at the Resilience Fund, WIOA and other help with you.</p>}
      <textarea aria-label="Anything the program team should know" className={textarea} placeholder="Anything the program team should know (optional)" value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} />
      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setError(null)
              const r = await applyToProgram(slug, cohortId, free ? 'SELF_PAY' : payer, note)
              if (r.error) setError(r.error)
              else setDone(true)
            })
          }
        >
          {pending ? 'Sending…' : 'Send application'}
        </Button>
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
