'use client'

import { useState } from 'react'

// Caps a long server-rendered list at a preview count with a "see all"
// expand — no route change, no re-fetch, just reveals the rest of what
// already rendered. Generic over its children so any compact-list row
// shape (My Applications, etc.) can reuse it.
export function ShowMoreList({
  initialCount,
  totalCount,
  children,
}: {
  initialCount: number
  totalCount: number
  children: React.ReactNode
}) {
  const [expanded, setExpanded] = useState(false)
  const items = Array.isArray(children) ? children : [children]
  const visible = expanded ? items : items.slice(0, initialCount)

  return (
    <>
      {visible}
      {!expanded && totalCount > initialCount && (
        <div className="px-4 py-3">
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="text-sm font-medium text-primary underline underline-offset-4"
          >
            See all {totalCount} jobs
          </button>
        </div>
      )}
    </>
  )
}
