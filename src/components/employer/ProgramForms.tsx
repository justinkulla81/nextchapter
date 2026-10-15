'use client'

import { useActionState, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SubmitButton } from '@/components/ui/submit-button'
import { cn } from '@/lib/utils'
import { saveProgramDetails, savePackages, saveProgramService, setSeatPackage } from '@/app/employer/(app)/program/actions'
import type { ProgramFeatureKey, ProgramPackage, Provider, ServiceChoice } from '@/lib/employer/program-settings'

type R = { error?: string; ok?: boolean; message?: string } | null
const pill = (on: boolean) => cn('rounded-md border px-3 py-1.5 text-sm', on ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-muted')

function Msg({ r }: { r: R }) {
  if (!r?.error && !r?.message) return null
  return (
    <p role={r.error ? 'alert' : 'status'} className={cn('text-sm', r.error ? 'text-destructive' : 'text-muted-foreground')}>
      {r.error ?? r.message}
    </p>
  )
}

export function ProgramDetailsForm({ programBrandName, welcome }: { programBrandName: string | null; welcome: string | null }) {
  const [state, action] = useActionState(saveProgramDetails, undefined)
  const [v, setV] = useState({ programBrandName: programBrandName ?? '', welcome: welcome ?? '' })
  return (
    <form action={action} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="pg-name">Program name (optional)</Label>
        <Input id="pg-name" name="programBrandName" value={v.programBrandName} maxLength={80} onChange={(e) => setV({ ...v, programBrandName: e.target.value })} placeholder="Acme Career Transition Program" className="max-w-md" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="pg-welcome">Welcome message</Label>
        <textarea id="pg-welcome" name="welcome" value={v.welcome} maxLength={1000} onChange={(e) => setV({ ...v, welcome: e.target.value })} className="min-h-24 w-full max-w-2xl rounded-md border border-input bg-background p-2 text-sm" placeholder="A few lines from leadership: thanks, what the program covers, who to call with questions." />
      </div>
      <div className="flex items-center gap-3">
        <SubmitButton pendingLabel="Saving…">Save program details</SubmitButton>
        {(state?.ok || state?.error) && (
          <p role={state.error ? 'alert' : 'status'} className={cn('text-sm', state.error ? 'text-destructive' : 'text-muted-foreground')}>
            {state.error ?? state.ok}
          </p>
        )}
      </div>
    </form>
  )
}

// One service in the menu: offered or not, and who provides it.
export function ServiceMenuRow(props: {
  featureKey: ProgramFeatureKey
  label: string
  what: string
  choice: ServiceChoice
  // Null = NextChapter doesn't offer it; else whether this contract includes it.
  nextchapter: { included: boolean; tierNeeded: string } | null
  ownAllowed: boolean
}) {
  const [c, setC] = useState(props.choice)
  const [open, setOpen] = useState(false)
  const [pending, start] = useTransition()
  const [r, setR] = useState<R>(null)
  const save = (next: ServiceChoice) =>
    start(async () => {
      const out = await saveProgramService(props.featureKey, next)
      setR(out)
      if (!out.error) setC(next)
    })
  const ncOk = !!props.nextchapter?.included
  const status = !c.on
    ? 'Not offered'
    : c.provider === 'own'
      ? c.url || c.note
        ? 'Offered: your own'
        : 'Your own: add a link or note'
      : ncOk
        ? 'Offered: NextChapter'
        : `Needs the ${props.nextchapter?.tierNeeded} contract`
  return (
    <li className={cn('space-y-3 p-4', pending && 'cursor-wait')}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <span>
          <span className="text-sm font-medium">{props.label}</span>
          <span className="block text-xs text-muted-foreground">{props.what}</span>
          <span className="mt-1 block text-xs font-medium">{status}</span>
        </span>
        <span className="flex items-center gap-2">
          {c.on && (
            <Button size="sm" variant="ghost" aria-expanded={open} onClick={() => setOpen(!open)}>
              {open ? 'Close' : 'Settings'}
            </Button>
          )}
          <Button size="sm" variant={c.on ? 'default' : 'outline'} aria-pressed={c.on} aria-label={`${props.label}: ${c.on ? 'offered' : 'not offered'}`} disabled={pending} onClick={() => (!c.on && c.provider === 'own' && !c.url && !c.note ? (setC({ ...c, on: true }), setOpen(true)) : save({ ...c, on: !c.on }))}>
            {c.on ? 'Offered' : 'Off'}
          </Button>
        </span>
      </div>
      {c.on && open && (
        <div className="space-y-3 rounded-md border border-border bg-background p-3">
          {props.nextchapter && props.ownAllowed && (
            <fieldset className="space-y-1.5">
              <legend className="text-sm font-medium">Who provides it</legend>
              <div className="flex flex-wrap gap-2">
                {(['nextchapter', 'own'] as Provider[]).map((p) => (
                  <button key={p} type="button" aria-pressed={c.provider === p} className={pill(c.provider === p)} onClick={() => setC({ ...c, provider: p })}>
                    {p === 'nextchapter' ? 'NextChapter' : 'Your own'}
                  </button>
                ))}
              </div>
              {c.provider === 'nextchapter' && !ncOk && <p className="text-xs text-amber-700 dark:text-amber-400">Your contract doesn’t include NextChapter’s {props.label.toLowerCase()} ({props.nextchapter.tierNeeded} and up). Use your own, or ask your NextChapter contact.</p>}
            </fieldset>
          )}
          {c.provider === 'own' && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor={`${props.featureKey}-url`}>Link (optional)</Label>
                <Input id={`${props.featureKey}-url`} type="url" value={c.url ?? ''} placeholder="https://" onChange={(e) => setC({ ...c, url: e.target.value || null })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`${props.featureKey}-note`}>How to use it</Label>
                <Input id={`${props.featureKey}-note`} value={c.note ?? ''} maxLength={300} placeholder="Call benefits at 555-0100, Mon–Fri" onChange={(e) => setC({ ...c, note: e.target.value || null })} />
              </div>
            </div>
          )}
          <Button size="sm" disabled={pending} onClick={() => save(c)}>
            {pending ? 'Saving…' : 'Save'}
          </Button>
        </div>
      )}
      <Msg r={r} />
    </li>
  )
}

// Packages: named groups of services ("Executives", "Hourly staff").
// Everyone not on a package gets every offered service.
export function PackagesEditor({ packages: initial, services }: { packages: ProgramPackage[]; services: { key: ProgramFeatureKey; label: string }[] }) {
  const [list, setList] = useState(initial)
  const [pending, start] = useTransition()
  const [r, setR] = useState<R>(null)
  const [confirmDrop, setConfirmDrop] = useState<number | null>(null)
  const update = (i: number, p: Partial<ProgramPackage>) => setList(list.map((x, j) => (j === i ? { ...x, ...p } : x)))
  return (
    <div className={cn('space-y-3', pending && 'cursor-wait')}>
      {list.length === 0 && <p className="text-sm text-muted-foreground">No packages: everyone you enroll gets every service you offer. Add a package to give a group a different set.</p>}
      {list.map((p, i) => (
        <div key={p.key || i} className="space-y-2 rounded-lg border border-border bg-card p-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label htmlFor={`pkg-${i}`}>Package name</Label>
              <Input id={`pkg-${i}`} value={p.name} maxLength={60} placeholder="Executives" onChange={(e) => update(i, { name: e.target.value })} className="w-56" />
            </div>
            {confirmDrop === i ? (
              <span className="flex items-center gap-2 text-sm">
                Remove {p.name || 'this package'}? People on it get everything offered.
                <Button size="sm" variant="outline" onClick={() => (setList(list.filter((_, j) => j !== i)), setConfirmDrop(null))}>
                  Remove
                </Button>
                <Button size="sm" variant="ghost" autoFocus onClick={() => setConfirmDrop(null)}>
                  Cancel
                </Button>
              </span>
            ) : (
              <Button size="sm" variant="ghost" onClick={() => setConfirmDrop(i)}>
                Remove package
              </Button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {services.map((s) => {
              const on = p.services.includes(s.key)
              return (
                <button key={s.key} type="button" aria-pressed={on} className={pill(on)} onClick={() => update(i, { services: on ? p.services.filter((k) => k !== s.key) : [...p.services, s.key] })}>
                  {s.label}
                </button>
              )
            })}
          </div>
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => setList([...list, { key: '', name: '', services: services.map((s) => s.key) }])}>
          Add a package
        </Button>
        <Button size="sm" disabled={pending} onClick={() => start(async () => setR(await savePackages(list)))}>
          {pending ? 'Saving…' : 'Save packages'}
        </Button>
        <Msg r={r} />
      </div>
    </div>
  )
}

export function SeatPackageSelect({ seatId, value, options }: { seatId: string; value: string; options: { key: string; name: string }[] }) {
  const [v, setV] = useState(value)
  const [pending, start] = useTransition()
  const [err, setErr] = useState<string | null>(null)
  return (
    <span className={cn('inline-flex items-center gap-1', pending && 'cursor-wait')}>
      <select
        aria-label="Package"
        className="h-8 rounded-md border border-input bg-background px-2 text-sm"
        value={v}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value
          start(async () => {
            const r = await setSeatPackage(seatId, next)
            if (r.error) setErr(r.error)
            else {
              setErr(null)
              setV(next)
            }
          })
        }}
      >
        {options.map((o) => (
          <option key={o.key} value={o.key}>
            {o.name}
          </option>
        ))}
      </select>
      {err && <span role="alert" className="text-xs text-destructive">{err}</span>}
    </span>
  )
}
