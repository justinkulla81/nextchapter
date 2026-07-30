'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { syncCalendarNowAction, acknowledgeCalendarEvent } from '@/app/dashboard/calendar-activity/actions'

export function CalendarActivitySyncButton() {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  return (
    <div className="flex flex-col gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isPending}
        className={cn(isPending && 'cursor-progress')}
        onClick={() => {
          setError(null)
          startTransition(async () => {
            const result = await syncCalendarNowAction()
            if (result.error) setError(result.error)
          })
        }}
      >
        {isPending ? 'Checking…' : 'Check now'}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

export function CalendarActivityDismissButton({ eventId }: { eventId: string }) {
  const [isPending, startTransition] = useTransition()
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  return (
    <Button
      type="button"
      variant="ghost"
      size="xs"
      disabled={isPending}
      className={cn(isPending && 'cursor-progress')}
      onClick={() => {
        startTransition(async () => {
          await acknowledgeCalendarEvent(eventId)
          setDismissed(true)
        })
      }}
    >
      {isPending ? 'Saving…' : 'Dismiss'}
    </Button>
  )
}
