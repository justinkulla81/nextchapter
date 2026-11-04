'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { getWorkingPostingIds } from '@/app/dashboard/find-my-job/actions'

const POLL_MS = 3000
const MAX_POLLS = 60 // 3 minutes; the page stops calling it as a posting's "working" mark expires after 5

// Job postings whose fit analysis, interview prep or cover letter runs after the response (lib/jobs/posting-background.ts).
// Polls until none of them is working any more, then refreshes the page once so the results appear. Renders nothing: each
// posting shows its own "Working…" line.
export function PostingWorkWatcher({ postingIds }: { postingIds: string[] }) {
  const router = useRouter()
  const polls = useRef(0)
  const key = postingIds.join(',')

  useEffect(() => {
    if (!key) return
    polls.current = 0
    const ids = key.split(',')
    const interval = setInterval(async () => {
      polls.current++
      if (polls.current > MAX_POLLS) {
        clearInterval(interval)
        return
      }
      try {
        const still = await getWorkingPostingIds(ids)
        if (still.length === 0) {
          clearInterval(interval)
          router.refresh()
        }
      } catch {
        // transient error: the next poll tries again
      }
    }, POLL_MS)
    return () => clearInterval(interval)
  }, [key, router])

  return null
}
