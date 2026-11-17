'use client'

import { useActionState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SubmitButton } from '@/components/ui/submit-button'
import { submitPartnerClaim } from '@/app/i/[slug]/partner/[token]/actions'
import { COMMITMENTS } from '@/lib/workforce/ecosystem'

export function PartnerClaimForm({ slug, token, defaultNote }: { slug: string; token: string; defaultNote?: string }) {
  const [state, action] = useActionState(submitPartnerClaim.bind(null, slug, token), undefined)
  if (state?.ok) {
    return (
      <div role="status" className="space-y-2 rounded-lg border border-border bg-card p-5">
        <p className="font-semibold">Thank you. Your request is in.</p>
        <p className="text-sm text-muted-foreground">The organization that invited you reviews it and will be in touch. Nothing is public and no one has access to your systems.</p>
      </div>
    )
  }
  return (
    <form action={action} className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="pc-name">Your name</Label>
          <Input id="pc-name" name="name" required maxLength={120} autoComplete="name" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pc-title">Your title</Label>
          <Input id="pc-title" name="title" maxLength={120} autoComplete="organization-title" />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="pc-email">Work email</Label>
          <Input id="pc-email" name="email" type="email" required maxLength={200} autoComplete="email" />
          <p className="text-xs text-muted-foreground">Use an address at your organization, so they can see it is you.</p>
        </div>
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">How would you like to take part? (pick any)</legend>
        {COMMITMENTS.map((c) => (
          <label key={c.key} className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="commitments" value={c.key} className="mt-0.5" />
            <span>{c.label}</span>
          </label>
        ))}
      </fieldset>
      <div className="space-y-1.5">
        <Label htmlFor="pc-note">Anything to add (optional)</Label>
        <Input id="pc-note" name="note" maxLength={1000} defaultValue={defaultNote ?? ''} />
      </div>
      <div className="hidden" aria-hidden="true">
        <label>
          Leave this empty
          <input name="website2" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      {state?.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      <SubmitButton size="lg" pendingLabel="Sending…">
        Ask to join
      </SubmitButton>
    </form>
  )
}
