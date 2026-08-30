'use client'

import { useActionState } from 'react'
import { SubmitButton } from '@/components/ui/submit-button'
import { addResearchItem } from '@/app/support/admin/(portal)/digest/actions'

export function AddResearchItemForm() {
  const [state, formAction] = useActionState(addResearchItem, undefined)

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3 rounded-lg border border-border p-3">
      <div className="min-w-64 flex-1">
        <label htmlFor="url" className="text-sm text-muted-foreground">
          Add article URL
        </label>
        <input
          id="url"
          name="url"
          type="url"
          required
          placeholder="https://…"
          className="mt-1 h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-brand"
        />
      </div>
      <SubmitButton pendingLabel="Fetching & classifying…">Add article</SubmitButton>
      {state?.error && <p className="w-full text-sm text-destructive">{state.error}</p>}
      {state?.success && <p className="w-full text-sm text-primary">Added — fetched, summarized, and classified.</p>}
    </form>
  )
}
