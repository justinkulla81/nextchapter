'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { confirmStoryAction, withdrawStoryAction } from '@/app/layoffs/stories/actions'
import { SubmitButton } from '@/components/ui/submit-button'

type State = 'verified' | 'already' | 'expired' | 'invalid' | 'withdrawn' | undefined

/** The button on the confirm and withdraw pages: a button, not the bare link, so an email scanner that opens links cannot use up the token. */
export function StoryActionButton({ token, mode, companyName }: { token: string; mode: 'confirm' | 'withdraw'; companyName: string }) {
  const [state, action] = useActionState<State, FormData>(() => (mode === 'confirm' ? confirmStoryAction(token) : withdrawStoryAction(token)), undefined)
  if (state === 'verified' || state === 'withdrawn' || state === 'already') {
    const msg = mode === 'confirm' ? (state === 'already' ? 'This email was already confirmed.' : 'Your email is confirmed. Your answers now count.') : state === 'already' ? 'This story was already deleted.' : 'Your story and your email are deleted.'
    return (
      <div role="status" className="space-y-2">
        <p className="font-semibold text-navy">{msg}</p>
        <Link href="/layoffs/stories" className="text-sm underline underline-offset-4">Back to layoff stories</Link>
      </div>
    )
  }
  return (
    <form action={action} className="space-y-3">
      {state === 'expired' && <p role="alert" className="text-sm text-red-700">This link has expired. Share your story again from the {companyName} page to get a new one.</p>}
      {state === 'invalid' && <p role="alert" className="text-sm text-red-700">This link is not valid. If you already used it, there is nothing more to do.</p>}
      <SubmitButton pendingLabel={mode === 'confirm' ? 'Confirming' : 'Deleting'}>{mode === 'confirm' ? 'Confirm my email' : 'Delete my story'}</SubmitButton>
    </form>
  )
}
