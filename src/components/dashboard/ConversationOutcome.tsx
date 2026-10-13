'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { usePostHog } from '@/lib/posthog/client'
import { recordOutcome } from '@/app/dashboard/review-prep/actions'
import { OUTCOMES } from '@/lib/review-prep/conversation'
import { cn } from '@/lib/utils'

// "How did it go?" One click records the outcome. If the answer was not now,
// say what the member can do about it: look at the market.
export function ConversationOutcome({ id, kind, outcome }: { id: string; kind: string; outcome: string }) {
  const router = useRouter()
  const posthog = usePostHog()
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)

  if (outcome !== 'PENDING') {
    const label = OUTCOMES.find((o) => o.key === outcome)?.label ?? outcome
    return (
      <div className="text-sm">
        <p className="font-medium">{label}</p>
        {outcome !== 'GOT_IT' && (
          <p className="mt-1 text-muted-foreground">
            If the answer is not now, you have options. See{' '}
            <Link href="/dashboard/pay" className="text-primary underline underline-offset-4">
              where your pay sits
            </Link>
            , and{' '}
            <Link href="/dashboard/privacy" className="text-primary underline underline-offset-4">
              tell us if you are ready to look
            </Link>
            .
          </p>
        )}
      </div>
    )
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-2', pending && 'cursor-wait')}>
      <span className="text-sm text-muted-foreground">How did it go?</span>
      {OUTCOMES.map((o) => (
        <button
          key={o.key}
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setError(null)
              const r = await recordOutcome(id, o.key, '')
              if (r.error) return setError(r.error)
              posthog?.capture('career_conversation_outcome_clicked', { kind, outcome: o.key })
              router.refresh()
            })
          }
          className="rounded-md border border-brand px-2.5 py-1 text-xs font-medium text-brand hover:bg-brand/10 disabled:opacity-60"
        >
          {pending ? 'Saving…' : o.label}
        </button>
      ))}
      {error && (
        <p role="alert" className="w-full text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
