'use client'

import { useActionState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SubmitButton } from '@/components/ui/submit-button'
import type { ImportState } from '@/app/i/[slug]/(portal)/staff-actions'

// One CSV upload (roster or gifts) with every bad row listed by number, so
// the college can fix its file and upload again; reruns add nothing twice.
export function CrmUploadForm({
  id,
  title,
  columns,
  action,
}: {
  id: string
  title: string
  columns: string
  action: (prev: ImportState, formData: FormData) => Promise<ImportState>
}) {
  const [state, formAction] = useActionState(action, undefined)
  return (
    <form action={formAction} className="space-y-3 rounded-lg border border-border bg-card p-4">
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs text-muted-foreground">
          Columns: <span className="font-mono">{columns}</span>
        </p>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-file`}>CSV file</Label>
          <Input id={`${id}-file`} name="file" type="file" accept=".csv,text/csv" required />
        </div>
        <SubmitButton pendingLabel="Importing…" savedLabel="Imported">
          Import file
        </SubmitButton>
      </div>
      {state?.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      {state?.ok && (
        <p role="status" className="text-sm">
          {state.summary}
        </p>
      )}
      {state?.errors?.length ? (
        <ul className="max-h-48 space-y-0.5 overflow-auto text-xs text-destructive">
          {state.errors.map((e, i) => (
            <li key={i}>
              Row {e.row}
              {e.column ? ` (${e.column})` : ''}: {e.message}
            </li>
          ))}
        </ul>
      ) : null}
    </form>
  )
}
