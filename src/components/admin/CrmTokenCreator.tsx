'use client'

import { useActionState } from 'react'
import { SubmitButton } from '@/components/ui/submit-button'
import { createCaptureToken } from '@/app/support/admin/(portal)/crm/capture-tokens/actions'

export function CrmTokenCreator() {
  const [result, action] = useActionState(createCaptureToken, { message: '' })

  return (
    <form action={action} className="rounded-lg border border-border p-4">
      <label htmlFor="label" className="mb-1 block text-sm font-medium">
        What is this token for
      </label>
      <input
        id="label" name="label" required placeholder="Chrome on my laptop"
        className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-brand"
      />
      <p className="mt-1 text-xs text-muted-foreground">
        One per browser, so losing a laptop means revoking one token rather than all of them.
      </p>
      <div className="mt-3"><SubmitButton pendingLabel="Creating…">Create token</SubmitButton></div>

      {result.token && (
        <div className="mt-3 rounded-md border border-brand/50 bg-brand/5 p-3">
          <p className="text-sm font-medium">{result.message}</p>
          <code className="mt-2 block break-all rounded bg-background p-2 font-mono text-xs">{result.token}</code>
        </div>
      )}
      {!result.token && result.message && (
        <p role="status" className="mt-2 text-sm text-destructive">{result.message}</p>
      )}
    </form>
  )
}
