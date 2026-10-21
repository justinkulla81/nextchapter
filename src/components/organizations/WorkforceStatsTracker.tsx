'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { posthog } from '@/lib/posthog/client'

/**
 * Fires workforce_stats_viewed once, when the "By the numbers" block first scrolls into view,
 * with the tiles that were actually shown (a tile that failed to load is not in the list).
 */
export function WorkforceStatsTracker({ page, tiles, children }: { page: string; tiles: string[]; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const tileList = tiles.join(',')
  useEffect(() => {
    const el = ref.current
    if (!el) return
    let sent = false
    const send = () => {
      if (sent) return
      sent = true
      posthog.capture('workforce_stats_viewed', { page, tiles: tileList.split(','), tileCount: tileList.split(',').length })
    }
    if (typeof IntersectionObserver === 'undefined') {
      send()
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          send()
          io.disconnect()
        }
      },
      { threshold: 0.25 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [page, tileList])
  return <div ref={ref}>{children}</div>
}
