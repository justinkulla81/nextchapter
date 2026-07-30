'use client'

import { useEffect } from 'react'
import { markWatchlistPageViewed } from '@/app/dashboard/company-tracker/actions'

export function MarkWatchlistViewedOnMount() {
  useEffect(() => {
    // Runs once per page load — resetting the "new" counter is what a
    // visit to this page means, same as communityLastViewedAt.
    void markWatchlistPageViewed()
  }, [])
  return null
}
