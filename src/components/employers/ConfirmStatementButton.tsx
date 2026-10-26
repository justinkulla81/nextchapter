'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { confirmStatementAction, type ConfirmStatementState } from '@/app/layoffs/company/[slug]/statement-actions'
import { SubmitButton } from '@/components/ui/submit-button'

export function ConfirmStatementButton({ token, slug, companyName }: { token: string; slug: string; companyName: string }) {
  const [state, action] = useActionState<ConfirmStatementState, FormData>(() => confirmStatementAction(token), undefined)
  if (state === 'verified' || state === 'already') {
    return (
      <div role="status" className="space-y-2">
        <p className="font-semibold text-navy">{state === 'verified' ? 'Your statement is confirmed.' : 'This statement was already confirmed.'}</p>
        <p className="text-sm text-muted-foreground">A person on our team reads it before it is shown next to the notice.</p>
        <Link href={`/layoffs/company/${slug}`} className="text-sm underline underline-offset-4">Back to the {companyName} page</Link>
      </div>
    )
  }
  return (
    <form action={action} className="space-y-3">
      {state === 'expired' && <p role="alert" className="text-sm text-red-700">This link has expired. Go back to the {companyName} page and send the statement again to get a new one.</p>}
      {state === 'invalid' && <p role="alert" className="text-sm text-red-700">This link is not valid. Go back to the {companyName} page and send the statement again to get a new one.</p>}
      <SubmitButton pendingLabel="Confirming">Confirm my statement</SubmitButton>
    </form>
  )
}
