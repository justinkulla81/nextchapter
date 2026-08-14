'use client'

import { useState, useTransition, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { minimizeActionPlanBox, maximizeActionPlanBox } from '@/app/dashboard/actions'
import type { PageKey } from '@/lib/dashboard/page-content'
import { cn } from '@/lib/utils'

// Minimize state is optimistic (flips instantly, persists in the
// background) and, unlike the Daily Message X, reversible same-day: closing
// then reopening before the next 12:01am Pacific boundary clears the
// dismissal record entirely (see maximizeActionPlanBox in page-content.ts)
// rather than leaving it minimized until tomorrow.
export function ActionPlanCollapsible({
  pageKey,
  initiallyMinimized,
  children,
}: {
  pageKey: PageKey
  initiallyMinimized: boolean
  children: ReactNode
}) {
  const [minimized, setMinimized] = useState(initiallyMinimized)
  const [, startTransition] = useTransition()

  function toggle() {
    const next = !minimized
    setMinimized(next)
    startTransition(() => {
      if (next) {
        minimizeActionPlanBox(pageKey)
      } else {
        maximizeActionPlanBox(pageKey)
      }
    })
  }

  return (
    <div className="space-y-2 rounded-lg border border-orange/30 bg-orange/5 p-3">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={!minimized}
        className="flex w-full items-center justify-between gap-2"
      >
        <p className="text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">Action Plan</p>
        <ChevronDown
          className={cn('size-4 shrink-0 text-muted-foreground transition-transform', minimized && '-rotate-90')}
          aria-hidden
        />
      </button>
      {!minimized && children}
    </div>
  )
}
