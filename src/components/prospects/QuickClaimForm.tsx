'use client'

import { useActionState } from 'react'
import { quickClaimAction, type QuickClaimState } from '@/app/prepared/[slug]/org-actions'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SubmitButton } from '@/components/ui/submit-button'

/**
 * Claim a public organization page with an email and nothing else (owner, 2026-11-18). The claim goes to NextChapter's queue and a
 * person checks it; approval opens the free workspace and emails the claimant a sign-in link. One field and one button, in a row
 * on a wide screen.
 */
export function QuickClaimForm({ slug, orgName }: { slug: string; orgName: string }) {
  const [state, action] = useActionState<QuickClaimState, FormData>(quickClaimAction.bind(null, slug), undefined)
  if (state?.sent) {
    return (
      <div role="status" className="rounded-2xl bg-white p-6 text-navy">
        <p className="text-lg font-semibold">Thanks. We will check that you run {orgName}.</p>
        <p className="mt-1 text-base text-muted-foreground">When it is confirmed, we email {state.sent.email} a link to your free workspace.</p>
      </div>
    )
  }
  return (
    <form action={action} className="rounded-2xl bg-white p-5 text-navy sm:p-6">
      <Label htmlFor="quick-claim-email" className="text-base font-semibold">Your work email</Label>
      <div className="mt-2 flex flex-col gap-3 sm:flex-row">
        <Input id="quick-claim-email" name="email" type="email" autoComplete="email" defaultValue={state?.email} placeholder="name@organization.org" required className="h-12 flex-1 text-base" />
        <SubmitButton pendingLabel="Sending" className="h-12 shrink-0 rounded-full bg-action px-6 text-base font-semibold text-action-foreground hover:brightness-95">
          Claim this page
        </SubmitButton>
      </div>
      <input name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      {state?.error && <p role="alert" className="mt-2 text-sm text-destructive">{state.error}</p>}
    </form>
  )
}
