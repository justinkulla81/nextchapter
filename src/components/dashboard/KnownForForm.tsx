'use client'

import { useActionState } from 'react'
import { updateKnownFor } from '@/app/dashboard/references/actions'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

export function KnownForForm({ knownFor }: { knownFor: string | null }) {
  const [state, formAction, pending] = useActionState(updateKnownFor, undefined)

  return (
    <form action={formAction} className="space-y-2">
      <Label htmlFor="knownFor">How would former colleagues describe you?</Label>
      <p className="text-sm text-muted-foreground">
        Feeds your Hireability Score and the scripts/drafts we generate for you elsewhere in the
        app — worth keeping current.
      </p>
      <Textarea id="knownFor" name="knownFor" required rows={4} defaultValue={knownFor ?? ''} />
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? 'Saving…' : 'Save'}
      </Button>
    </form>
  )
}
