'use client'

import { useActionState, useState } from 'react'
import { deleteMyAccount } from '@/app/dashboard/privacy/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function DeleteAccountForm() {
  const [expanded, setExpanded] = useState(false)
  const [state, formAction, pending] = useActionState(deleteMyAccount, undefined)

  if (!expanded) {
    return (
      <Button type="button" variant="destructive" onClick={() => setExpanded(true)}>
        Delete my account
      </Button>
    )
  }

  return (
    <form action={formAction} className="max-w-sm space-y-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
      <p className="text-sm text-foreground">
        This permanently deletes your profile, resume, references, work samples, and every report
        — immediately, with no way to undo it. Type <strong>DELETE</strong> to confirm.
      </p>
      <div className="space-y-2">
        <Label htmlFor="confirmation">Confirmation</Label>
        <Input id="confirmation" name="confirmation" placeholder="DELETE" required autoComplete="off" />
      </div>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      <div className="flex gap-2">
        <Button type="submit" variant="destructive" disabled={pending}>
          {pending ? 'Deleting…' : 'Permanently delete my account'}
        </Button>
        <Button type="button" variant="outline" onClick={() => setExpanded(false)}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
