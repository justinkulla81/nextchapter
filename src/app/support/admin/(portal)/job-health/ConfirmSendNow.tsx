'use client'

import { useState } from 'react'
import { SubmitButton } from '@/components/ui/submit-button'
import { Button } from '@/components/ui/button'
import { runJobSearchDailyNow } from './actions'

// Job Search Daily emails members, so running it by hand takes two clicks: the first only asks, the second runs it.
export function ConfirmSendNow() {
  const [asking, setAsking] = useState(false)
  if (!asking) {
    return (
      <Button type="button" size="sm" variant="outline" onClick={() => setAsking(true)} aria-label="Send the remaining Job Search Daily emails">
        Send remaining emails
      </Button>
    )
  }
  return (
    <form action={runJobSearchDailyNow} className="space-y-2">
      <p className="text-sm">Emails every member who has not had today&apos;s Job Search Daily. Anyone already sent today is skipped. It can take up to 5 minutes.</p>
      <div className="flex gap-2">
        <SubmitButton size="sm" pendingLabel="Sending… keep this page open" savedLabel="Finished" aria-label="Confirm: send the remaining Job Search Daily emails now">
          Yes, send now
        </SubmitButton>
        <Button type="button" size="sm" variant="ghost" onClick={() => setAsking(false)}>Cancel</Button>
      </div>
    </form>
  )
}
