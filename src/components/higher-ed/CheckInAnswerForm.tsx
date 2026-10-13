'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { submitCheckInAnswer } from '@/app/i/[slug]/checkin/[id]/actions'

type Answer = { key: string; label: string }

// Four answers as buttons (design principle 1), the one from the email
// preselected, then one click to send.
export function CheckInAnswerForm(props: {
  slug: string
  checkInId: string
  token: string
  answers: readonly Answer[]
  initial: string | null
  college: string
  joined: boolean
}) {
  const [answer, setAnswer] = useState<string | null>(props.initial)
  const [done, setDone] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  if (done) {
    const needsHelp = done === 'looking' || done === 'laid_off'
    return (
      <div className="space-y-4" role="status">
        <p className="text-lg font-medium">Thanks. {props.college} has it.</p>
        {needsHelp ? (
          <p className="text-sm text-muted-foreground">
            Someone from Career Services will follow up. You can start now: a clear read on your job market and a plan for this week, free for {props.college} alumni.
          </p>
        ) : done === 'new_job' ? (
          <p className="text-sm text-muted-foreground">Congratulations. If you want to share where you landed, you can from your {props.college} page.</p>
        ) : (
          <p className="text-sm text-muted-foreground">Good to hear. We&apos;ll check in again next year.</p>
        )}
        {props.joined ? (
          <Link href={`/i/${props.slug}/candidate`} className={buttonVariants({ size: 'lg' })}>
            Open your plan
          </Link>
        ) : (
          <Link
            href={`/i/${props.slug}/join?t=${encodeURIComponent(props.token)}`}
            className={buttonVariants({ size: 'lg', variant: needsHelp ? 'default' : 'outline' })}
          >
            See what {props.college} offers
          </Link>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Has anything changed?">
        {props.answers.map((a) => (
          <Button
            key={a.key}
            type="button"
            role="radio"
            aria-checked={answer === a.key}
            variant={answer === a.key ? 'default' : 'outline'}
            onClick={() => setAnswer(a.key)}
          >
            {a.label}
          </Button>
        ))}
      </div>
      {!answer && <p className="text-sm text-muted-foreground">Pick the answer that fits, then send it.</p>}
      <Button
        size="lg"
        disabled={!answer || pending}
        className={cn(pending && 'cursor-wait')}
        onClick={() =>
          start(async () => {
            setError(null)
            const r = await submitCheckInAnswer(props.slug, props.checkInId, props.token, answer!)
            if (r.error) setError(r.error)
            else setDone(answer)
          })
        }
      >
        {pending ? 'Sending…' : 'Send my answer'}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
