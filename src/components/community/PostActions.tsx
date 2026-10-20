'use client'

import { useState } from 'react'
import { useFormStatus } from 'react-dom'
import { ThumbsUp } from 'lucide-react'
import { ActionSubmit } from '@/components/candidate/ActionSubmit'
import { posthog } from '@/lib/posthog/client'
import { cn } from '@/lib/utils'

type PostAction = () => void | Promise<void>

// "I'm interested": the one quiet action on someone else's post.
export function InterestButton({ action, postId }: { action: PostAction; postId: string }) {
  return (
    <form action={action}>
      <ActionSubmit variant="secondary" pendingLabel="Sending…" event="community_interest_expressed" props={{ postId }}>
        I&apos;m interested
      </ActionSubmit>
    </form>
  )
}

function CheerFace({ cheered, count }: { cheered: boolean; count: number }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      aria-pressed={cheered}
      className={cn('inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-medium hover:bg-muted', cheered ? 'text-ink' : 'text-muted-foreground', pending && 'cursor-wait')}
    >
      <ThumbsUp className={cn('size-4', cheered && 'fill-ink')} aria-hidden />
      {cheered ? 'Cheered' : 'Cheer'}
      {count > 0 && <span className="tabular-nums">({count})</span>}
    </button>
  )
}

// Cheering someone's post. Says what it did, and how many others did.
export function CheerButton({ action, cheered, count, postId }: { action: PostAction; cheered: boolean; count: number; postId: string }) {
  return (
    <form action={action} onSubmit={() => posthog.capture('community_post_cheered', { postId, cheered: !cheered })}>
      <CheerFace cheered={cheered} count={count} />
    </form>
  )
}

// Removing your own post asks first, and the safe answer is the one without the focus.
export function RemovePostButton({ action, postId }: { action: PostAction; postId: string }) {
  const [confirming, setConfirming] = useState(false)
  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} className="inline-flex h-10 items-center rounded-full px-4 text-sm font-medium text-muted-foreground hover:bg-muted">
        Remove
      </button>
    )
  }
  return (
    <form action={action} onSubmit={() => posthog.capture('community_post_removed', { postId })} className="flex flex-wrap items-center gap-2" role="alertdialog" aria-label="Remove this post?">
      <span className="text-sm text-ink">Remove this post for everyone?</span>
      <button type="button" onClick={() => setConfirming(false)} className="inline-flex h-10 items-center rounded-full border border-border px-4 text-sm font-medium text-ink hover:bg-muted">
        Keep it
      </button>
      <ConfirmRemove />
    </form>
  )
}

function ConfirmRemove() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending} className={cn('inline-flex h-10 items-center rounded-full border border-destructive px-4 text-sm font-medium text-destructive hover:bg-destructive/5', pending && 'cursor-wait opacity-70')}>
      {pending ? 'Removing…' : 'Yes, remove'}
    </button>
  )
}
