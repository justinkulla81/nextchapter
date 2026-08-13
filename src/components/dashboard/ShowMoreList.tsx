'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

// Paginates a long server-rendered list at pageSize per page, Prev/Next —
// same pattern as PriorityContactsCard/NeedsFollowUpCard/
// BackchannelMatchesCard, rather than a "show all at once" expand. Generic
// over its children so any compact-list row shape (My Applications, etc.)
// can reuse it.
export function ShowMoreList({
  pageSize,
  children,
}: {
  pageSize: number
  children: React.ReactNode
}) {
  const [page, setPage] = useState(0)
  const items = Array.isArray(children) ? children : [children]
  const pageCount = Math.ceil(items.length / pageSize)
  const visible = items.slice(page * pageSize, page * pageSize + pageSize)

  return (
    <>
      {visible}
      {pageCount > 1 && (
        <div className="flex items-center justify-between px-4 py-3">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            aria-label="Previous page"
            className="flex items-center gap-1 rounded-md px-2 py-1 text-sm font-medium text-muted-foreground hover:bg-muted disabled:pointer-events-none disabled:opacity-40"
          >
            <ChevronLeft className="size-4" />
            Prev
          </button>
          <span className="text-xs text-muted-foreground tabular-nums">
            {page + 1} of {pageCount}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            disabled={page === pageCount - 1}
            aria-label="Next page"
            className="flex items-center gap-1 rounded-md px-2 py-1 text-sm font-medium text-muted-foreground hover:bg-muted disabled:pointer-events-none disabled:opacity-40"
          >
            Next
            <ChevronRight className="size-4" />
          </button>
        </div>
      )}
    </>
  )
}
