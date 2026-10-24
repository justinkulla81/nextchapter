'use client'

import { useEffect } from 'react'
import { markCoachSummaryViewed } from '@/app/dashboard/my-coaching/actions'

// Records that the member opened their coach's update, which clears the notice on Home.
export function MarkCoachSummaryViewed({ summaryId }: { summaryId: string }) {
  useEffect(() => {
    void markCoachSummaryViewed(summaryId)
  }, [summaryId])
  return null
}
