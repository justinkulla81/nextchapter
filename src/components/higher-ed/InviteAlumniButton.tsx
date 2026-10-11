'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { sendInvitations } from '@/app/i/[slug]/(portal)/staff-actions'

// Sending email to alumni is irreversible, so it takes a confirm step that
// says exactly how many and what they'll get.
export function InviteAlumniButton({ slug, count, isDemo, collegeName }: { slug: string; count: number; isDemo: boolean; collegeName: string }) {
  const [confirming, setConfirming] = useState(false)
  const [pending, start] = useTransition()
  const [message, setMessage] = useState<string | null>(null)
  if (count === 0) return <p className="text-sm text-muted-foreground">Everyone on the roster has been invited or has joined.</p>
  return (
    <div className={cn('space-y-2', pending && 'cursor-wait')}>
      {confirming ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm">
            {isDemo
              ? `Record join invitations for ${Math.min(count, 100)} demo alumni? Nothing is emailed on a demo.`
              : `Email ${Math.min(count, 100)} alumni a one-click invitation to join, from ${collegeName}?`}
          </span>
          <Button
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await sendInvitations(slug)
                setMessage(r.error ?? r.message ?? null)
                setConfirming(false)
              })
            }
          >
            {pending ? 'Sending…' : isDemo ? 'Record invitations' : 'Send invitations'}
          </Button>
          <Button variant="ghost" onClick={() => setConfirming(false)} disabled={pending} autoFocus>
            Cancel
          </Button>
        </div>
      ) : (
        <Button onClick={() => setConfirming(true)}>Invite {count.toLocaleString()} alumni to join</Button>
      )}
      {message && (
        <p role="status" className="text-sm text-muted-foreground">
          {message}
        </p>
      )}
    </div>
  )
}
