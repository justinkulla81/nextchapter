'use client'

import { useActionState } from 'react'
import { quickClaimAction, type QuickClaimState } from '@/app/prepared/[slug]/org-actions'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SubmitButton } from '@/components/ui/submit-button'

/**
 * Claim a public organization page with an email and nothing else (owner, 2026-11-18). The claim goes to NextChapter's queue and a
 * person checks it; approval opens the free workspace and emails the claimant a sign-in link.
 */
export function QuickClaimForm({ slug, orgName }: { slug: string; orgName: string }) {
  const [state, action] = useActionState<QuickClaimState, FormData>(quickClaimAction.bind(null, slug), undefined)
  if (state?.sent) {
    return (
      <div role="status" className="rounded-xl border border-border bg-white p-4">
        <p className="font-semibold text-navy">Thanks. We will check that you run {orgName}.</p>
        <p className="mt-1 text-sm text-muted-foreground">When it is confirmed, we email {state.sent.email} a link to your free workspace.</p>
      </div>
    )
  }
  return (
    <form action={action} className="flex max-w-xl flex-col gap-3">
      <div className="space-y-1.5">
        <Label htmlFor="quick-claim-email">Your work email</Label>
        <Input id="quick-claim-email" name="email" type="email" autoComplete="email" defaultValue={state?.email} placeholder="name@organization.org" required />
      </div>
      <input name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      {state?.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
      <SubmitButton pendingLabel="Sending">Claim this page</SubmitButton>
    </form>
  )
}
