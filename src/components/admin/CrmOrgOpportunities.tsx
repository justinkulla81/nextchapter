'use client'

import { useState, useTransition } from 'react'
import { addOrgOpportunity } from '@/app/support/admin/(portal)/crm/actions'

export interface PipelineChoice { key: string; label: string }

/** "+ Add" under one kind on an organization's record. Pipeline is chosen when a kind spans several. */
export function CrmAddOrgOpportunity({ orgId, pipelines }: { orgId: string; pipelines: PipelineChoice[] }) {
  const [open, setOpen] = useState(false)
  const [pending, start] = useTransition()
  const [message, setMessage] = useState<string | null>(null)

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-xs text-muted-foreground underline hover:text-foreground">
        + Add
      </button>
    )
  }
  return (
    <form
      className="mt-2 grid gap-2 rounded-lg border border-border p-3 text-sm sm:grid-cols-2"
      action={(fd) => start(async () => {
        const res = await addOrgOpportunity(orgId, String(fd.get('pipelineKey') ?? pipelines[0].key), fd)
        setMessage(res.message)
        if (res.ok) setOpen(false)
      })}
    >
      <input name="title" required placeholder="Title (e.g. Innovation Fund 2026)" className="h-8 rounded border border-input bg-transparent px-2 sm:col-span-2" />
      {pipelines.length > 1 ? (
        <select name="pipelineKey" className="h-8 rounded border border-input bg-transparent px-1.5">
          {pipelines.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
        </select>
      ) : <input type="hidden" name="pipelineKey" value={pipelines[0].key} />}
      <select name="leadQuality" defaultValue="" className="h-8 rounded border border-input bg-transparent px-1.5">
        <option value="">Ungraded</option>
        {['A', 'B', 'C', 'D'].map((q) => <option key={q} value={q}>{q}</option>)}
      </select>
      <input name="amountUsdMin" inputMode="numeric" placeholder="Min $" className="h-8 rounded border border-input bg-transparent px-2" />
      <input name="amountUsdMax" inputMode="numeric" placeholder="Max $" className="h-8 rounded border border-input bg-transparent px-2" />
      <input name="nextStep" placeholder="Next step / notes" className="h-8 rounded border border-input bg-transparent px-2 sm:col-span-2" />
      <div className="flex items-center gap-3 sm:col-span-2">
        <button type="submit" disabled={pending} className="rounded bg-foreground px-3 py-1 text-xs text-background disabled:opacity-60">
          {pending ? 'Adding…' : 'Add opportunity'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-muted-foreground underline">Cancel</button>
        {message && <span className="text-xs text-muted-foreground">{message}</span>}
      </div>
    </form>
  )
}
