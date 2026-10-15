'use client'

import { useActionState, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SubmitButton } from '@/components/ui/submit-button'
import { cn } from '@/lib/utils'
import { addSystemUser, createSystem, setCampusSystem, type SystemFormState } from '@/app/support/admin/(portal)/college-systems/actions'

function Msg({ s }: { s: SystemFormState | { error?: string; message?: string } | null }) {
  const text = s && ('ok' in s && s.ok ? s.ok : s.error ?? ('message' in s ? s.message : undefined))
  if (!text) return null
  return <p role={s?.error ? 'alert' : 'status'} className={cn('text-sm', s?.error ? 'text-destructive' : 'text-muted-foreground')}>{text}</p>
}

export function CreateSystemForm() {
  const [state, action] = useActionState(createSystem, undefined)
  const [v, setV] = useState({ name: '', slug: '' })
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <div className="space-y-1.5">
        <Label htmlFor="sys-name">System name</Label>
        <Input id="sys-name" name="name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} placeholder="Penn State Commonwealth Campuses" className="w-72" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="sys-slug">Short name (in the link)</Label>
        <Input id="sys-slug" name="slug" value={v.slug} onChange={(e) => setV({ ...v, slug: e.target.value })} placeholder="psu-campuses" className="w-48" />
      </div>
      <SubmitButton pendingLabel="Creating…">Create system</SubmitButton>
      <Msg s={state} />
    </form>
  )
}

export function AddSystemUserForm({ systemId }: { systemId: string }) {
  const [state, action] = useActionState(addSystemUser.bind(null, systemId), undefined)
  const [v, setV] = useState({ email: '', fullName: '' })
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <Input aria-label="Email" name="email" type="email" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} placeholder="provost@system.edu" className="h-8 w-56" />
      <Input aria-label="Name" name="fullName" value={v.fullName} onChange={(e) => setV({ ...v, fullName: e.target.value })} placeholder="Name (optional)" className="h-8 w-44" />
      <SubmitButton size="sm" pendingLabel="Adding…">Add person</SubmitButton>
      <Msg s={state} />
    </form>
  )
}

export function CampusPicker({ systemId, options }: { systemId: string; options: { id: string; name: string }[] }) {
  const [id, setId] = useState('')
  const [pending, start] = useTransition()
  const [r, setR] = useState<{ error?: string; message?: string } | null>(null)
  if (!options.length) return <p className="text-xs text-muted-foreground">Every college is already in a system.</p>
  return (
    <span className={cn('flex flex-wrap items-center gap-2', pending && 'cursor-wait')}>
      <select aria-label="College to add" className="h-8 rounded-md border border-input bg-background px-2 text-sm" value={id} onChange={(e) => setId(e.target.value)}>
        <option value="">Pick a college…</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>{o.name}</option>
        ))}
      </select>
      <Button size="sm" variant="outline" disabled={pending || !id} title={!id ? 'Pick a college first' : undefined} onClick={() => start(async () => setR(await setCampusSystem(id, systemId)))}>
        Add campus
      </Button>
      <Msg s={r} />
    </span>
  )
}
