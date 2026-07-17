'use client'

import { useState, useTransition } from 'react'
import { X } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { dismissDashboardMessage } from '@/app/dashboard/actions'
import type { DashboardMessageView } from '@/lib/dashboard/messages'

// Server-backed message rotation: a pinned "How NextChapter works" message
// shows first for every candidate until dismissed, then whichever active,
// non-pinned message they haven't dismissed yet takes its place (see
// getNextDashboardMessage). Dismissal is a real DB record, not localStorage,
// so it's the same across devices and lets an admin-authored rotation work.
export function DashboardMessageCard({ message }: { message: DashboardMessageView | null }) {
  const [dismissed, setDismissed] = useState(false)
  const [, startTransition] = useTransition()

  if (!message || dismissed) return null

  function dismiss() {
    setDismissed(true)
    startTransition(() => {
      dismissDashboardMessage(message!.id)
    })
  }

  return (
    <Card className="border-brand/30 bg-brand/5">
      <CardContent className="relative space-y-2">
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="absolute top-0 right-0 text-muted-foreground hover:text-foreground"
        >
          <X className="size-4" />
        </button>
        <p className="pr-6 text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">
          Daily Messages and Reminders
        </p>
        <h2 className="text-sm font-semibold text-navy">{message.title}</h2>
        <ul className="list-disc space-y-1.5 pl-4 text-sm text-foreground">
          {message.bullets.map((bullet, i) => (
            <li key={i}>{bullet}</li>
          ))}
        </ul>
        {message.footer && <p className="text-sm font-semibold text-foreground">{message.footer}</p>}
      </CardContent>
    </Card>
  )
}
