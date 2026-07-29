'use client'

import { useActionState } from 'react'
import { submitInterimOfferDefinition } from '@/app/dashboard/interim-work/actions'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { SubmitButton } from '@/components/ui/submit-button'
import { cn } from '@/lib/utils'

export function InterimOfferDefinitionForm() {
  const [state, formAction, pending] = useActionState(submitInterimOfferDefinition, undefined)

  return (
    <form
      action={formAction}
      className={cn('space-y-3', pending && 'cursor-progress [&_*]:cursor-progress')}
    >
      <div className="space-y-2">
        <Label htmlFor="offer">
          In one or two sentences: what specific expertise are you offering, and at what level?
        </Label>
        <Textarea
          id="offer"
          name="offer"
          required
          rows={2}
          placeholder="e.g. Interim VP of Marketing for Series B/C SaaS companies launching a new product line."
        />
      </div>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      <SubmitButton pendingLabel="Saving…">Save your offer</SubmitButton>
    </form>
  )
}
