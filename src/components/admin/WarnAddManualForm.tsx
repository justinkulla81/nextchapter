'use client'

import { useState } from 'react'
import { SubmitButton } from '@/components/ui/submit-button'
import { addManualLayoffNotice } from '@/app/support/admin/(portal)/crm/warn/actions'

export function WarnAddManualForm({ companyNames }: { companyNames: string[] }) {
  const [open, setOpen] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="h-9 rounded-md border border-border px-3 text-sm hover:bg-muted"
      >
        + Add from an article
      </button>
    )
  }

  return (
    <form
      action={async (fd) => {
        const r = await addManualLayoffNotice(fd)
        setResult(r.error ?? r.message ?? null)
        if (!r.error) (document.getElementById('warn-manual-add-form') as HTMLFormElement | null)?.reset()
      }}
      id="warn-manual-add-form"
      className="w-full space-y-2 rounded-lg border border-border p-3"
    >
      <p className="text-sm font-medium">Add a layoff you heard about (no WARN filing yet)</p>
      <div className="flex flex-wrap gap-2">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Company
          <input
            name="companyName"
            list="warn-company-names"
            required
            placeholder="Company name"
            className="h-9 w-56 rounded-md border border-input bg-transparent px-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-brand"
          />
        </label>
        <datalist id="warn-company-names">
          {companyNames.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Speculated jobs affected
          <input
            name="employees"
            type="number"
            min={0}
            placeholder="e.g. 3300"
            className="h-9 w-40 rounded-md border border-input bg-transparent px-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-brand"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Announced on
          <input
            name="noticeDate"
            type="date"
            className="h-9 rounded-md border border-input bg-transparent px-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-brand"
          />
        </label>
        <label className="flex min-w-64 flex-1 flex-col gap-1 text-xs text-muted-foreground">
          Article link
          <input
            name="articleUrl"
            type="url"
            required
            placeholder="https://…"
            className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-brand"
          />
        </label>
      </div>
      <div className="flex items-center gap-2">
        <SubmitButton size="sm" pendingLabel="Adding…">Add</SubmitButton>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-muted-foreground hover:underline">
          Cancel
        </button>
        {result && <p role="status" className="text-xs text-muted-foreground">{result}</p>}
      </div>
    </form>
  )
}
