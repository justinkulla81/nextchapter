'use client'

import { useEffect } from 'react'
import { markBadgesViewed } from '@/app/dashboard/stats/actions'

export function MarkBadgesViewedOnMount({ earnedBadgesCount }: { earnedBadgesCount: number }) {
  useEffect(() => {
    void markBadgesViewed(earnedBadgesCount)
  }, [earnedBadgesCount])
  return null
}
