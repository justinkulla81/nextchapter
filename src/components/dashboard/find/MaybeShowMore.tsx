import type { ReactNode } from 'react'
import { ShowMore } from '@/components/candidate/ShowMore'

/**
 * The redesign puts everything past the first three sections behind "Show more"; the live page keeps its
 * sections as they were. One wrapper so a block is written once and placed either way.
 */
export function MaybeShowMore({ enabled, label, event, properties, children }: { enabled: boolean; label: string; event: string; properties?: Record<string, unknown>; children: ReactNode }) {
  if (!enabled) return <>{children}</>
  return (
    <ShowMore label={label} event={event} properties={properties}>
      {children}
    </ShowMore>
  )
}
