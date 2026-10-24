'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { confirmClaimAction, type ConfirmState } from '@/app/prepared/[slug]/org-actions'
import { SubmitButton } from '@/components/ui/submit-button'

export function ConfirmClaimButton({ token, slug, orgName }: { token: string; slug: string; orgName: string }) {
  const [state, action] = useActionState<ConfirmState, FormData>(() => confirmClaimAction(token), undefined)
  if (state?.status === 'verified' || state?.status === 'already') {
    return (
      <div role="status" className="space-y-2">
        <p className="font-semibold text-navy">{state.status === 'verified' ? 'Your claim is confirmed.' : 'This claim was already confirmed.'}</p>
        <p className="text-sm text-muted-foreground">
          {state.status === 'verified' && state.provisioned
            ? `We are setting up the free ${orgName} workspace with you as its administrator. Check your email for the link to sign in.`
            : `We have recorded you as the contact for ${orgName}. A person on our team will follow up with you.`}
        </p>
        <Link href={`/prepared/${slug}`} className="text-sm underline underline-offset-4">Back to the {orgName} page</Link>
      </div>
    )
  }
  return (
    <form action={action} className="space-y-3">
      {state?.status === 'expired' && <p role="alert" className="text-sm text-destructive">This link has expired. Go back to the {orgName} page and claim it again to get a new one.</p>}
      {state?.status === 'invalid' && <p role="alert" className="text-sm text-destructive">This link is not valid. Go back to the {orgName} page and claim it again to get a new one.</p>}
      <SubmitButton pendingLabel="Confirming">Confirm my claim</SubmitButton>
    </form>
  )
}
