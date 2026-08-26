'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { InlineLoadingState } from '@/components/ui/spinner'
import { getEmailSyncLastSyncAt } from '@/app/dashboard/find-my-job/actions'

const POLL_MS = 3000
const MAX_POLLS = 8 // ~24s — the Gmail sync this watches for is usually done in a couple seconds

// The Application Tracker's Gmail sync runs via after() so it never blocks
// this page's render, which means the render that triggers a sync also
// serves stale jobPostings from before that sync ran — a job application
// landing in Gmail right as the candidate checks the page won't show up
// until they reload. This polls for the sync's lastSyncAt to actually move
// past what this page loaded with, then refreshes once so they don't have
// to guess whether to reload themselves.
//
// Renders a visible "checking for updates" indicator while it polls —
// this used to be invisible (return null), which read as "the stats just
// aren't updating" rather than "still syncing, one moment." Silently
// disappears once the poll window (~24s) runs out without finding
// anything new — that's the normal case (nothing new landed), not an
// error, so no failure state is shown.
export function EmailSyncWatcher({ initialLastSyncAt }: { initialLastSyncAt: string | null }) {
  const router = useRouter()
  const pollsRef = useRef(0)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    const interval = setInterval(async () => {
      pollsRef.current++
      if (pollsRef.current > MAX_POLLS) {
        clearInterval(interval)
        setChecking(false)
        return
      }
      try {
        const lastSyncAt = await getEmailSyncLastSyncAt()
        if (lastSyncAt && lastSyncAt !== initialLastSyncAt) {
          clearInterval(interval)
          router.refresh()
        }
      } catch {
        // transient error — next poll retries
      }
    }, POLL_MS)
    return () => clearInterval(interval)
  }, [initialLastSyncAt, router])

  if (!checking) return null

  return <InlineLoadingState label="Checking for new activity…" className="text-xs" />
}
