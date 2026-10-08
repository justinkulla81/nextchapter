'use client'

import { useActionState } from 'react'
import { inviteFirmToRegister } from '@/app/support/admin/(portal)/recruiter-settings/actions'
import { SubmitButton } from '@/components/ui/submit-button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CopyButton } from '@/components/ui/copy-button'

// Admin: make a registration link to send to a firm. Whoever opens it
// builds the firm's page, look and connections themselves.
export function FirmInviteForm() {
  const [state, action, pending] = useActionState(inviteFirmToRegister, undefined)
  return (
    <form action={action} className={pending ? 'space-y-3 cursor-progress' : 'space-y-3'}>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="fi-name">Firm name</Label>
          <Input id="fi-name" name="name" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="fi-site">Website</Label>
          <Input id="fi-site" name="website" placeholder="yourfirm.com" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="fi-mail">Their email (optional)</Label>
          <Input id="fi-mail" name="contactEmail" type="email" />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="verified" /> Go live right away (mark the firm verified)
      </label>
      {state?.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
      {state?.link && (
        <div className="space-y-1 rounded-md border border-border p-3">
          <p className="text-sm font-medium">Registration link for {state.firmName}</p>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded bg-muted px-2 py-1 text-xs">{state.link}</code>
            <CopyButton text={state.link} />
          </div>
          <p className="text-xs text-muted-foreground">Send this to them. It stops working once someone has registered.</p>
        </div>
      )}
      <SubmitButton pendingLabel="Creating…">Create registration link</SubmitButton>
    </form>
  )
}
