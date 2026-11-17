'use client'

import { useActionState } from 'react'
import { SubmitButton } from '@/components/ui/submit-button'
import { cn } from '@/lib/utils'
import { COMMITMENTS } from '@/lib/workforce/ecosystem'
import { updateMyCommitments, type PartnerResult } from '@/app/i/[slug]/(portal)/partner-actions'

// What the partner offers, as checkboxes. Saving replaces the list; nothing else on the page changes.
export function CommitmentsForm({ slug, selected, readOnly }: { slug: string; selected: string[]; readOnly: boolean }) {
  const [state, action] = useActionState<PartnerResult, FormData>(updateMyCommitments.bind(null, slug), undefined)
  return (
    <form action={action} className="space-y-3">
      <fieldset className="space-y-2" disabled={readOnly}>
        <legend className="sr-only">What you offer</legend>
        {COMMITMENTS.map((c) => (
          <label key={c.key} className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="commitments" value={c.key} defaultChecked={selected.includes(c.key)} className="size-4" />
            {c.label}
          </label>
        ))}
      </fieldset>
      {readOnly ? (
        <p className="text-sm text-muted-foreground">Changing this is off in the preview. A person at the partner does it on their own page.</p>
      ) : (
        <div className="flex items-center gap-3">
          <SubmitButton pendingLabel="Saving…">Save what we offer</SubmitButton>
          {state && (
            <p role={state.error ? 'alert' : 'status'} className={cn('text-sm', state.error ? 'text-destructive' : 'text-muted-foreground')}>
              {state.error ?? state.message}
            </p>
          )}
        </div>
      )}
    </form>
  )
}
