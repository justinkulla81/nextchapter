'use client'

import { useActionState } from 'react'
import { updateKnownFor } from '@/app/dashboard/references/actions'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

export function KnownForGateForm() {
  const [state, formAction, pending] = useActionState(updateKnownFor, undefined)

  return (
    <form action={formAction} className="space-y-4 rounded-lg border border-border p-4">
      <div className="space-y-2">
        <Label htmlFor="knownFor">How would former colleagues describe you?</Label>
        <p className="text-sm text-muted-foreground">
          Before you request a reference, tell us how you think you come across at work. We&apos;ll
          compare this to what your references actually say — that comparison is itself part of
          your Hireability Score.
        </p>
        <Textarea id="knownFor" name="knownFor" required rows={4} />
      </div>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? 'Saving…' : 'Continue to reference requests'}
      </Button>
    </form>
  )
}
