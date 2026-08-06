'use client'

import { useEffect } from 'react'
import { markBackchannelViewed } from '@/app/dashboard/network/actions'

export function MarkBackchannelViewedOnMount() {
  useEffect(() => {
    // Runs once per page load — resetting the "new" counter is what a
    // visit to this page means, same as communityLastViewedAt.
    void markBackchannelViewed()
  }, [])
  return null
}
