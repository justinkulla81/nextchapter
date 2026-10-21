'use client'

import { useActionState } from 'react'
import { claimProspectPage, type ClaimState } from '@/app/prepared/[slug]/actions'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { SubmitButton } from '@/components/ui/submit-button'

export function ClaimForm({ slug, orgName }: { slug: string; orgName: string }) {
  const [state, action] = useActionState<ClaimState, FormData>(claimProspectPage.bind(null, slug), undefined)
  if (state?.ok) {
    return (
      <div role="status" className="rounded-xl border border-border bg-white p-5">
        <p className="font-semibold text-navy">Thank you. Your request is in.</p>
        <p className="mt-1 text-sm text-muted-foreground">Justin will write to you today to set up the {orgName} page, and nothing is created until you say so.</p>
      </div>
    )
  }
  return (
    <form action={action} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5"><Label htmlFor="claim-name">Your name</Label><Input id="claim-name" name="name" autoComplete="name" required /></div>
        <div className="space-y-1.5"><Label htmlFor="claim-title">Your title</Label><Input id="claim-title" name="title" autoComplete="organization-title" required /></div>
      </div>
      <div className="space-y-1.5"><Label htmlFor="claim-email">Work email</Label><Input id="claim-email" name="email" type="email" autoComplete="email" required /></div>
      <div className="space-y-1.5"><Label htmlFor="claim-success">What would success look like for {orgName}? (optional)</Label><Textarea id="claim-success" name="success" rows={3} maxLength={600} /></div>
      <input name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      {state?.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
      <SubmitButton>Activate this page</SubmitButton>
    </form>
  )
}
