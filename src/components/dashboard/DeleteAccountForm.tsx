'use client'

import { useActionState, useState } from 'react'
import { deactivateMyAccount } from '@/app/dashboard/privacy/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

export function DeleteAccountForm() {
  const [expanded, setExpanded] = useState(false)
  const [state, formAction, pending] = useActionState(deactivateMyAccount, undefined)

  if (!expanded) {
    return (
      <Button type="button" variant="destructive" onClick={() => setExpanded(true)}>
        Deactivate my account
      </Button>
    )
  }

  return (
    <form
      action={formAction}
      className={cn(
        'max-w-sm space-y-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4',
        pending && 'cursor-progress [&_*]:cursor-progress'
      )}
    >
      <p className="text-sm text-foreground">
        This signs you out and makes your account unusable — no one, including you, can access it
        until it&apos;s reactivated. Your profile, resume, references, and reports are kept, not
        deleted. Type <strong>DEACTIVATE</strong> to confirm.
      </p>
      <p className="text-sm text-muted-foreground">
        Want your account and data permanently deleted instead? Email{' '}
        <a href="mailto:support@launchyournextchapter.com" className="text-primary underline underline-offset-4">
          support@launchyournextchapter.com
        </a>
        .
      </p>
      <div className="space-y-2">
        <Label htmlFor="confirmation">Confirmation</Label>
        <Input id="confirmation" name="confirmation" placeholder="DEACTIVATE" required autoComplete="off" />
      </div>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      <div className="flex gap-2">
        <Button type="submit" variant="destructive" disabled={pending}>
          {pending ? 'Deactivating…' : 'Deactivate my account'}
        </Button>
        <Button type="button" variant="outline" onClick={() => setExpanded(false)}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
