'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { confirmClaimAction, type ConfirmState } from '@/app/prepared/[slug]/org-actions'
import { SubmitButton } from '@/components/ui/submit-button'
import { employerSection } from '@/lib/employer/sections'

export function ConfirmClaimButton({ token, slug, orgName }: { token: string; slug: string; orgName: string }) {
  const [state, action] = useActionState<ConfirmState, FormData>(() => confirmClaimAction(token), undefined)
  if (state?.status === 'verified' || state?.status === 'already') {
    return (
      <div role="status" className="space-y-2">
        <p className="font-semibold text-navy">{state.status === 'verified' ? 'Your claim is confirmed.' : 'This claim was already confirmed.'}</p>
        <p className="text-sm text-muted-foreground">
          {state.status === 'verified' && state.section?.outcome === 'requested'
            ? `${employerSection(state.section.key).label} at ${orgName} already has an administrator. We sent them your request, and nothing has been granted yet.`
            : state.status === 'verified' && state.section && (state.section.outcome === 'admin' || state.section.outcome === 'review') && state.section.key === 'hiring'
              ? `Thanks. We check every claim. Once we approve it, you will get an email to set up the free hiring workspace for ${orgName}, with you as its administrator.`
              : state.status === 'verified' && state.section?.outcome === 'admin'
              ? `You are the first person to claim ${employerSection(state.section.key).label} at ${orgName}. A person on our team will follow up with you.`
              : state.status === 'verified' && state.awaitingApproval
                ? `Thanks. We check every claim before we open the free ${orgName} workspace. Once we approve it, you will get an email with your link to sign in as its administrator.`
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
